import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = join(__dirname, '..');
const PAGE_SIZE = 1000;
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'do-they-have-bacon-coordinate-repair/1.0';
const COMMON_WORDS = new Set([
  'hotel',
  'hotell',
  'the',
  'and',
  'by',
  'a',
  'an',
  'of',
  'at',
  'in'
]);

loadEnvFile('.env');
loadEnvFile('.env.local');

const args = parseArgs(process.argv.slice(2));
const applyChanges = Boolean(args.apply);
const includeHidden = Boolean(args.includeHidden);
const limit = Number(args.limit || 0);
const onlyId = String(args.id || '').trim();
const queryFilter = normalize(args.query || '');
const minConfidence = Number(args.minConfidence || 0.85);

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const hotels = await fetchHotels();
const selected = hotels
  .filter((hotel) => !onlyId || hotel.id === onlyId)
  .filter((hotel) => !queryFilter || normalize([hotel.name, hotel.address, hotel.city, hotel.country].join(' ')).includes(queryFilter))
  .slice(0, limit > 0 ? limit : undefined);

if (!selected.length) {
  console.log('No hotels matched the filters.');
  process.exit(0);
}

if (applyChanges) writeBackup(selected);

console.log(`${applyChanges ? 'Applying' : 'Dry run'} coordinate repair for ${selected.length} hotel(s).`);
console.log(`Minimum confidence: ${minConfidence}`);

let updated = 0;
let skipped = 0;
let failed = 0;

for (let index = 0; index < selected.length; index += 1) {
  const hotel = selected[index];
  const prefix = `${index + 1}/${selected.length}`;

  try {
    const result = await geocodeHotel(hotel);
    if (!result) {
      skipped += 1;
      console.log(`${prefix} SKIP ${label(hotel)} -> no result`);
      await delay(1100);
      continue;
    }

    const confidence = scoreCandidate(hotel, result);
    const nextLatitude = Number(Number(result.lat).toFixed(6));
    const nextLongitude = Number(Number(result.lon).toFixed(6));
    const distanceKm = distanceBetweenKm(
      { latitude: hotel.latitude, longitude: hotel.longitude },
      { latitude: nextLatitude, longitude: nextLongitude }
    );
    const summary = `${hotel.latitude},${hotel.longitude} -> ${nextLatitude},${nextLongitude} (${distanceKm.toFixed(1)} km)`;

    if (confidence < minConfidence) {
      skipped += 1;
      console.log(`${prefix} LOW  ${label(hotel)} | confidence ${confidence.toFixed(2)} | ${summary} | ${result.display_name}`);
      await delay(1100);
      continue;
    }

    if (applyChanges) {
      await updateHotel(hotel.id, nextLatitude, nextLongitude);
      updated += 1;
      console.log(`${prefix} OK   ${label(hotel)} | confidence ${confidence.toFixed(2)} | ${summary}`);
    } else {
      updated += 1;
      console.log(`${prefix} WOULD ${label(hotel)} | confidence ${confidence.toFixed(2)} | ${summary} | ${result.display_name}`);
    }
  } catch (error) {
    failed += 1;
    console.log(`${prefix} FAIL ${label(hotel)} -> ${error.message || error}`);
  }

  await delay(1100);
}

