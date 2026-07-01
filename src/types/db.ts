export type BaconReportStatus = "yes" | "no" | "unsure";
export type BreakfastContext = "buffet" | "other";
export type HotelVerificationStatus = "unverified" | "verified" | "duplicate" | "hidden";
export type HotelSource = "manual" | "osm";
export type BaconStatusKey =
  | "bacon_confirmed"
  | "no_bacon_reported"
  | "contested"
  | "unscouted"
  | "stale"
  | "uncertain";

export interface Hotel {
  id: string;
  name: string;
  address?: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  source: HotelSource;
  externalId?: string;
  createdByUserId?: string;
  createdByAnonymousScoutId?: string;
  verificationStatus: HotelVerificationStatus;
  mergedIntoHotelId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BaconReport {
  id: string;
  hotelId: string;
  userId?: string;
  anonymousScoutId?: string;
  status: BaconReportStatus;
  observedDate: string;
  breakfastContext: BreakfastContext;
  note?: string;
  photoDataUrl?: string;
  photoUrl?: string;
  photoStatus: "none" | "attached" | "hidden";
  flaggedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface HotelWithReports extends Hotel {
  reports: BaconReport[];
}

export interface BaconStatusSummary {
  key: BaconStatusKey;
  label: string;
  emoji: string;
  description: string;
  confidenceLabel: "Unknown" | "Low" | "Medium" | "High";
  yesCount: number;
  noCount: number;
  unsureCount: number;
  lastReportedAt?: string;
}
