import type { AuthContext } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export interface SessionProfile {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  ctx: AuthContext;
}

/**
 * Read-only session lookup for Server Components — returns null rather
 * than throwing when signed out or profile-less. Use
 * lib/auth/guards.ts in Server Actions instead, where failing closed
 * matters.
 */
export async function getCurrentProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url, role, status, is_owner")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    avatarUrl: profile.avatar_url,
    ctx: {
      role: profile.role,
      status: profile.status,
      isOwner: profile.is_owner,
    },
  };
}
