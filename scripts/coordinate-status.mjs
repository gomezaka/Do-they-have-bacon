import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = join(__dirname, '..');
const CHUNK_SIZE = 200;

loadEnvFile('.env');
loadEnvFile('.env.local');

const backupFile = getBackupFile();
const backupPath = join(rootDir, 'coordinate-backups', backupFile);
const backedUpHotels = JSON.parse(readFileSync(backupPath, 'utf8'));
const backupTime = statSync(backupPath).mtime;

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

const currentHotels = new Map();
for (const chunk of chunks(backedUpHotels, CHUNK_SIZE)) {
  const { data, error } = await supabase
    .from('hotels')
    .select('id, name, latitude, longitude, updated_at, verification_status')
    .in('id', chunk.map((hotel) => hotel.id));

  if (error) throw error;
  for (const hotel of data || []) currentHotels.set(hotel.id, hotel);
}

const changedCoordinates = [];
const updatedSinceBackup = [];
const missing = [];

for (const before of backedUpHotels) {
  const current = currentHotels.get(before.id);
  if (!current) {
    missing.push(before);
    continue;
  }

  if (Math.abs(Number(before.latitude) - Number(current.latitude)) > 0.000001
    || Math.abs(Number(before.longitude) - Number(current.longitude)) > 0.000001) {
    changedCoordinates.push({ before, current });
  }

  if (new Date(current.updated_at) >= backupTime) {
    updatedSinceBackup.push({ before, current });
  }
}

console.log(JSON.stringify({
  backupFile,
  backupCount: backedUpHotels.length,
  changedCoordinateCount: changedCoordinates.length,
  updatedSinceBackupCount: updatedSinceBackup.length,
  missingCount: missing.length,
  changedSample: changedCoordinates.slice(0, 8).map(({ before, current }) => ({
    name: before.name,
    before: [before.latitude, before.longitude],
    after: [current.latitude, current.longitude],
    updated_at: current.updated_at
  }))
}, null, 2));

function getBackupFile() {
  const explicit = getArgValue('--backup');
  if (explicit) return explicit;

  const dir = join(rootDir, 'coordinate-backups');
  if (!existsSync(dir)) {
    console.error('No coordinate-backups folder found.');
    process.exit(1);
  }

  const files = readdirSync(dir).filter((file) => file.endsWith('.json')).sort();
  if (!files.length) {
    console.error('No coordinate backup files found.');
    process.exit(1);
  }

  return files.at(-1);
}

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return '';
  return process.argv[index + 1] || '';
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

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}
