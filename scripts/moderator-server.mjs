import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = join(__dirname, '..');
const DEFAULT_PORT = 8789;
const HOST = '127.0.0.1';
const PAGE_SIZE = 1000;
const shouldOpenBrowser = process.argv.includes('--open');

loadEnvFile('.env');
loadEnvFile('.env.local');

const port = Number(process.env.MODERATOR_PORT || getArgValue('--port') || DEFAULT_PORT);
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

const server = createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', `http://${HOST}:${port}`);
    const path = requestUrl.pathname;

    if (req.method === 'GET' && path === '/') {
      return sendHtml(res, MODERATOR_HTML);
    }

    if (req.method === 'GET' && path === '/leaflet.css') {
      return sendFile(res, join(rootDir, 'node_modules', 'leaflet', 'dist', 'leaflet.css'), 'text/css');
    }

    if (req.method === 'GET' && path === '/leaflet.js') {
      return sendFile(res, join(rootDir, 'node_modules', 'leaflet', 'dist', 'leaflet.js'), 'text/javascript');
    }

    if (req.method === 'GET' && path === '/api/hotels') {
      return sendJson(res, 200, { hotels: await listHotels(requestUrl.searchParams) });
    }

    const locationMatch = path.match(/^\/api\/hotels\/([^/]+)\/location$/);
    if (req.method === 'POST' && locationMatch) {
      const body = await readJson(req);
      const hotel = await updateHotelLocation(decodeURIComponent(locationMatch[1]), body);
      return sendJson(res, 200, { hotel });
    }

    const hideMatch = path.match(/^\/api\/hotels\/([^/]+)\/hide$/);
    if (req.method === 'POST' && hideMatch) {
      const hotel = await updateHotelStatus(decodeURIComponent(hideMatch[1]), 'hidden');
      return sendJson(res, 200, { hotel });
    }

    const restoreMatch = path.match(/^\/api\/hotels\/([^/]+)\/restore$/);
    if (req.method === 'POST' && restoreMatch) {
      const hotel = await updateHotelStatus(decodeURIComponent(restoreMatch[1]), 'unverified');
      return sendJson(res, 200, { hotel });
    }

    const correctionApplyMatch = path.match(/^\/api\/location-corrections\/([^/]+)\/apply$/);
    if (req.method === 'POST' && correctionApplyMatch) {
      const result = await applyLocationCorrection(decodeURIComponent(correctionApplyMatch[1]));
      return sendJson(res, 200, result);
    }

    const correctionRejectMatch = path.match(/^\/api\/location-corrections\/([^/]+)\/reject$/);
    if (req.method === 'POST' && correctionRejectMatch) {
      const correction = await updateLocationCorrectionStatus(decodeURIComponent(correctionRejectMatch[1]), 'rejected');
      return sendJson(res, 200, { correction });
    }

    sendJson(res, 404, { error: 'Not found.' });
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Moderator server failed.' });
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Open http://${HOST}:${port}/ or stop the other moderator server.`);
    process.exit(1);
  }

  console.error(error.message || error);
  process.exit(1);
});

server.listen(port, HOST, () => {
  const url = `http://${HOST}:${port}/`;
  console.log(`Moderator app: ${url}`);
  if (shouldOpenBrowser) openBrowser(url);
});

