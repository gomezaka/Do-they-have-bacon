import { createClient } from '@supabase/supabase-js';

function getHeader(headers, name) {
  const match = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return match?.[1] || '';
}

function getAllowedOrigins() {
  return [
    process.env.VITE_APP_URL,
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    ...(process.env.MODERATION_ALLOWED_ORIGINS || '').split(',')
  ]
    .map((origin) => String(origin || '').trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, X-Moderator-Token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}

function isAllowedOrigin(origin) {
  if (!origin) return false;
  return getAllowedOrigins().includes(origin.replace(/\/$/, ''));
}

const json = (statusCode, body, origin = '') => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    ...(origin ? corsHeaders(origin) : {})
  },
  body: JSON.stringify(body)
});

function requireConfigured() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const moderatorToken = process.env.MODERATOR_TOKEN;

  if (!supabaseUrl || !serviceRoleKey || !moderatorToken) {
    throw new Error('Moderation is not configured. Add SUPABASE_SERVICE_ROLE_KEY and MODERATOR_TOKEN.');
  }

  return {
    moderatorToken,
    supabase: createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  };
}

function normalizeCorrection(row) {
  const hotel = row.hotels || {};
  return {
    id: row.id,
    note: row.note || '',
    status: row.status || 'pending',
    currentLatitude: Number(row.current_latitude),
    currentLongitude: Number(row.current_longitude),
    suggestedLatitude: Number(row.suggested_latitude),
    suggestedLongitude: Number(row.suggested_longitude),
    createdAt: row.created_at,
    hotel: {
      id: hotel.id,
      name: hotel.name || '',
      address: hotel.address || '',
      city: hotel.city || '',
      country: hotel.country || '',
      latitude: Number(hotel.latitude),
      longitude: Number(hotel.longitude)
    }
  };
}

async function listLocationCorrections(supabase) {
  const { data, error } = await supabase
    .from('hotel_location_corrections')
    .select(`
      id,
      current_latitude,
      current_longitude,
      suggested_latitude,
      suggested_longitude,
      note,
      status,
      created_at,
      hotels (
        id,
        name,
        address,
        city,
        country,
        latitude,
        longitude
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizeCorrection);
}

async function getLocationCorrection(supabase, id) {
  const { data, error } = await supabase
    .from('hotel_location_corrections')
    .select('id, hotel_id, suggested_latitude, suggested_longitude, status')
    .eq('id', String(id || '').trim())
    .single();

  if (error) throw error;
  if (!data || data.status !== 'pending') throw new Error('Location correction is not pending.');
  return data;
}

async function applyLocationCorrection(supabase, id) {
  const correction = await getLocationCorrection(supabase, id);

  const { data: hotel, error: hotelError } = await supabase
    .from('hotels')
    .update({
      latitude: Number(correction.suggested_latitude),
      longitude: Number(correction.suggested_longitude),
      updated_at: new Date().toISOString()
    })
    .eq('id', correction.hotel_id)
    .select('id, latitude, longitude, updated_at')
    .single();

  if (hotelError) throw hotelError;

  const { error: correctionError } = await supabase
    .from('hotel_location_corrections')
    .update({ status: 'applied', updated_at: new Date().toISOString() })
    .eq('id', correction.id);

  if (correctionError) throw correctionError;
  return { hotel };
}

async function rejectLocationCorrection(supabase, id) {
  const { data, error } = await supabase
    .from('hotel_location_corrections')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', String(id || '').trim())
    .select('id, status')
    .single();

  if (error) throw error;
  return { correction: data };
}

export async function handler(event) {
  const origin = getHeader(event.headers, 'origin').replace(/\/$/, '');

  if (!isAllowedOrigin(origin)) {
    return json(403, { error: 'Origin is not allowed.' });
  }

  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true }, origin);
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' }, origin);

  let configured;
  try {
    configured = requireConfigured();
  } catch (error) {
    return json(501, { error: error.message }, origin);
  }

  const token = getHeader(event.headers, 'x-moderator-token');
  if (!token || token !== configured.moderatorToken) {
    return json(401, { error: 'Moderator token is invalid.' }, origin);
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body' }, origin);
  }

  try {
    if (payload.action === 'listLocationCorrections') {
      return json(200, { corrections: await listLocationCorrections(configured.supabase) }, origin);
    }
    if (payload.action === 'applyLocationCorrection') {
      return json(200, await applyLocationCorrection(configured.supabase, payload.correctionId), origin);
    }
    if (payload.action === 'rejectLocationCorrection') {
      return json(200, await rejectLocationCorrection(configured.supabase, payload.correctionId), origin);
    }
    return json(400, { error: 'Unknown moderation action.' }, origin);
  } catch (error) {
    return json(500, { error: error.message || 'Moderation failed.' }, origin);
  }
}
