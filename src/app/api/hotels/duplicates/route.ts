import { NextResponse } from "next/server";
import { findPossibleDuplicates, hasSupabaseServiceConfig } from "@/server/supabaseRepository";

export async function GET(request: Request) {
  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json({ error: "Supabase is not configured on the server.", hotels: [] }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const latitudeRaw = searchParams.get("latitude");
  const longitudeRaw = searchParams.get("longitude");

  try {
    const hotels = await findPossibleDuplicates({
      name: searchParams.get("name") ?? "",
      city: searchParams.get("city") ?? "",
      country: searchParams.get("country") ?? "",
      latitude: latitudeRaw ? Number(latitudeRaw) : undefined,
      longitude: longitudeRaw ? Number(longitudeRaw) : undefined
    });
    return NextResponse.json({ hotels });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not check duplicates.", hotels: [] }, { status: 500 });
  }
}
