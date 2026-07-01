import { NextResponse } from "next/server";
import { getUserFromAuthorizationHeader } from "@/lib/authServer";
import { assertRateLimit } from "@/server/rateLimit";
import { createR2PresignedPutUrl, getR2ConfigStatus } from "@/server/uploads";

export async function POST(request: Request) {
  const status = getR2ConfigStatus();

  if (!status.configured) {
    return NextResponse.json(
      {
        error: "Cloudflare R2 is not fully configured.",
        missing: status.missing
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const user = await getUserFromAuthorizationHeader(request);
    const anonymousScoutId = typeof body.anonymousScoutId === "string" && body.anonymousScoutId.trim()
      ? body.anonymousScoutId.trim().slice(0, 80)
      : "anonymous-scout";
    const actorId = user?.id ?? anonymousScoutId;

    assertRateLimit("upload", request, actorId);

    const upload = createR2PresignedPutUrl({
      fileName: typeof body.fileName === "string" ? body.fileName : undefined,
      contentType: String(body.contentType ?? ""),
      sizeBytes: Number(body.sizeBytes ?? 0),
      userId: actorId
    });

    return NextResponse.json({ upload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not prepare R2 upload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
