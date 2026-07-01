import type { BaconReport, Hotel, HotelWithReports } from "@/types/db";
import { createId } from "@/lib/id";

const HOTELS_KEY = "dthb.hotels";
const REPORTS_KEY = "dthb.reports";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getHotels(): Hotel[] {
  return readJson<Hotel[]>(HOTELS_KEY, []);
}

export function saveHotels(hotels: Hotel[]): void {
  writeJson(HOTELS_KEY, hotels);
}

export function getReports(): BaconReport[] {
  return readJson<BaconReport[]>(REPORTS_KEY, []);
}

export function saveReports(reports: BaconReport[]): void {
  writeJson(REPORTS_KEY, reports);
}

export function getHotelById(id: string): Hotel | undefined {
  return getHotels().find((hotel) => hotel.id === id);
}

export function getReportsForHotel(hotelId: string): BaconReport[] {
  return getReports().filter((report) => report.hotelId === hotelId);
}

export function getHotelWithReports(id: string): HotelWithReports | undefined {
  const hotel = getHotelById(id);
  if (!hotel) return undefined;
  return { ...hotel, reports: getReportsForHotel(id) };
}

export function getHotelsWithReports(): HotelWithReports[] {
  const reports = getReports();
  return getHotels().map((hotel) => ({
    ...hotel,
    reports: reports.filter((report) => report.hotelId === hotel.id)
  }));
}

export function createHotel(input: {
  name: string;
  address?: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  source?: "manual" | "osm";
  externalId?: string;
  anonymousScoutId?: string;
}): Hotel {
  const now = new Date().toISOString();
  const hotel: Hotel = {
    id: createId(),
    name: input.name.trim(),
    address: input.address?.trim() || undefined,
    city: input.city.trim(),
    country: input.country.trim(),
    latitude: input.latitude,
    longitude: input.longitude,
    source: input.source ?? "manual",
    externalId: input.externalId,
    createdByAnonymousScoutId: input.anonymousScoutId,
    verificationStatus: "unverified",
    createdAt: now,
    updatedAt: now
  };

  saveHotels([hotel, ...getHotels()]);
  return hotel;
}

export function createReport(input: {
  hotelId: string;
  status: "yes" | "no" | "unsure";
  observedDate: string;
  breakfastContext: "buffet" | "other";
  note?: string;
  photoDataUrl?: string;
  photoUrl?: string;
  anonymousScoutId?: string;
}): BaconReport {
  const now = new Date().toISOString();
  const report: BaconReport = {
    id: createId(),
    hotelId: input.hotelId,
    userId: undefined,
    anonymousScoutId: input.anonymousScoutId ?? "local-demo-user",
    status: input.status,
    observedDate: input.observedDate,
    breakfastContext: input.breakfastContext,
    note: input.note?.trim() || undefined,
    photoDataUrl: input.photoDataUrl,
    photoUrl: input.photoUrl,
    photoStatus: input.photoDataUrl || input.photoUrl ? "attached" : "none",
    flaggedCount: 0,
    createdAt: now,
    updatedAt: now
  };

  saveReports([report, ...getReports()]);
  return report;
}