function openBrowser(url) {
  const command = process.platform === 'win32'
    ? { file: 'cmd', args: ['/c', 'start', '', url] }
    : process.platform === 'darwin'
      ? { file: 'open', args: [url] }
      : { file: 'xdg-open', args: [url] };

  execFile(command.file, command.args, { windowsHide: true }, () => {});
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

async function listHotels(searchParams) {
  const includeHidden = searchParams.get('includeHidden') === '1';
  const hotels = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from('hotels')
      .select(`
        id,
        name,
        address,
        city,
        country,
        latitude,
        longitude,
        verification_status,
        created_at,
        updated_at,
        bacon_reports (
          id,
          status,
          observed_date,
          created_at
        ),
        hotel_location_corrections (
          id,
          current_latitude,
          current_longitude,
          suggested_latitude,
          suggested_longitude,
          note,
          status,
          created_at
        )
      `)
      .is('merged_into_hotel_id', null)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (!includeHidden) query = query.neq('verification_status', 'hidden');

    const { data, error } = await query;
    if (error) throw error;

    hotels.push(...(data || []).map(normalizeHotel));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return hotels;
}

function normalizeHotel(row) {
  const reports = row.bacon_reports || [];
  const locationCorrections = (row.hotel_location_corrections || [])
    .filter((correction) => correction.status === 'pending')
    .map((correction) => ({
      id: correction.id,
      current_latitude: Number(correction.current_latitude),
      current_longitude: Number(correction.current_longitude),
      suggested_latitude: Number(correction.suggested_latitude),
      suggested_longitude: Number(correction.suggested_longitude),
      note: correction.note || '',
      status: correction.status || 'pending',
      created_at: correction.created_at
    }))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  return {
    id: row.id,
    name: row.name,
    address: row.address || '',
    city: row.city,
    country: row.country,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    verification_status: row.verification_status || 'unverified',
    created_at: row.created_at,
    updated_at: row.updated_at,
    report_count: reports.length,
    yes_count: reports.filter((report) => report.status === 'yes').length,
    no_count: reports.filter((report) => report.status === 'no').length,
    unsure_count: reports.filter((report) => report.status === 'unsure').length,
    location_corrections: locationCorrections
  };
}

async function updateHotelLocation(hotelId, input) {
  const latitude = requireCoordinate(input.latitude, 'Latitude', -90, 90);
  const longitude = requireCoordinate(input.longitude, 'Longitude', -180, 180);

  const { data, error } = await supabase
    .from('hotels')
    .update({ latitude, longitude, updated_at: new Date().toISOString() })
    .eq('id', requireHotelId(hotelId))
    .select('id, latitude, longitude, updated_at')
    .single();

  if (error) throw error;
  return data;
}

async function updateHotelStatus(hotelId, status) {
  const { data, error } = await supabase
    .from('hotels')
    .update({ verification_status: status, updated_at: new Date().toISOString() })
    .eq('id', requireHotelId(hotelId))
    .select('id, verification_status, updated_at')
    .single();

  if (error) throw error;
  return data;
}

async function applyLocationCorrection(correctionId) {
  const correction = await getLocationCorrection(correctionId);
  const hotel = await updateHotelLocation(correction.hotel_id, {
    latitude: correction.suggested_latitude,
    longitude: correction.suggested_longitude
  });
  await updateLocationCorrectionStatus(correction.id, 'applied');
  return { hotel, correction: { ...correction, status: 'applied' } };
}

async function getLocationCorrection(correctionId) {
  const { data, error } = await supabase
    .from('hotel_location_corrections')
    .select('id, hotel_id, suggested_latitude, suggested_longitude, status')
    .eq('id', String(correctionId || '').trim())
    .single();

  if (error) throw error;
  if (!data) throw new Error('Location correction was not found.');
  return data;
}

async function updateLocationCorrectionStatus(correctionId, status) {
  const { data, error } = await supabase
    .from('hotel_location_corrections')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', String(correctionId || '').trim())
    .select('id, status')
    .single();

  if (error) throw error;
  return data;
}

function requireHotelId(value) {
  const hotelId = String(value || '').trim();
  if (!hotelId) throw new Error('Hotel ID is required.');
  return hotelId;
}

function requireCoordinate(value, label, min, max) {
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate) || coordinate < min || coordinate > max) {
    throw new Error(`${label} must be a valid coordinate.`);
  }
  return Number(coordinate.toFixed(6));
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  if (!body) return {};

  try {
    return JSON.parse(body);
  } catch {
    throw new Error('Invalid JSON body.');
  }
}

function sendHtml(res, html) {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(html);
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(body));
}

