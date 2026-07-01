import { NextResponse } from "next/server";
import { getUserFromAuthorizationHeader } from "@/lib/authServer";
import { reportApiSchema } from "@/lib/validation";
import { assertRateLimit } from "@/server/rateLimit";
import { verifyTurnstileToken } from "@/server/turnstile";
import { createReport, hasSupabaseServiceConfig } from "@/server/supabaseRepository";

export async function POST(request: Request) {
  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = reportApiSchema.parse(body);
    const user = await getUserFromAuthorizationHeader(request);
    const anonymousScoutId = parsed.anonymousScoutId || "anonymous-scout";

    assertRateLimit("report", request, user?.id ?? anonymousScoutId);
    await verifyTurnstileToken(parsed.turnstileToken, request);

    const report = await createReport({
      hotelId: parsed.hotelId,
      status: parsed.status,
      observedDate: parsed.observedDate,
      breakfastContext: parsed.breakfastContext,
      note: parsed.note,
      photoDataUrl: parsed.photoDataUrl,
      photoUrl: parsed.photoUrl,
      userId: user?.id,
      anonymousScoutId
    });
    return NextResponse.json({ report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create bacon report.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