export function searchLocalHotels(query: string): HotelWithReports[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  return getHotelsWithReports().filter((hotel) => {
    return [hotel.name, hotel.city, hotel.country, hotel.address ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
}

export function findPossibleDuplicate(input: {
  name: string;
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
}): Hotel[] {
  const name = normalize(input.name);
  const city = normalize(input.city);
  const country = normalize(input.country);

  return getHotels().filter((hotel) => {
    const sameCity = normalize(hotel.city) === city;
    const sameCountry = normalize(hotel.country) === country;
    const nameSimilar = normalize(hotel.name).includes(name) || name.includes(normalize(hotel.name));
    const near =
      typeof input.latitude === "number" && typeof input.longitude === "number"
        ? distanceKm(input.latitude, input.longitude, hotel.latitude, hotel.longitude) < 1
        : false;

    return sameCountry && (sameCity || near) && nameSimilar;
  });
}


export interface LocalBaconBackup {
  version: 1;
  exportedAt: string;
  hotels: Hotel[];
  reports: BaconReport[];
}

export function exportLocalBaconData(): LocalBaconBackup {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    hotels: getHotels(),
    reports: getReports()
  };
}

export function importLocalBaconData(data: unknown): { hotels: number; reports: number } {
  if (!isBackupLike(data)) {
    throw new Error("This file does not look like a Do They Have Bacon backup.");
  }

  saveHotels(data.hotels);
  saveReports(data.reports);
  return { hotels: data.hotels.length, reports: data.reports.length };
}

export function seedDemoData(): { hotels: number; reports: number } {
  const now = new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const demoHotels: Hotel[] = [
    {
      id: "demo-grand-oslo",
      name: "Grand Hotel Oslo",
      address: "Karl Johans gate 31",
      city: "Oslo",
      country: "Norway",
      latitude: 59.9139,
      longitude: 10.7397,
      source: "manual",
      verificationStatus: "unverified",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "demo-baconless-london",
      name: "The Sorrowful Breakfast Inn",
      address: "Somewhere near the river",
      city: "London",
      country: "United Kingdom",
      latitude: 51.5072,
      longitude: -0.1276,
      source: "manual",
      verificationStatus: "unverified",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "demo-contested-berlin",
      name: "Hotel Frühstück Mystery",
      address: "Mitte",
      city: "Berlin",
      country: "Germany",
      latitude: 52.52,
      longitude: 13.405,
      source: "manual",
      verificationStatus: "unverified",
      createdAt: now,
      updatedAt: now
    }
  ];

  const demoReports: BaconReport[] = [
    makeDemoReport("demo-report-1", "demo-grand-oslo", "yes", today, "The bacon was present. The morning was saved."),
    makeDemoReport("demo-report-2", "demo-grand-oslo", "yes", yesterday, "Crispy enough for civilization."),
    makeDemoReport("demo-report-3", "demo-baconless-london", "no", today, "Only eggs, toast and a deep feeling of loss."),
    makeDemoReport("demo-report-4", "demo-baconless-london", "no", lastWeek, "No bacon detected. Scout returned hungry."),
    makeDemoReport("demo-report-5", "demo-contested-berlin", "yes", today, "Saw bacon. Or something with bacon confidence."),
    makeDemoReport("demo-report-6", "demo-contested-berlin", "no", yesterday, "I inspected the buffet twice. Nothing."),
    makeDemoReport("demo-report-7", "demo-contested-berlin", "yes", lastWeek, "There was bacon near the sausages.")
  ];

  const existingHotels = getHotels().filter((hotel) => !demoHotels.some((demo) => demo.id === hotel.id));
  const existingReports = getReports().filter((report) => !demoReports.some((demo) => demo.id === report.id));

  saveHotels([...demoHotels, ...existingHotels]);
  saveReports([...demoReports, ...existingReports]);

  return { hotels: demoHotels.length, reports: demoReports.length };
}

export function clearLocalBaconData(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(HOTELS_KEY);
  window.localStorage.removeItem(REPORTS_KEY);
}


function makeDemoReport(
  id: string,
  hotelId: string,
  status: "yes" | "no" | "unsure",
  observedDate: string,
  note: string
): BaconReport {
  const now = new Date().toISOString();
  return {
    id,
    hotelId,
    userId: undefined,
    anonymousScoutId: "demo-scout",
    status,
    observedDate,
    breakfastContext: "buffet",
    note,
    photoStatus: "none",
    flaggedCount: 0,
    createdAt: now,
    updatedAt: now
  };
}

function isBackupLike(data: unknown): data is LocalBaconBackup {
  if (!data || typeof data !== "object") return false;
  const record = data as Partial<LocalBaconBackup>;
  return Array.isArray(record.hotels) && Array.isArray(record.reports);
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9æøåäöüéèêáàâíìîóòôúùûñç ]/gi, "");
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}
