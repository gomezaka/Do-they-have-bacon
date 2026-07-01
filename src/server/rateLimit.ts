type RateLimitKind = "hotel" | "report" | "upload";

const WINDOWS: Record<RateLimitKind, { limit: number; windowMs: number; label: string }> = {
  hotel: { limit: 8, windowMs: 24 * 60 * 60 * 1000, label: "manual hotel additions" },
  report: { limit: 30, windowMs: 60 * 60 * 1000, label: "bacon reports" },
  upload: { limit: 20, windowMs: 60 * 60 * 1000, label: "photo uploads" }
};

const buckets = new Map<string, number[]>();

export function assertRateLimit(kind: RateLimitKind, request: Request, scoutId?: string): void {
  const rule = WINDOWS[kind];
  const now = Date.now();
  const key = `${kind}:${scoutId || getRequestIdentity(request)}`;
  const existing = buckets.get(key) ?? [];
  const recent = existing.filter((timestamp) => now - timestamp < rule.windowMs);

  if (recent.length >= rule.limit) {
    throw new Error(`Too many ${rule.label}. Let the bacon map cool down and try again later.`);
  }

  recent.push(now);
  buckets.set(key, recent);
}

function getRequestIdentity(request: Request): string {
  const ip = request.headers.get("CF-Connecting-IP") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const userAgent = request.headers.get("user-agent") ?? "unknown-agent";
  return `${ip || "unknown-ip"}:${userAgent.slice(0, 80)}`;
}
