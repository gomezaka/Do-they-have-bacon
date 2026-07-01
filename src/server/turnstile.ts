export function isTurnstileEnabled(): boolean {
  return process.env.BACON_ENABLE_TURNSTILE === "true" && Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstileToken(token: unknown, request: Request): Promise<void> {
  if (!isTurnstileEnabled()) return;

  if (typeof token !== "string" || token.trim().length === 0) {
    throw new Error("Bacon shield check is required.");
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new Error("TURNSTILE_SECRET_KEY is missing.");

  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);

  const ip = request.headers.get("CF-Connecting-IP") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) formData.append("remoteip", ip);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: formData
  });

  const payload = (await response.json().catch(() => null)) as { success?: boolean; "error-codes"?: string[] } | null;

  if (!response.ok || !payload?.success) {
    const detail = payload?.["error-codes"]?.join(", ");
    throw new Error(detail ? `Bacon shield check failed: ${detail}` : "Bacon shield check failed.");
  }
}
