import { getSupabaseServiceClient } from "@/lib/supabaseServer";
import type { BaconReport, Hotel, HotelWithReports } from "@/types/db";

export function hasSupabaseServiceConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function listHotelsWithReports(query?: string): Promise<HotelWithReports[]> {
  const supabase = getSupabaseServiceClient();
  let hotelsQuery = supabase
    .from("hotels")
    .select("*")
    .neq("verification_status", "hidden")
    .order("created_at", { ascending: false })
    .limit(120);

  const cleaned = query?.trim();
  if (cleaned) {
    const escaped = cleaned.replaceAll("%", "").replaceAll("_", "");
    hotelsQuery = hotelsQuery.or(
      `name.ilike.%${escaped}%,city.ilike.%${escaped}%,country.ilike.%${escaped}%,address.ilike.%${escaped}%`
    );
  }

  const { data: hotelRows, error: hotelError } = await hotelsQuery;
  if (hotelError) throw new Error(hotelError.message);

  const hotels = (hotelRows ?? []).map(mapHotelRow);
  if (!hotels.length) return [];

  const { data: reportRows, error: reportError } = await supabase
    .from("bacon_reports")
    .select("*")
    .in("hotel_id", hotels.map((hotel) => hotel.id))
    .order("observed_date", { ascending: false });

  if (reportError) throw new Error(reportError.message);

  const reports = (reportRows ?? []).map(mapReportRow);
  return hotels.map((hotel) => ({
    ...hotel,
    reports: reports.filter((report) => report.hotelId === hotel.id)
  }));
}

export async function getHotelWithReports(id: string): Promise<HotelWithReports | null> {
  const supabase = getSupabaseServiceClient();
  const { data: hotelRow, error: hotelError } = await supabase
    .from("hotels")
    .select("*")
    .eq("id", id)
    .neq("verification_status", "hidden")
    .maybeSingle();

  if (hotelError) throw new Error(hotelError.message);
  if (!hotelRow) return null;

  const { data: reportRows, error: reportError } = await supabase
    .from("bacon_reports")
    .select("*")
    .eq("hotel_id", id)
    .order("observed_date", { ascending: false });

  if (reportError) throw new Error(reportError.message);
  return { ...mapHotelRow(hotelRow), reports: (reportRows ?? []).map(mapReportRow) };
}

