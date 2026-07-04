import { isSupabaseConfigured, supabase } from './supabase';
import { getScoutId } from './scout';

const PAGE_SIZE = 1000;
const REPORT_NOTE_LIMIT = 500;
const REPORT_PHOTO_URL_PATTERN = /^https:\/\/[a-z0-9.-]+\/reports\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]+\.(jpg|jpeg|png|webp)$/i;
const HOTEL_WITH_REPORTS_SELECT = `
  id,
  name,
  address,
  city,
  country,
  latitude,
  longitude,
  created_at,
  bacon_reports (
    id,
    hotel_id,
    status,
    observed_date,
    breakfast_context,
    note,
    photo_url,
    anonymous_scout_id,
    created_at
  )
`;

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

function todayISO(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function isValidISODate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function isRowLevelSecurityError(error) {
  return error?.code === '42501' && /row-level security/i.test(error.message || '');
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
    reports: reports.map(normalizeReport).sort((a, b) => String(b.observed_date || b.created_at).localeCompare(String(a.observed_date || a.created_at)))
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
  return hotels.map((hotel) => normalizeHotel(hotel, hotel.bacon_reports || []));
}

async function fetchHotels() {
  const client = requireSupabase();
  const hotels = [];
  let from = 0;

  while (true) {
    const { data, error } = await client
      .from('hotels')
      .select(HOTEL_WITH_REPORTS_SELECT)
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

export async function getHotelWithReports(id) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('hotels')
    .select(HOTEL_WITH_REPORTS_SELECT)
    .eq('id', id)
    .is('merged_into_hotel_id', null)
    .neq('verification_status', 'hidden')
    .single();

  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return data ? normalizeHotel(data, data.bacon_reports || []) : null;
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

export function normalizeSearchText(value) {
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
  const note = input.note?.trim() || null;
  const observedDate = input.observedDate;
  const photoUrl = input.photoUrl || null;
  const payload = {
    hotel_id: input.hotelId,
    status: input.status,
    observed_date: observedDate,
    breakfast_context: input.breakfastContext || 'buffet',
    note,
    photo_url: photoUrl,
    photo_status: photoUrl ? 'uploaded' : 'none',
    anonymous_scout_id: getScoutId()
  };

  if (!['yes', 'no', 'unsure'].includes(payload.status)) throw new Error('Invalid bacon status.');
  if (!isValidISODate(payload.observed_date)) throw new Error('Observation date is required.');
  if (payload.observed_date > todayISO()) throw new Error('Observation date cannot be in the future.');
  if (!['buffet', 'other'].includes(payload.breakfast_context)) throw new Error('Invalid breakfast setup.');
  if ((note || '').length > REPORT_NOTE_LIMIT) throw new Error(`Note must be ${REPORT_NOTE_LIMIT} characters or fewer.`);
  if (photoUrl && !REPORT_PHOTO_URL_PATTERN.test(photoUrl)) {
    throw new Error('Photo upload returned an unexpected public URL. Check VITE_R2_PUBLIC_URL and the Supabase report policy.');
  }

  const { data, error } = await client
    .from('bacon_reports')
    .insert(payload)
    .select()
    .single();

  if (isRowLevelSecurityError(error)) {
    throw new Error('Supabase blocked this report with row-level security. Run docs/fix-report-rls.sql in Supabase SQL Editor, then try again.');
  }
  if (error) throw error;
  return data;
}
