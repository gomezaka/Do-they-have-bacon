import { getSupabaseAccessToken } from "@/lib/authClient";
import { getClientDataMode } from "@/lib/dataMode";
import { getAnonymousScoutId } from "@/lib/anonymousScout";

export interface PhotoEvidenceUploadResult {
  photoDataUrl?: string;
  photoUrl?: string;
  storage: "local" | "r2";
}

export async function preparePhotoEvidence(dataUrl?: string): Promise<PhotoEvidenceUploadResult> {
  if (!dataUrl) return { storage: "local" };

  if (!shouldTryR2Upload()) {
    return { photoDataUrl: dataUrl, storage: "local" };
  }

  const blob = await dataUrlToBlob(dataUrl);
  const token = await getSupabaseAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const presign = await fetch("/api/uploads/r2-presign", {
    method: "POST",
    headers,
    body: JSON.stringify({
      fileName: "bacon-evidence.jpg",
      contentType: blob.type || "image/jpeg",
      sizeBytes: blob.size,
      anonymousScoutId: getAnonymousScoutId()
    })
  });

  if (presign.status === 503) {
    return { photoDataUrl: dataUrl, storage: "local" };
  }

  const payload = await presign.json().catch(() => ({}));
  if (!presign.ok) {
    const message = typeof payload.error === "string" ? payload.error : "Could not prepare Cloudflare R2 upload.";
    throw new Error(message);
  }

  const upload = payload.upload as {
    uploadUrl: string;
    publicUrl: string;
    headers: Record<string, string>;
  };

  const put = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: upload.headers,
    body: blob
  });

  if (!put.ok) {
    throw new Error("Cloudflare R2 rejected the photo upload. Check bucket CORS and R2 credentials.");
  }

  return { photoUrl: upload.publicUrl, storage: "r2" };
}

function shouldTryR2Upload(): boolean {
  if (process.env.NEXT_PUBLIC_ENABLE_R2_UPLOADS === "true") return true;
  return getClientDataMode() === "supabase";
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}
