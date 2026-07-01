import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();

  if (!query || query.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const baseUrl = process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org";
  const params = new URLSearchParams({
    q: `${query} hotel`,
    format: "jsonv2",
    addressdetails: "1",
    limit: "8"
  });

  try {
    const response = await fetch(`${baseUrl}/search?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "DoTheyHaveBacon-MVP/0.1 local development"
      },
      next: { revalidate: 60 * 60 * 24 }
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Open map search failed.", results: [] }, { status: 502 });
    }

    const results = await response.json();
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Open map search failed.", results: [] }, { status: 502 });
  }
}
