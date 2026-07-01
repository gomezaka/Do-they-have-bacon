export interface NominatimPlace {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
  address?: {
    hotel?: string;
    tourism?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    country?: string;
  };
}

export async function searchOpenMapHotels(query: string): Promise<NominatimPlace[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const params = new URLSearchParams({ query: trimmed });
  const response = await fetch(`/api/geocode?${params.toString()}`, {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error("Open map search failed.");
  }

  const payload = (await response.json()) as { results?: NominatimPlace[]; error?: string };
  if (payload.error) throw new Error(payload.error);

  const results = payload.results ?? [];
  return results.filter((item) => {
    const haystack = `${item.display_name} ${item.type ?? ""} ${item.class ?? ""}`.toLowerCase();
    return haystack.includes("hotel") || haystack.includes("hostel") || haystack.includes("accommodation");
  });
}

export function nominatimToHotelDraft(place: NominatimPlace) {
  const address = place.address;
  const name = address?.hotel || address?.tourism || place.display_name.split(",")[0] || "Unnamed hotel";
  const city = address?.city || address?.town || address?.village || address?.municipality || "Unknown city";
  const country = address?.country || "Unknown country";

  return {
    name,
    address: place.display_name,
    city,
    country,
    latitude: Number(place.lat),
    longitude: Number(place.lon),
    source: "osm" as const,
    externalId: String(place.place_id)
  };
}
