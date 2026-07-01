const SCOUT_ID_KEY = "dthb.anonymous_scout_id";
const SCOUT_CREATED_KEY = "dthb.anonymous_scout_created_at";

export function getAnonymousScoutId(): string {
  if (typeof window === "undefined") return "server-anonymous-scout";

  const existing = window.localStorage.getItem(SCOUT_ID_KEY);
  if (existing) return existing;

  const id = `scout_${createShortId()}`;
  window.localStorage.setItem(SCOUT_ID_KEY, id);
  window.localStorage.setItem(SCOUT_CREATED_KEY, new Date().toISOString());
  return id;
}

export function getAnonymousScoutCreatedAt(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(SCOUT_CREATED_KEY) ?? undefined;
}

export function resetAnonymousScoutId(): string {
  if (typeof window === "undefined") return "server-anonymous-scout";
  const id = `scout_${createShortId()}`;
  window.localStorage.setItem(SCOUT_ID_KEY, id);
  window.localStorage.setItem(SCOUT_CREATED_KEY, new Date().toISOString());
  return id;
}

function createShortId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  }

  return Math.random().toString(36).slice(2, 12);
}
