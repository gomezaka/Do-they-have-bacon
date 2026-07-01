import {
  createHotel as createLocalHotel,
  createReport as createLocalReport,
  findPossibleDuplicate as findLocalPossibleDuplicate,
  getHotelById as getLocalHotelById,
  getHotelsWithReports as getLocalHotelsWithReports,
  getHotelWithReports as getLocalHotelWithReports,
  searchLocalHotels
} from "@/lib/localStore";
import { getClientDataMode } from "@/lib/dataMode";
import { getSupabaseAccessToken } from "@/lib/authClient";
import { getAnonymousScoutId } from "@/lib/anonymousScout";
import type { BaconReport, BaconReportStatus, BreakfastContext, Hotel, HotelWithReports } from "@/types/db";

export interface CreateHotelInput {
  name: string;
  address?: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  source?: "manual" | "osm";
  externalId?: string;
  turnstileToken?: string;
  anonymousScoutId?: string;
}

export interface CreateReportInput {
  hotelId: string;
  status: BaconReportStatus;
  observedDate: string;
  breakfastContext: BreakfastContext;
  note?: string;
  photoDataUrl?: string;
  photoUrl?: string;
  turnstileToken?: string;
  anonymousScoutId?: string;
}

export async function listHotelsWithReports(): Promise<HotelWithReports[]> {
  if (getClientDataMode() === "supabase") {
    const payload = await fetchJson<{ hotels: HotelWithReports[] }>("/api/hotels?withReports=1");
    return payload.hotels;
  }
  return getLocalHotelsWithReports();
}

export async function searchHotels(query: string): Promise<HotelWithReports[]> {
  if (getClientDataMode() === "supabase") {
    const params = new URLSearchParams({ query, withReports: "1" });
    const payload = await fetchJson<{ hotels: HotelWithReports[] }>(`/api/hotels?${params.toString()}`);
    return payload.hotels;
  }
  return searchLocalHotels(query);
}

export async function getHotelWithReports(id: string): Promise<HotelWithReports | undefined> {
  if (getClientDataMode() === "supabase") {
    const payload = await fetchJson<{ hotel: HotelWithReports | null }>(`/api/hotels/${encodeURIComponent(id)}`);
    return payload.hotel ?? undefined;
  }
  return getLocalHotelWithReports(id);
}

export async function getHotelById(id: string): Promise<Hotel | undefined> {
  if (getClientDataMode() === "supabase") {
    const payload = await fetchJson<{ hotel: HotelWithReports | null }>(`/api/hotels/${encodeURIComponent(id)}`);
    return payload.hotel ?? undefined;
  }
  return getLocalHotelById(id);
}

export async function createHotel(input: CreateHotelInput): Promise<Hotel> {
  if (getClientDataMode() === "supabase") {
    const payload = await fetchJson<{ hotel: Hotel }>("/api/hotels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, anonymousScoutId: input.anonymousScoutId ?? getAnonymousScoutId() })
    });
    return payload.hotel;
  }
  return createLocalHotel({ ...input, anonymousScoutId: input.anonymousScoutId ?? getAnonymousScoutId() });
}

export async function createReport(input: CreateReportInput): Promise<BaconReport> {
  if (getClientDataMode() === "supabase") {
    const payload = await fetchJson<{ report: BaconReport }>("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, anonymousScoutId: input.anonymousScoutId ?? getAnonymousScoutId() })
    });
    return payload.report;
  }
  return createLocalReport({ ...input, anonymousScoutId: input.anonymousScoutId ?? getAnonymousScoutId() });
}

export async function findPossibleDuplicate(input: {
  name: string;
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
}): Promise<Hotel[]> {
  if (getClientDataMode() === "supabase") {
    const params = new URLSearchParams({
      name: input.name,
      city: input.city,
      country: input.country,
      latitude: String(input.latitude ?? ""),
      longitude: String(input.longitude ?? "")
    });
    const payload = await fetchJson<{ hotels: Hotel[] }>(`/api/hotels/duplicates?${params.toString()}`);
    return payload.hotels;
  }
  return findLocalPossibleDuplicate(input);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (getClientDataMode() === "supabase") {
    const token = await getSupabaseAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, { ...init, headers });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof payload.error === "string" ? payload.error : "Bacon data request failed.";
    throw new Error(message);
  }

  return payload as T;
}
