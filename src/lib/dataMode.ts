export type BaconDataMode = "local" | "supabase";

export function getClientDataMode(): BaconDataMode {
  const requested = process.env.NEXT_PUBLIC_DATA_MODE?.trim().toLowerCase();
  const hasSupabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  if (requested === "supabase" && hasSupabase) return "supabase";
  return "local";
}

export function getDataModeLabel(mode: BaconDataMode = getClientDataMode()) {
  return mode === "supabase" ? "Supabase prototype database" : "Browser localStorage";
}
