import { NextResponse } from "next/server";
import { getHotelWithReports, hasSupabaseServiceConfig } from "@/server/supabaseRepository";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json({ error: "Supabase is not configured on the server.", hotel: null }, { status: 503 });
  }

  try {
    const { id } = await params;
    const hotel = await getHotelWithReports(id);
    return NextResponse.json({ hotel });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not read hotel." }, { status: 500 });
  }
}
