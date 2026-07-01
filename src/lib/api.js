export { hasSupabaseConfig } from './supabase';
import { supabase, hasSupabaseConfig } from './supabase';
import { demoReviews, demoVenues } from './demoData';

const LOCAL_REVIEW_KEY = 'tribunesliter.localReviews.v2';
const LOCAL_VENUE_KEY = 'tribunesliter.localVenueRequests.v2';
const LOCAL_FACILITY_KEY = 'tribunesliter.localFacilityReports.v2';
const LOCAL_HIDDEN_REVIEW_KEY = 'tribunesliter.hiddenReviews.v2';

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

function normalizeVenue(row) {
  return {
    ...row,
    sport_tags: row.sport_tags ?? [],
    packlist: row.packlist ?? [],
    facilities: row.facilities ?? row.latest_facility_report ?? {},
    tribunesliter_minutes: Number(row.tribunesliter_minutes ?? row.avg_tribunesliter_minutes ?? 0),
    review_count: Number(row.review_count ?? 0),
  };
}

function normalizeReview(row) {
  return {
    ...row,
    venue_name: row.venue_name ?? row.venues?.name ?? row.venue?.name ?? '',
    user_name: row.user_name ?? row.display_name ?? 'Innlogget bruker',
  };
}

function normalizeFacilityReport(row) {
  return {
    ...row,
    venue_name: row.venue_name ?? row.venues?.name ?? row.venue?.name ?? '',
    user_name: row.user_name ?? row.profiles?.display_name ?? 'Innlogget bruker',
  };
}

function hasModeratorRole(profile) {
  return profile?.role === 'moderator' || profile?.role === 'admin';
}