console.log('');
console.log(`Done. ${applyChanges ? 'Updated' : 'Would update'}: ${updated}. Skipped: ${skipped}. Failed: ${failed}.`);
if (!applyChanges) {
  console.log('Run with --apply to write accepted coordinates to Supabase.');
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function loadEnvFile(name) {
  const file = join(rootDir, name);
  if (!existsSync(file)) return;

  for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

async function fetchHotels() {
  const hotels = [];
  let from = 0;

  while (true) {
    let request = supabase
      .from('hotels')
      .select('id, name, address, city, country, latitude, longitude, verification_status, updated_at')
      .is('merged_into_hotel_id', null)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (!includeHidden) request = request.neq('verification_status', 'hidden');

    const { data, error } = await request;
    if (error) throw error;

    hotels.push(...(data || []).map((hotel) => ({
      ...hotel,
      address: hotel.address || '',
      latitude: Number(hotel.latitude),
      longitude: Number(hotel.longitude)
    })));

    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return hotels;
}

async function geocodeHotel(hotel) {
  const searches = [
    [hotel.name, hotel.address, hotel.city, hotel.country],
    [`${hotel.name} hotel`, hotel.address, hotel.city, hotel.country],
    [hotel.name, hotel.city, hotel.country],
    [`${hotel.name} hotel`, hotel.city, hotel.country],
    [hotel.address, hotel.city, hotel.country],
    [hotel.city, hotel.country]
  ]
    .map((parts) => parts.filter(Boolean).join(', '))
    .filter((value, index, values) => value && values.indexOf(value) === index);

  let best = null;

  for (let index = 0; index < searches.length; index += 1) {
    const query = searches[index];
    const candidates = await geocode(query);
    if (!candidates.length) {
      if (index < searches.length - 1) await delay(1100);
      continue;
    }

    const ranked = candidates
      .map((candidate) => ({ candidate, confidence: scoreCandidate(hotel, candidate) }))
      .sort((a, b) => b.confidence - a.confidence);

    if (ranked[0] && (!best || ranked[0].confidence > best.confidence)) {
      best = ranked[0];
    }

    if (best?.confidence >= minConfidence) return best.candidate;
    if (index < searches.length - 1) await delay(1100);
  }

  return best?.candidate || null;
}

async function geocode(query, attempt = 1) {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('q', query);

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'en'
    }
  });

  if (response.status === 429 && attempt < 4) {
    const waitMs = attempt * 30000;
    console.log(`Rate limited by geocoder. Waiting ${Math.round(waitMs / 1000)} seconds...`);
    await delay(waitMs);
    return geocode(query, attempt + 1);
  }

  if (!response.ok) throw new Error(`Geocoder returned ${response.status}`);
  return response.json();
}

function scoreCandidate(hotel, candidate) {
  const display = normalize(candidate.display_name || '');
  const classType = normalize(`${candidate.class || ''} ${candidate.type || ''}`);
  const address = candidate.address || {};
  const addressText = normalize(Object.values(address).join(' '));
  const haystack = `${display} ${addressText}`;
  const nameCoverage = tokenCoverage(hotel.name, haystack);
  const addressCoverage = hotel.address ? tokenCoverage(hotel.address, haystack) : 0;
  const hotelish = isHotelish(candidate, haystack);

  let score = 0;
  if (nameCoverage >= 0.5) score += 0.36;
  if (nameCoverage >= 0.8) score += 0.16;
  if (addressCoverage >= 0.5) score += 0.12;
  if (normalize(hotel.city) && haystack.includes(normalize(hotel.city))) score += 0.18;
  if (normalize(hotel.country) && haystack.includes(normalize(hotel.country))) score += 0.12;
  if (hotelish) score += 0.12;

  if (!hotelish && addressCoverage < 0.5) return Math.min(0.55, score);
  return Math.min(1, score);
}

function isHotelish(candidate, haystack) {
  const classType = normalize(`${candidate.class || ''} ${candidate.type || ''}`);
  return classType.includes('hotel')
    || classType.includes('motel')
    || classType.includes('hostel')
    || classType.includes('guest_house')
    || classType.includes('tourism')
    || haystack.includes(' hotel ')
    || haystack.includes(' resort ')
    || haystack.includes(' motel ')
    || haystack.includes(' inn ');
}

function tokenCoverage(value, haystack) {
  const tokens = normalize(value)
    .split(' ')
    .filter((token) => token.length >= 3 && !COMMON_WORDS.has(token));

  if (!tokens.length) return 0;
  const matches = tokens.filter((token) => haystack.includes(token)).length;
  return matches / tokens.length;
}

async function updateHotel(id, latitude, longitude) {
  const { error } = await supabase
    .from('hotels')
    .update({ latitude, longitude, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

function writeBackup(hotels) {
  const dir = join(rootDir, 'coordinate-backups');
  mkdirSync(dir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(dir, `coordinates-${stamp}.json`);
  writeFileSync(file, JSON.stringify(hotels, null, 2));
  console.log(`Backup written to ${file}`);
}

function label(hotel) {
  return `${hotel.name} (${hotel.city}, ${hotel.country})`;
}

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ');
}

function distanceBetweenKm(pointA, pointB) {
  if (!Number.isFinite(pointA.latitude) || !Number.isFinite(pointA.longitude)) return 0;
  if (!Number.isFinite(pointB.latitude) || !Number.isFinite(pointB.longitude)) return 0;

  const earthRadiusKm = 6371;
  const latDelta = toRadians(pointB.latitude - pointA.latitude);
  const lonDelta = toRadians(pointB.longitude - pointA.longitude);
  const latA = toRadians(pointA.latitude);
  const latB = toRadians(pointB.latitude);
  const angle = Math.sin(latDelta / 2) ** 2
    + Math.cos(latA) * Math.cos(latB) * Math.sin(lonDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(angle), Math.sqrt(1 - angle));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
