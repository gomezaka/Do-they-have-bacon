"use client";

import { getClientDataMode } from "@/lib/dataMode";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export interface BaconAuthUser {
  id: string;
  email?: string;
}

export function isSupabaseAuthEnabled(): boolean {
  return getClientDataMode() === "supabase";
}

export async function getCurrentAuthUser(): Promise<BaconAuthUser | null> {
  if (!isSupabaseAuthEnabled()) {
    return { id: "local-demo-user", email: "local@bacon.test" };
  }

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}

export async function getSupabaseAccessToken(): Promise<string | undefined> {
  if (!isSupabaseAuthEnabled()) return undefined;

  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

function getRuntimeOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export async function sendMagicLink(email: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const redirectTo = `${getRuntimeOrigin().replace(/\/$/, "")}/auth/callback`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo }
  });

  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  if (!isSupabaseAuthEnabled()) return;
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}
