import { NextResponse } from "next/server";
import { getR2ConfigStatus } from "@/server/uploads";

export async function GET() {
  const status = getR2ConfigStatus();

  return NextResponse.json({
    configured: status.configured,
    missing: status.missing,
    bucketName: status.bucketName,
    publicUrl: status.publicUrl,
    endpoint: status.endpoint,
    localUploadsAllowed: status.localUploadsAllowed
  });
}
