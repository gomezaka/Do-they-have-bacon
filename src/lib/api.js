import { hasSupabaseConfig, supabase } from './supabase';
import { getScoutId } from './scout';

const LOCAL_HOTELS = 'dthb.hotels.v1';
const LOCAL_REPORTS = 'dthb.reports.v1';

function readLocal(key, fallback = []) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeHotel(row, reports = []) {
  return {
    id: row.id,
    name: row.name,
    address: row.address || '',
    city: row.city,
    country: row.country,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    created_at: row.created_at,
    reports
  };
}

function normalizeReport(row) {
  return {
    id: row.id,
    hotel_id: row.hotel_id,
    status: row.status,
    observed_date: row.observed_date,
    breakfast_context: row.breakfast_context,
    note: row.note || '',
    photo_url: row.photo_url || '',
    anonymous_scout_id: row.anonymous_scout_id || '',
    created_at: row.created_at
  };
}

export async function listHotelsWithReports() {
  if (!hasSupabaseConfig) {
    const hotels = readLocal(LOCAL_HOTELS);
    const reports = readLocal(LOCAL_REPORTS);
    return hotels.map((hotel) => normalizeHotel(hotel, reports.filter((report) => report.hotel_id === hotel.id)));
  }

  const { data: hotels, error: hotelError } = await supabase
    .from('hotels')
    .select('id, name, address, city, country, latitude, longitude, created_at')
    .is('merged_into_hotel_id', null)
    .neq('verification_status', 'hidden')
    .order('created_at', { ascending: false })
    .limit(200);

  if (hotelError) throw hotelError;

  const hotelIds = hotels.map((hotel) => hotel.id);
  let reports = [];
  if (hotelIds.length) {
    const { data, error } = await supabase
      .from('bacon_reports')
      .select('id, hotel_id, status, observed_date, breakfast_context, note, photo_url, anonymous_scout_id, created_at')
      .in('hotel_id', hotelIds)
      .order('observed_date', { ascending: false });
    if (error) throw error;
    reports = data || [];
  }

  return hotels.map((hotel) => normalizeHotel(hotel, reports.filter((report) => report.hotel_id === hotel.id).map(normalizeReport)));
}

export async function getHotelWithReports(id) {
  const hotels = await listHotelsWithReports();
  return hotels.find((hotel) => hotel.id === id) || null;
}

export async function searchHotels(query) {
  const normalized = query.trim().toLowerCase();
  const hotels = await listHotelsWithReports();
  if (!normalized) return hotels.slice(0, 30);
  return hotels.filter((hotel) =>
    [hotel.name, hotel.city, hotel.country, hotel.address].filter(Boolean).some((value) =>
      String(value).toLowerCase().includes(normalized)
    )
  );
}

export async function createHotel(input) {
  const payload = {
    name: input.name.trim(),
    address: input.address?.trim() || null,
    city: input.city.trim(),
    country: input.country.trim(),
    latitude: Number(input.latitude),
    longitude: Number(input.longitude),
    source: input.source || 'manual',
    verification_status: 'unverified',
    anonymous_scout_id: getScoutId()
  };

  if (!payload.name || !payload.city || !payload.country) {
    throw new Error('Hotel name, city and country are required.');
  }

  if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) {
    throw new Error('A valid map pin is required.');
  }

  if (!hasSupabaseConfig) {
    const hotels = readLocal(LOCAL_HOTELS);
    const hotel = { ...payload, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    hotels.unshift(hotel);
    writeLocal(LOCAL_HOTELS, hotels);
    return hotel;
  }

  const { data, error } = await supabase
    .from('hotels')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createReport(input) {
  const payload = {
    hotel_id: input.hotelId,
    status: input.status,
    observed_date: input.observedDate,
    breakfast_context: input.breakfastContext || 'buffet',
    note: input.note?.trim() || null,
    photo_url: input.photoUrl || null,
    photo_status: input.photoUrl ? 'uploaded' : 'none',
    anonymous_scout_id: getScoutId()
  };

  if (!['yes', 'no', 'unsure'].includes(payload.status)) throw new Error('Invalid bacon status.');
  if (!payload.observed_date) throw new Error('Observation date is required.');

  if (!hasSupabaseConfig) {
    const reports = readLocal(LOCAL_REPORTS);
    const report = { ...payload, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    reports.unshift(report);
    writeLocal(LOCAL_REPORTS, reports);
    return report;
  }

  const { data, error } = await supabase
    .from('bacon_reports')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function clearLocalData() {
  localStorage.removeItem(LOCAL_HOTELS);
  localStorage.removeItem(LOCAL_REPORTS);
}

export function seedDemoData() {
  const hotels = [
    { id: 'demo-oslo', name: 'Scandic Oslo City', address: 'Europarådets plass', city: 'Oslo', country: 'Norway', latitude: 59.9127, longitude: 10.7519, source: 'demo', verification_status: 'unverified', created_at: new Date().toISOString() },
    { id: 'demo-cph', name: 'Hotel Breakfast Copenhagen', address: 'Near the station', city: 'Copenhagen', country: 'Denmark', latitude: 55.6761, longitude: 12.5683, source: 'demo', verification_status: 'unverified', created_at: new Date().toISOString() },
    { id: 'demo-berlin', name: 'Berlin Morning Hotel', address: 'Mitte', city: 'Berlin', country: 'Germany', latitude: 52.52, longitude: 13.405, source: 'demo', verification_status: 'unverified', created_at: new Date().toISOString() }
  ];
  const reports = [
    { id: 'report-1', hotel_id: 'demo-oslo', status: 'yes', observed_date: new Date().toISOString().slice(0,10), breakfast_context: 'buffet', note: 'Crispy. Civilization survives.', photo_url: '', created_at: new Date().toISOString() },
    { id: 'report-2', hotel_id: 'demo-cph', status: 'no', observed_date: new Date().toISOString().slice(0,10), breakfast_context: 'buffet', note: 'Only scrambled eggs and silence.', photo_url: '', created_at: new Date().toISOString() },
    { id: 'report-3', hotel_id: 'demo-berlin', status: 'unsure', observed_date: new Date().toISOString().slice(0,10), breakfast_context: 'other', note: 'Suspicious breakfast matter.', photo_url: '', created_at: new Date().toISOString() }
  ];
  writeLocal(LOCAL_HOTELS, hotels);
  writeLocal(LOCAL_REPORTS, reports);
  return { hotels: hotels.length, reports: reports.length };
}