async function fetchProfileForUser(userId) {
  if (!hasSupabaseConfig || !userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, role, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getCurrentProfile() {
  if (!hasSupabaseConfig) return { id: 'demo-user', display_name: 'Demo-admin', role: 'admin' };
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return fetchProfileForUser(data.user?.id);
}

export async function getSession() {
  if (!hasSupabaseConfig) {
    const user = getDemoUser();
    return { session: null, user, profile: user ? { id: 'demo-user', display_name: 'Demo-admin', role: 'admin' } : null, mode: 'demo' };
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const user = data.session?.user ?? null;
  const profile = user ? await fetchProfileForUser(user.id) : null;
  return { session: data.session, user, profile, mode: 'supabase' };
}

export async function listenToAuth(callback) {
  if (!hasSupabaseConfig) return () => {};
  const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
    const user = session?.user ?? null;
    const profile = user ? await fetchProfileForUser(user.id) : null;
    callback({ user, profile });
  });
  return () => data.subscription.unsubscribe();
}

export async function signInWithEmail(email) {
  if (!hasSupabaseConfig) {
    const demoUser = { id: 'demo-user', email, user_metadata: { display_name: 'Demo-bruker' } };
    localStorage.setItem('tribunesliter.demoUser', JSON.stringify(demoUser));
    return { demo: true, user: demoUser, profile: { id: 'demo-user', display_name: 'Demo-admin', role: 'admin' } };
  }

  const redirectTo = import.meta.env.VITE_APP_URL || window.location.origin;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
  return { demo: false };
}

export async function signOut() {
  if (!hasSupabaseConfig) {
    localStorage.removeItem('tribunesliter.demoUser');
    return;
  }
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function getDemoUser() {
  return readLocal('tribunesliter.demoUser', null);
}

export async function fetchVenues() {
  if (!hasSupabaseConfig) {
    const localReviews = readLocal(LOCAL_REVIEW_KEY, []);
    const localFacilityReports = readLocal(LOCAL_FACILITY_KEY, []);
    const hiddenIds = new Set(readLocal(LOCAL_HIDDEN_REVIEW_KEY, []));
    return demoVenues.map((venue) => {
      const allReviews = [...demoReviews, ...localReviews]
        .filter((review) => review.venue_id === venue.id)
        .filter((review) => review.status !== 'pending' && review.status !== 'rejected' && review.status !== 'hidden')
        .filter((review) => !hiddenIds.has(review.id));
      const latestFacility = localFacilityReports
        .filter((report) => report.venue_id === venue.id && report.status === 'approved')
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
      const reviewPatch = allReviews.length
        ? {
            tribunesliter_minutes: Math.round(allReviews.reduce((sum, review) => sum + Number(review.tribunesliter_minutes), 0) / allReviews.length),
            review_count: allReviews.length,
          }
        : {};
      return latestFacility
        ? { ...venue, ...reviewPatch, facilities: latestFacility, facility_reported_at: latestFacility.created_at }
        : { ...venue, ...reviewPatch };
    });
  }

  const { data, error } = await supabase
    .from('venue_public_cards')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data.map(normalizeVenue);
}

export async function fetchVenue(venueId) {
  const venues = await fetchVenues();
  const venue = venues.find((item) => item.id === venueId);
  if (!venue) throw new Error('Fant ikke anlegget.');
  return venue;
}

export async function fetchReviews(venueId) {
  if (!hasSupabaseConfig) {
    const hiddenIds = new Set(readLocal(LOCAL_HIDDEN_REVIEW_KEY, []));
    return [...demoReviews, ...readLocal(LOCAL_REVIEW_KEY, [])]
      .filter((review) => review.venue_id === venueId)
      .filter((review) => review.status !== 'pending' && review.status !== 'rejected' && review.status !== 'hidden')
      .filter((review) => !hiddenIds.has(review.id))
      .sort((a, b) => String(b.visit_date).localeCompare(String(a.visit_date)));
  }

  const { data, error } = await supabase
    .from('approved_reviews_public')
    .select('*')
    .eq('venue_id', venueId)
    .order('visit_date', { ascending: false });

  if (error) throw error;
  return data.map(normalizeReview);
}

function buildFacilityPayload(review, userId) {
  return {
    venue_id: review.venue_id,
    user_id: userId,
    seating_type: review.facility_seating_type || review.seating_type || null,
    seat_comfort: Number(review.facility_seat_comfort || review.seat_comfort || review.comfort_score || 3),
    has_backrest: Boolean(review.facility_has_backrest ?? review.has_backrest),
    heating_level: Number(review.facility_heating_level || review.heating_level || review.temperature_score || 3),
    toilet_quality: Number(review.facility_toilet_quality || review.toilet_quality || 3),
    kiosk_status: review.facility_kiosk_status || review.kiosk_status || null,
    parking: review.facility_parking || review.parking || null,
    accessibility: Number(review.facility_accessibility || review.accessibility || review.accessibility_score || 3),
    roof_cover: Boolean(review.facility_roof_cover ?? review.roof_cover),
    garderobe_quality: Number(review.facility_garderobe_quality || review.garderobe_quality || 3),
    shower_quality: Number(review.facility_shower_quality || review.shower_quality || 3),
    view_quality: Number(review.facility_view_quality || review.view_quality || review.view_score || 3),
    noise_level: Number(review.facility_noise_level || review.noise_level || 3),
    notes: review.facility_notes || review.notes || null,
    approved: false,
    status: 'pending',
  };
}

function hasFacilityReport(review) {
  return Boolean(
    review.facility_seating_type ||
    review.facility_kiosk_status ||
    review.facility_parking ||
    review.facility_notes ||
    review.facility_has_backrest ||
    review.facility_roof_cover
  );
}

export async function submitReview(review) {
  if (!hasSupabaseConfig) {
    const reviews = readLocal(LOCAL_REVIEW_KEY, []);
    const newReview = {
      ...review,
      id: crypto.randomUUID(),
      user_name: review.user_name || 'Demo-bruker',
      approved: false,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    writeLocal(LOCAL_REVIEW_KEY, [newReview, ...reviews]);
    return newReview;
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Du må være innlogget for å sende vurdering.');

  const payload = {
    venue_id: review.venue_id,
    user_id: authData.user.id,
    tribunesliter_minutes: Number(review.tribunesliter_minutes),
    comfort_score: Number(review.comfort_score),
    view_score: Number(review.view_score),
    temperature_score: Number(review.temperature_score),
    accessibility_score: Number(review.accessibility_score),
    event_type: review.event_type,
    visit_date: review.visit_date,
    comment: review.comment,
    approved: false,
    status: 'pending',
  };

  const { data, error } = await supabase.from('reviews').insert(payload).select('*').single();
  if (error) throw error;

  if (hasFacilityReport(review)) {
    const facilityPayload = buildFacilityPayload(review, authData.user.id);
    const { error: facilityError } = await supabase.from('facility_reports').insert(facilityPayload);
    if (facilityError) throw facilityError;
  }

  return data;
}

export async function submitFacilityReport(report) {
  if (!hasSupabaseConfig) {
    const reports = readLocal(LOCAL_FACILITY_KEY, []);
    const payload = {
      ...buildFacilityPayload(report, 'demo-user'),
      id: crypto.randomUUID(),
      venue_name: report.venue_name || '',
      user_name: 'Demo-bruker',
      created_at: new Date().toISOString(),
    };
    writeLocal(LOCAL_FACILITY_KEY, [payload, ...reports]);
    return payload;
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Du må være innlogget for å sende fasilitetsrapport.');

  const payload = buildFacilityPayload(report, authData.user.id);
  const { data, error } = await supabase.from('facility_reports').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function submitVenueRequest(request) {
  if (!hasSupabaseConfig) {
    const requests = readLocal(LOCAL_VENUE_KEY, []);
    const payload = { ...request, id: crypto.randomUUID(), status: 'pending', created_at: new Date().toISOString() };
    writeLocal(LOCAL_VENUE_KEY, [payload, ...requests]);
    return payload;
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Du må være innlogget for å foreslå nytt anlegg.');

  const payload = {
    ...request,
    user_id: authData.user.id,
    status: 'pending',
  };
  const { data, error } = await supabase.from('venue_requests').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function fetchPendingModeration() {
  if (!hasSupabaseConfig) {
    const localReviews = readLocal(LOCAL_REVIEW_KEY, []);
    const localFacilities = readLocal(LOCAL_FACILITY_KEY, []);
    return {
      reviews: localReviews.filter((review) => review.status === 'pending' || review.approved === false),
      approvedReviews: [...demoReviews, ...localReviews].filter((review) => !review.status || review.status === 'approved' || review.approved === true),
      facilityReports: localFacilities.filter((report) => report.status === 'pending' || report.approved === false),
      venueRequests: readLocal(LOCAL_VENUE_KEY, []).filter((request) => request.status === 'pending'),
    };
  }

  const profile = await getCurrentProfile();
  if (!hasModeratorRole(profile)) throw new Error('Denne brukeren mangler moderator- eller adminrolle.');

  const [reviews, approvedReviews, facilityReports, venueRequests] = await Promise.all([
    supabase.from('reviews').select('*, venues(name)').eq('status', 'pending').order('created_at', { ascending: false }).limit(50),
    supabase.from('reviews').select('*, venues(name)').eq('status', 'approved').order('created_at', { ascending: false }).limit(50),
    supabase.from('facility_reports').select('*, venues(name)').eq('status', 'pending').order('created_at', { ascending: false }).limit(50),
    supabase.from('venue_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(50),
  ]);

  if (reviews.error) throw reviews.error;
  if (approvedReviews.error) throw approvedReviews.error;
  if (facilityReports.error) throw facilityReports.error;
  if (venueRequests.error) throw venueRequests.error;
  return {
    reviews: reviews.data.map(normalizeReview),
    approvedReviews: approvedReviews.data.map(normalizeReview),
    facilityReports: facilityReports.data.map(normalizeFacilityReport),
    venueRequests: venueRequests.data,
  };
}

function updateLocalReview(reviewId, patch) {
  const reviews = readLocal(LOCAL_REVIEW_KEY, []);
  writeLocal(LOCAL_REVIEW_KEY, reviews.map((review) => (review.id === reviewId ? { ...review, ...patch } : review)));
}

function updateLocalFacilityReport(reportId, patch) {
  const reports = readLocal(LOCAL_FACILITY_KEY, []);
  writeLocal(LOCAL_FACILITY_KEY, reports.map((report) => (report.id === reportId ? { ...report, ...patch } : report)));
}

export async function approveReview(reviewId) {
  if (!hasSupabaseConfig) {
    updateLocalReview(reviewId, { approved: true, status: 'approved' });
    return;
  }
  const { error } = await supabase.from('reviews').update({ approved: true, status: 'approved' }).eq('id', reviewId);
  if (error) throw error;
}

export async function rejectReview(reviewId) {
  if (!hasSupabaseConfig) {
    updateLocalReview(reviewId, { approved: false, status: 'rejected' });
    return;
  }
  const { error } = await supabase.from('reviews').update({ approved: false, status: 'rejected' }).eq('id', reviewId);
  if (error) throw error;
}

export async function hideReview(reviewId) {
  if (!hasSupabaseConfig) {
    const hidden = new Set(readLocal(LOCAL_HIDDEN_REVIEW_KEY, []));
    hidden.add(reviewId);
    writeLocal(LOCAL_HIDDEN_REVIEW_KEY, [...hidden]);
    updateLocalReview(reviewId, { approved: false, status: 'hidden' });
    return;
  }
  const { error } = await supabase.from('reviews').update({ approved: false, status: 'hidden' }).eq('id', reviewId);
  if (error) throw error;
}


export async function approveFacilityReport(reportId) {
  if (!hasSupabaseConfig) {
    updateLocalFacilityReport(reportId, { approved: true, status: 'approved' });
    return;
  }
  const { error } = await supabase.from('facility_reports').update({ approved: true, status: 'approved' }).eq('id', reportId);
  if (error) throw error;
}

export async function rejectFacilityReport(reportId) {
  if (!hasSupabaseConfig) {
    updateLocalFacilityReport(reportId, { approved: false, status: 'rejected' });
    return;
  }
  const { error } = await supabase.from('facility_reports').update({ approved: false, status: 'rejected' }).eq('id', reportId);
  if (error) throw error;
}

export async function approveVenueRequest(request) {
  if (!hasSupabaseConfig) {
    const requests = readLocal(LOCAL_VENUE_KEY, []);
    writeLocal(
      LOCAL_VENUE_KEY,
      requests.map((item) => (item.id === request.id ? { ...item, ...request, status: 'approved' } : item))
    );
    return { id: request.id };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Du må være innlogget som moderator.');

  const venuePayload = {
    name: request.name,
    municipality: request.municipality,
    address: request.address || null,
    venue_type: request.venue_type || 'Flerbrukshall',
    is_outdoor: Boolean(request.is_outdoor),
    sport_tags: request.sport_tags || [],
    cover_emoji: request.is_outdoor ? '⚽' : '🏟️',
    status: 'approved',
    created_by: request.user_id || authData.user.id,
  };

  const { data: venue, error: venueError } = await supabase.from('venues').insert(venuePayload).select('*').single();
  if (venueError) throw venueError;

  const { error: requestError } = await supabase
    .from('venue_requests')
    .update({
      status: 'approved',
      venue_id: venue.id,
      processed_by: authData.user.id,
      processed_at: new Date().toISOString(),
    })
    .eq('id', request.id);
  if (requestError) throw requestError;

  return venue;
}

export async function rejectVenueRequest(requestId) {
  if (!hasSupabaseConfig) {
    const requests = readLocal(LOCAL_VENUE_KEY, []);
    writeLocal(LOCAL_VENUE_KEY, requests.map((request) => (request.id === requestId ? { ...request, status: 'rejected' } : request)));
    return;
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Du må være innlogget som moderator.');

  const { error } = await supabase
    .from('venue_requests')
    .update({ status: 'rejected', processed_by: authData.user.id, processed_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) throw error;
}
