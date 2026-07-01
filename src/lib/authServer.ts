import { getSupabaseServiceClient } from "@/lib/supabaseServer";

export interface ServerAuthUser {
  id: string;
  email?: string;
}

export async function getUserFromAuthorizationHeader(request: Request): Promise<ServerAuthUser | null> {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const token = match[1];
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}

export async function requireAuthenticatedUser(request: Request): Promise<ServerAuthUser> {
  const user = await getUserFromAuthorizationHeader(request);
  if (!user) {
    throw new Error("A signed-in user was required for this optional account-only action.");
  }
  return user;
}