function sendFile(res, file, fallbackType) {
  if (!existsSync(file)) return sendJson(res, 404, { error: 'Asset not found.' });

  const contentTypes = {
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
  };

  res.writeHead(200, {
    'Content-Type': contentTypes[extname(file)] || fallbackType || 'application/octet-stream',
    'Cache-Control': 'public, max-age=3600'
  });
  res.end(readFileSync(file));
}

const MODERATOR_HTML = String.raw`<!doctype html>
<html lang="no">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bacon Moderator</title>
    <link rel="stylesheet" href="/leaflet.css" />
    <style>
      :root {
        --bg: #f3f1ec;
        --panel: #ffffff;
        --panel-soft: #f8f5ef;
        --text: #201611;
        --muted: #76685f;
        --line: #ddd5cc;
        --accent: #bd3b21;
        --accent-dark: #8d2a18;
        --danger: #9f1f15;
        --ok: #237a4b;
        --shadow: 0 20px 50px -28px rgba(48, 31, 21, .45);
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        color: var(--text);
        background: var(--bg);
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      button, input { font: inherit; }
      button { cursor: pointer; }
      button:disabled { cursor: wait; opacity: .55; }

      .shell {
        min-height: 100vh;
        display: grid;
        grid-template-rows: auto 1fr;
      }

      header {
        min-height: 64px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding: 14px 22px;
        background: var(--panel);
        border-bottom: 1px solid var(--line);
      }

      h1, h2, h3, p { margin-top: 0; }
      h1 { margin-bottom: 0; font-size: 19px; letter-spacing: 0; }
      h2 { margin-bottom: 8px; font-size: 22px; letter-spacing: 0; }
      h3 { margin-bottom: 8px; font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
      p { line-height: 1.45; }

      .status {
        min-height: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        padding: 7px 12px;
        background: var(--panel-soft);
        color: var(--muted);
        border: 1px solid var(--line);
        font-size: 13px;
        font-weight: 700;
      }

      .status.ok { color: var(--ok); }
      .status.error { color: var(--danger); }

      .layout {
        min-height: 0;
        display: grid;
        grid-template-columns: minmax(310px, 380px) minmax(0, 1fr);
      }

      aside {
        min-height: 0;
        border-right: 1px solid var(--line);
        background: var(--panel);
        display: grid;
        grid-template-rows: auto 1fr;
      }

      .tools {
        display: grid;
        gap: 12px;
        padding: 16px;
        border-bottom: 1px solid var(--line);
      }

      .search {
        width: 100%;
        min-height: 42px;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 9px 11px;
        outline: 0;
      }

      .check {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--muted);
        font-size: 13px;
        font-weight: 700;
      }

      .list {
        min-height: 0;
        overflow: auto;
        padding: 8px;
      }

      .hotel-row {
        width: 100%;
        display: grid;
        gap: 4px;
        text-align: left;
        border: 1px solid transparent;
        border-radius: 8px;
        background: transparent;
        padding: 12px;
      }

      .hotel-row:hover { background: var(--panel-soft); }
      .hotel-row.active { border-color: #e7baa9; background: #fff3ee; }
      .hotel-row.hidden { opacity: .55; }
      .hotel-name { font-weight: 800; }
      .hotel-meta { color: var(--muted); font-size: 13px; }

      main {
        min-width: 0;
        min-height: 0;
        display: grid;
        grid-template-rows: auto minmax(320px, 1fr);
        padding: 20px;
        gap: 16px;
      }

      .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 8px;
        box-shadow: var(--shadow);
      }

      .detail {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 18px;
        padding: 18px;
      }

      .stats {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 14px;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        min-height: 30px;
        border-radius: 999px;
        padding: 5px 10px;
        background: var(--panel-soft);
        color: var(--muted);
        border: 1px solid var(--line);
        font-size: 12px;
        font-weight: 800;
      }

      .pill.hidden { color: var(--danger); }

      .correction-list {
        display: grid;
        gap: 10px;
        margin-top: 18px;
      }

      .correction-list h3 { margin: 0; }

      .correction-card {
        display: grid;
        gap: 7px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel-soft);
        padding: 12px;
      }

      .correction-card p { margin: 0; }
      .correction-actions { justify-content: flex-start; }

      .actions {
        display: flex;
        align-items: flex-start;
        justify-content: flex-end;
        gap: 10px;
        flex-wrap: wrap;
      }

      .button {
        min-height: 40px;
        border: 0;
        border-radius: 8px;
        padding: 9px 13px;
        background: var(--accent);
        color: #fff;
        font-weight: 800;
      }

      .button:hover { background: var(--accent-dark); }
      .button.secondary { background: var(--panel-soft); color: var(--text); border: 1px solid var(--line); }
      .button.danger { background: var(--danger); }

      .map-tools {
        display: grid;
        grid-template-columns: repeat(2, minmax(120px, 1fr)) auto;
        gap: 10px;
        padding: 14px;
        border-bottom: 1px solid var(--line);
      }

      .field { display: grid; gap: 5px; }
      label { color: var(--muted); font-size: 12px; font-weight: 800; }
      .input {
        width: 100%;
        min-height: 40px;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 8px 10px;
        outline: 0;
      }

      #map {
        width: 100%;
        height: 100%;
        min-height: 420px;
        border-radius: 0 0 8px 8px;
        overflow: hidden;
        background: #e8ebe1;
      }

      .map-pin {
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        border-radius: 999px;
        border: 3px solid #fff;
        background: var(--accent);
        box-shadow: 0 8px 18px rgba(0,0,0,.25);
      }

      .map-pin::after {
        content: "";
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: #fff;
      }

      .empty {
        display: grid;
        place-items: center;
        min-height: 280px;
        color: var(--muted);
        font-weight: 800;
      }

      @media (max-width: 840px) {
        .layout { grid-template-columns: 1fr; }
        aside { border-right: 0; border-bottom: 1px solid var(--line); }
        .list { max-height: 260px; }
        main { padding: 14px; }
        .detail { grid-template-columns: 1fr; }
        .actions { justify-content: flex-start; }
        .map-tools { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header>
        <h1>Bacon Moderator</h1>
        <div id="status" class="status">Starter...</div>
      </header>

      <div class="layout">
        <aside>
          <div class="tools">
            <input id="search" class="search" placeholder="Sok etter hotell, by eller land" autocomplete="off" />
            <label class="check"><input id="includeHidden" type="checkbox" /> Vis skjulte hotell</label>
          </div>
          <div id="list" class="list"></div>
        </aside>

        <main>
          <section id="detail" class="panel empty">Velg et hotell</section>
          <section class="panel">
            <div class="map-tools">
              <div class="field">
                <label for="latitude">Latitude</label>
                <input id="latitude" class="input" inputmode="decimal" />
              </div>
              <div class="field">
                <label for="longitude">Longitude</label>
                <input id="longitude" class="input" inputmode="decimal" />
              </div>
              <button id="saveLocation" class="button" disabled>Lagre posisjon</button>
            </div>
            <div id="map"></div>
          </section>
        </main>
      </div>
    </div>

    <script src="/leaflet.js"></script>
    <script>
      const state = {
        hotels: [],
        selectedId: '',
        marker: null,
        map: null,
        saving: false
      };

      const elements = {
        status: document.querySelector('#status'),
        search: document.querySelector('#search'),
        includeHidden: document.querySelector('#includeHidden'),
        list: document.querySelector('#list'),
        detail: document.querySelector('#detail'),
        latitude: document.querySelector('#latitude'),
        longitude: document.querySelector('#longitude'),
        saveLocation: document.querySelector('#saveLocation')
      };

      init();

      function init() {
        state.map = L.map('map').setView([59.9139, 10.7522], 5);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(state.map);

        state.map.on('click', (event) => setDraftPosition(event.latlng.lat, event.latlng.lng, true));
        elements.search.addEventListener('input', renderList);
        elements.includeHidden.addEventListener('change', safeLoadHotels);
        elements.latitude.addEventListener('input', syncInputsToMarker);
        elements.longitude.addEventListener('input', syncInputsToMarker);
        elements.saveLocation.addEventListener('click', saveLocation);

        safeLoadHotels();
      }

      function safeLoadHotels() {
        loadHotels().catch((error) => {
          setStatus(error.message || 'Kunne ikke laste hotell.', 'error');
          elements.list.innerHTML = '';
          elements.detail.className = 'panel empty';
          elements.detail.textContent = 'Kunne ikke laste hotell. Sjekk terminalen og .env.local.';
        });
      }

      async function loadHotels() {
        setStatus('Laster hotell...');
        const includeHidden = elements.includeHidden.checked ? '1' : '0';
        const response = await fetch('/api/hotels?includeHidden=' + includeHidden);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Kunne ikke laste hotell.');

        state.hotels = payload.hotels || [];
        if (!state.hotels.some((hotel) => hotel.id === state.selectedId)) {
          state.selectedId = state.hotels[0]?.id || '';
        }

        renderList();
        renderDetail();
        setStatus(state.hotels.length + ' hotell lastet', 'ok');
      }

      function renderList() {
        const query = normalize(elements.search.value);
        const hotels = state.hotels.filter((hotel) => {
          if (!query) return true;
          return [hotel.name, hotel.address, hotel.city, hotel.country].some((value) => normalize(value).includes(query));
        });

        elements.list.innerHTML = hotels.map((hotel) => {
          const className = 'hotel-row'
            + (hotel.id === state.selectedId ? ' active' : '')
            + (hotel.verification_status === 'hidden' ? ' hidden' : '');
          return '<button class="' + className + '" data-id="' + escapeHtml(hotel.id) + '">'
            + '<span class="hotel-name">' + escapeHtml(hotel.name) + '</span>'
            + '<span class="hotel-meta">' + escapeHtml([hotel.city, hotel.country].filter(Boolean).join(', ')) + '</span>'
            + '<span class="hotel-meta">' + hotel.report_count + ' rapporter &middot; ' + escapeHtml(hotel.verification_status) + '</span>'
            + (hotel.location_corrections.length ? '<span class="hotel-meta">' + hotel.location_corrections.length + ' posisjonsforslag</span>' : '')
            + '</button>';
        }).join('');

        for (const row of elements.list.querySelectorAll('.hotel-row')) {
          row.addEventListener('click', () => {
            state.selectedId = row.dataset.id;
            renderList();
            renderDetail();
          });
        }
      }

      function renderDetail() {
        const hotel = selectedHotel();
        elements.saveLocation.disabled = !hotel || state.saving;

        if (!hotel) {
          elements.detail.className = 'panel empty';
          elements.detail.textContent = 'Velg et hotell';
          elements.latitude.value = '';
          elements.longitude.value = '';
          if (state.marker) state.marker.remove();
          state.marker = null;
          return;
        }

        elements.detail.className = 'panel detail';
        const statusClass = 'pill' + (hotel.verification_status === 'hidden' ? ' hidden' : '');
        const visibilityButton = hotel.verification_status === 'hidden'
          ? '<button id="restoreHotel" class="button secondary">Gjenopprett</button>'
          : '<button id="hideHotel" class="button danger">Skjul hotell</button>';
        const correctionHtml = hotel.location_corrections.length
          ? '<div class="correction-list"><h3>Posisjonsforslag</h3>'
            + hotel.location_corrections.map((correction) => (
              '<article class="correction-card">'
              + '<p class="hotel-meta">Nå: ' + formatCoordinate(correction.current_latitude) + ', ' + formatCoordinate(correction.current_longitude) + '</p>'
              + '<p class="hotel-meta">Forslag: ' + formatCoordinate(correction.suggested_latitude) + ', ' + formatCoordinate(correction.suggested_longitude) + '</p>'
              + (correction.note ? '<p>' + escapeHtml(correction.note) + '</p>' : '')
              + '<div class="actions correction-actions">'
              + '<button class="button secondary" data-correction-preview="' + escapeHtml(correction.id) + '">Vis pin</button>'
              + '<button class="button" data-correction-apply="' + escapeHtml(correction.id) + '">Bruk forslag</button>'
              + '<button class="button secondary" data-correction-reject="' + escapeHtml(correction.id) + '">Avvis</button>'
              + '</div>'
              + '</article>'
            )).join('')
            + '</div>'
          : '';

        elements.detail.innerHTML = '<div>'
          + '<h2>' + escapeHtml(hotel.name) + '</h2>'
          + '<p class="hotel-meta">' + escapeHtml([hotel.address, hotel.city, hotel.country].filter(Boolean).join(', ')) + '</p>'
          + '<div class="stats">'
          + '<span class="' + statusClass + '">' + escapeHtml(hotel.verification_status) + '</span>'
          + '<span class="pill">' + hotel.report_count + ' rapporter</span>'
          + '<span class="pill">' + hotel.yes_count + ' ja</span>'
          + '<span class="pill">' + hotel.no_count + ' nei</span>'
          + '<span class="pill">' + hotel.unsure_count + ' usikker</span>'
          + '</div>'
          + correctionHtml
          + '</div>'
          + '<div class="actions">'
          + visibilityButton
          + '</div>';

        const hideButton = document.querySelector('#hideHotel');
        const restoreButton = document.querySelector('#restoreHotel');
        if (hideButton) hideButton.addEventListener('click', hideHotel);
        if (restoreButton) restoreButton.addEventListener('click', restoreHotel);
        for (const button of elements.detail.querySelectorAll('[data-correction-preview]')) {
          button.addEventListener('click', () => previewLocationCorrection(button.dataset.correctionPreview));
        }
        for (const button of elements.detail.querySelectorAll('[data-correction-apply]')) {
          button.addEventListener('click', () => applyLocationCorrection(button.dataset.correctionApply));
        }
        for (const button of elements.detail.querySelectorAll('[data-correction-reject]')) {
          button.addEventListener('click', () => rejectLocationCorrection(button.dataset.correctionReject));
        }

        setDraftPosition(hotel.latitude, hotel.longitude, false);
        state.map.setView([hotel.latitude, hotel.longitude], 15);
      }

      function setDraftPosition(latitude, longitude, markDirty) {
        const lat = Number(latitude);
        const lng = Number(longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        elements.latitude.value = lat.toFixed(6);
        elements.longitude.value = lng.toFixed(6);

        const position = [lat, lng];
        if (!state.marker) {
          state.marker = L.marker(position, {
            draggable: true,
            icon: L.divIcon({
              html: '<span class="map-pin"></span>',
              className: '',
              iconSize: [30, 30],
              iconAnchor: [15, 15]
            })
          }).addTo(state.map);

          state.marker.on('dragend', () => {
            const position = state.marker.getLatLng();
            setDraftPosition(position.lat, position.lng, true);
          });
        } else {
          state.marker.setLatLng(position);
        }

        elements.saveLocation.disabled = state.saving || !selectedHotel();
        if (markDirty) setStatus('Posisjon endret. Husk a lagre.');
      }

      function syncInputsToMarker() {
        setDraftPosition(elements.latitude.value, elements.longitude.value, true);
      }

      async function saveLocation() {
        const hotel = selectedHotel();
        if (!hotel) return;

        state.saving = true;
        elements.saveLocation.disabled = true;
        setStatus('Lagrer posisjon...');

        try {
          const response = await fetch('/api/hotels/' + encodeURIComponent(hotel.id) + '/location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: elements.latitude.value,
              longitude: elements.longitude.value
            })
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || 'Kunne ikke lagre posisjon.');

          hotel.latitude = Number(payload.hotel.latitude);
          hotel.longitude = Number(payload.hotel.longitude);
          setStatus('Posisjon lagret', 'ok');
        } catch (error) {
          setStatus(error.message, 'error');
        } finally {
          state.saving = false;
          elements.saveLocation.disabled = false;
        }
      }

      async function hideHotel() {
        const hotel = selectedHotel();
        if (!hotel) return;
        if (!confirm('Skjul ' + hotel.name + '?')) return;
        await setHotelVisibility(hotel, 'hide');
      }

      async function restoreHotel() {
        const hotel = selectedHotel();
        if (!hotel) return;
        await setHotelVisibility(hotel, 'restore');
      }

      async function setHotelVisibility(hotel, action) {
        setStatus(action === 'hide' ? 'Skjuler hotell...' : 'Gjenoppretter hotell...');
        const response = await fetch('/api/hotels/' + encodeURIComponent(hotel.id) + '/' + action, { method: 'POST' });
        const payload = await response.json();
        if (!response.ok) {
          setStatus(payload.error || 'Kunne ikke oppdatere hotellet.', 'error');
          return;
        }

        if (action === 'hide' && !elements.includeHidden.checked) {
          state.hotels = state.hotels.filter((item) => item.id !== hotel.id);
          state.selectedId = state.hotels[0]?.id || '';
        } else {
          hotel.verification_status = payload.hotel.verification_status;
        }

        renderList();
        renderDetail();
        setStatus(action === 'hide' ? 'Hotell skjult' : 'Hotell gjenopprettet', 'ok');
      }

      function previewLocationCorrection(correctionId) {
        const hotel = selectedHotel();
        const correction = hotel?.location_corrections.find((item) => item.id === correctionId);
        if (!correction) return;
        setDraftPosition(correction.suggested_latitude, correction.suggested_longitude, true);
        state.map.setView([correction.suggested_latitude, correction.suggested_longitude], 17);
        setStatus('Viser foreslatt posisjon. Lagre manuelt eller bruk forslaget.');
      }

      async function applyLocationCorrection(correctionId) {
        const hotel = selectedHotel();
        const correction = hotel?.location_corrections.find((item) => item.id === correctionId);
        if (!hotel || !correction) return;
        if (!confirm('Flytt ' + hotel.name + ' til foreslatt posisjon?')) return;

        state.saving = true;
        elements.saveLocation.disabled = true;
        setStatus('Bruker posisjonsforslag...');

        try {
          const response = await fetch('/api/location-corrections/' + encodeURIComponent(correctionId) + '/apply', { method: 'POST' });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || 'Kunne ikke bruke posisjonsforslaget.');

          hotel.latitude = Number(payload.hotel.latitude);
          hotel.longitude = Number(payload.hotel.longitude);
          hotel.location_corrections = hotel.location_corrections.filter((item) => item.id !== correctionId);
          renderList();
          renderDetail();
          setStatus('Posisjonsforslag brukt', 'ok');
        } catch (error) {
          setStatus(error.message, 'error');
        } finally {
          state.saving = false;
          elements.saveLocation.disabled = false;
        }
      }

      async function rejectLocationCorrection(correctionId) {
        const hotel = selectedHotel();
        if (!hotel) return;

        state.saving = true;
        setStatus('Avviser posisjonsforslag...');

        try {
          const response = await fetch('/api/location-corrections/' + encodeURIComponent(correctionId) + '/reject', { method: 'POST' });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || 'Kunne ikke avvise posisjonsforslaget.');

          hotel.location_corrections = hotel.location_corrections.filter((item) => item.id !== correctionId);
          renderList();
          renderDetail();
          setStatus('Posisjonsforslag avvist', 'ok');
        } catch (error) {
          setStatus(error.message, 'error');
        } finally {
          state.saving = false;
        }
      }

      function selectedHotel() {
        return state.hotels.find((hotel) => hotel.id === state.selectedId) || null;
      }

      function setStatus(message, type) {
        elements.status.textContent = message;
        elements.status.className = 'status' + (type ? ' ' + type : '');
      }

      function normalize(value) {
        return String(value || '').trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
      }

      function formatCoordinate(value) {
        const coordinate = Number(value);
        return Number.isFinite(coordinate) ? coordinate.toFixed(6) : '';
      }

      function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, (char) => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;'
        })[char]);
      }
    </script>
  </body>
</html>`;
