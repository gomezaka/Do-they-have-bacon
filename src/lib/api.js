import { isSupabaseConfigured, supabase } from './supabase';
import { getScoutId } from './scout';

const PAGE_SIZE = 1000;

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
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
  const hotels = await fetchHotels();
  const reports = await fetchReports();
  const visibleHotelIds = new Set(hotels.map((hotel) => hotel.id));
  const visibleReports = reports.filter((report) => visibleHotelIds.has(report.hotel_id));

  return hotels.map((hotel) =>
    normalizeHotel(hotel, visibleReports.filter((report) => report.hotel_id === hotel.id).map(normalizeReport))
  );
}

async function fetchHotels() {
  const client = requireSupabase();
  const hotels = [];
  let from = 0;

  while (true) {
    const { data, error } = await client
      .from('hotels')
      .select('id, name, address, city, country, latitude, longitude, created_at')
      .is('merged_into_hotel_id', null)
      .neq('verification_status', 'hidden')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    hotels.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return hotels;
}

async function fetchReports() {
  const client = requireSupabase();
  const reports = [];
  let from = 0;

  while (true) {
    const { data, error } = await client
      .from('bacon_reports')
      .select('id, hotel_id, status, observed_date, breakfast_context, note, photo_url, anonymous_scout_id, created_at')
      .order('observed_date', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    reports.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return reports;
}

export async function getHotelWithReports(id) {
  const hotels = await listHotelsWithReports();
  return hotels.find((hotel) => hotel.id === id) || null;
}

export function filterHotels(hotels, query) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return hotels;

  return hotels.filter((hotel) =>
    [hotel.name, hotel.city, hotel.country, hotel.address].filter(Boolean).some((value) =>
      normalizeSearchText(value).includes(normalized)
    )
  );
}

function normalizeSearchText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ä/g, 'a')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export async function createHotel(input) {
  const client = requireSupabase();
  const payload = {
    name: input.name.trim(),
    address: input.address?.trim() || null,
    city: input.city.trim(),
    country: input.country.trim(),
    latitude: Number(input.latitude),
    longitude: Number(input.longitude),
    source: input.source || 'manual',
    verification_status: 'unverified'
  };

  if (!payload.name || !payload.city || !payload.country) {
    throw new Error('Hotel name, city and country are required.');
  }

  if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) {
    throw new Error('A valid map pin is required.');
  }

  const { data, error } = await client
    .from('hotels')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createReport(input) {
  const client = requireSupabase();
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

  const { data, error } = await client
    .from('bacon_reports')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}
