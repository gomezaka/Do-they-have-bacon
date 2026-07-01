import { NextResponse } from "next/server";
import { getUserFromAuthorizationHeader } from "@/lib/authServer";
import { hotelFormSchema } from "@/lib/validation";
import { assertRateLimit } from "@/server/rateLimit";
import { verifyTurnstileToken } from "@/server/turnstile";
import {
  createHotel,
  hasSupabaseServiceConfig,
  listHotelsWithReports
} from "@/server/supabaseRepository";

export async function GET(request: Request) {
  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json({ error: "Supabase is not configured on the server.", hotels: [] }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? undefined;

  try {
    const hotels = await listHotelsWithReports(query);
    return NextResponse.json({ hotels });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not read hotels." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = hotelFormSchema.parse(body);
    const user = await getUserFromAuthorizationHeader(request);
    const anonymousScoutId = parsed.anonymousScoutId || "anonymous-scout";

    assertRateLimit("hotel", request, user?.id ?? anonymousScoutId);
    await verifyTurnstileToken(parsed.turnstileToken, request);

    const hotel = await createHotel({
      ...parsed,
      source: body.source === "osm" ? "osm" : "manual",
      externalId: body.externalId,
      userId: user?.id,
      anonymousScoutId
    });
    return NextResponse.json({ hotel });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create hotel.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