export async function createHotel(input: {
  name: string;
  address?: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  source?: "manual" | "osm";
  externalId?: string;
  userId?: string;
  anonymousScoutId?: string;
}): Promise<Hotel> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("hotels")
    .insert({
      name: input.name.trim(),
      address: input.address?.trim() || null,
      city: input.city.trim(),
      country: input.country.trim(),
      latitude: input.latitude,
      longitude: input.longitude,
      source: input.source ?? "manual",
      external_id: input.externalId ?? null,
      created_by_user_id: input.userId ?? null,
      created_by_anonymous_scout_id: input.anonymousScoutId ?? null,
      verification_status: "unverified"
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapHotelRow(data);
}

export async function createReport(input: {
  hotelId: string;
  status: "yes" | "no" | "unsure";
  observedDate: string;
  breakfastContext: "buffet" | "other";
  note?: string;
  photoDataUrl?: string;
  photoUrl?: string;
  userId?: string;
  anonymousScoutId?: string;
}): Promise<BaconReport> {
  const supabase = getSupabaseServiceClient();
  const photoUrl = input.photoUrl || input.photoDataUrl;
  const { data, error } = await supabase
    .from("bacon_reports")
    .insert({
      hotel_id: input.hotelId,
      user_id: input.userId ?? null,
      anonymous_scout_id: input.anonymousScoutId ?? null,
      status: input.status,
      observed_date: input.observedDate,
      breakfast_context: input.breakfastContext,
      note: input.note?.trim() || null,
      photo_url: photoUrl || null,
      photo_status: photoUrl ? "attached" : "none"
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  await refreshHotelStatusCache(input.hotelId).catch(() => undefined);
  return mapReportRow(data);
}

export async function findPossibleDuplicates(input: {
  name: string;
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
}): Promise<Hotel[]> {
  const candidates = await listHotelsWithReports(input.name);
  const name = normalize(input.name);
  const city = normalize(input.city);
  const country = normalize(input.country);

  return candidates
    .filter((hotel) => {
      const sameCity = normalize(hotel.city) === city;
      const sameCountry = normalize(hotel.country) === country;
      const hotelName = normalize(hotel.name);
      const nameSimilar = hotelName.includes(name) || name.includes(hotelName);
      const near =
        typeof input.latitude === "number" && typeof input.longitude === "number"
          ? distanceKm(input.latitude, input.longitude, hotel.latitude, hotel.longitude) < 1
          : false;
      return sameCountry && (sameCity || near) && nameSimilar;
    })
    .slice(0, 8);
}

async function refreshHotelStatusCache(hotelId: string): Promise<void> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("bacon_reports")
    .select("status, observed_date")
    .eq("hotel_id", hotelId);

  if (error) throw new Error(error.message);

  const reports = data ?? [];
  const yes = reports.filter((report) => report.status === "yes").length;
  const no = reports.filter((report) => report.status === "no").length;
  const unsure = reports.filter((report) => report.status === "unsure").length;
  const last = reports
    .map((report) => report.observed_date)
    .filter(Boolean)
    .sort()
    .at(-1);

  const status = yes > no && yes >= unsure ? "bacon_confirmed" : no > yes && no >= unsure ? "no_bacon_reported" : reports.length ? "uncertain" : "unscouted";

  await supabase.from("hotel_status_cache").upsert({
    hotel_id: hotelId,
    current_status: status,
    confidence_level: reports.length >= 3 ? "medium" : "low",
    yes_count: yes,
    no_count: no,
    unsure_count: unsure,
    last_reported_at: last ? `${last}T00:00:00.000Z` : null,
    updated_at: new Date().toISOString()
  });
}

interface SupabaseHotelRow {
  id: string;
  name: string;
  address: string | null;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  source: "manual" | "osm" | null;
  external_id: string | null;
  created_by_user_id: string | null;
  created_by_anonymous_scout_id: string | null;
  verification_status: "unverified" | "verified" | "duplicate" | "hidden" | null;
  merged_into_hotel_id: string | null;
  created_at: string;
  updated_at: string;
}

interface SupabaseReportRow {
  id: string;
  hotel_id: string;
  user_id: string | null;
  anonymous_scout_id: string | null;
  status: "yes" | "no" | "unsure";
  observed_date: string;
  breakfast_context: "buffet" | "other";
  note: string | null;
  photo_url: string | null;
  photo_status: "none" | "attached" | "hidden" | null;
  flagged_count: number | null;
  created_at: string;
  updated_at: string;
}

function mapHotelRow(row: SupabaseHotelRow): Hotel {
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? undefined,
    city: row.city,
    country: row.country,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    source: row.source ?? "manual",
    externalId: row.external_id ?? undefined,
    createdByUserId: row.created_by_user_id ?? undefined,
    createdByAnonymousScoutId: row.created_by_anonymous_scout_id ?? undefined,
    verificationStatus: row.verification_status ?? "unverified",
    mergedIntoHotelId: row.merged_into_hotel_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapReportRow(row: SupabaseReportRow): BaconReport {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    userId: row.user_id ?? undefined,
    anonymousScoutId: row.anonymous_scout_id ?? undefined,
    status: row.status,
    observedDate: row.observed_date,
    breakfastContext: row.breakfast_context,
    note: row.note ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    photoDataUrl: row.photo_url?.startsWith("data:") ? row.photo_url : undefined,
    photoStatus: row.photo_status ?? "none",
    flaggedCount: row.flagged_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return radius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function deg2rad(value: number) {
  return value * (Math.PI / 180);
}
