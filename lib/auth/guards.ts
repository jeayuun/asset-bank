import "server-only";

import {
  type AuthContext,
  type Capability,
  type Role,
  permissions,
} from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export class AuthorizationError extends Error {
  constructor(message = "Not authorized") {
    super(message);
    this.name = "AuthorizationError";
  }
}

interface AuthResult {
  userId: string;
  ctx: AuthContext;
}

async function loadContext(): Promise<AuthResult | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status, is_owner")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  return {
    userId: user.id,
    ctx: {
      role: profile.role,
      status: profile.status,
      isOwner: profile.is_owner,
    },
  };
}

/**
 * Fresh profile read before any sensitive Server Action write — fails
 * closed (docs/BLUEPRINT.md §4.3). Never trusts a cached or JWT-derived
 * status (docs/DECISIONS.md D-01).
 */
export async function requireActive(): Promise<AuthResult> {
  const result = await loadContext();
  if (!result || result.ctx.status !== "active") {
    throw new AuthorizationError("Sign-in required");
  }
  return result;
}

const ROLE_RANK: Record<Role, number> = { viewer: 0, admin: 1, super_admin: 2 };

export async function requireRole(minRole: Role): Promise<AuthResult> {
  const result = await requireActive();
  if (ROLE_RANK[result.ctx.role] < ROLE_RANK[minRole]) {
    throw new AuthorizationError(`Requires role: ${minRole}`);
  }
  return result;
}

/** Prefer this over requireRole() when the check isn't a plain role threshold. */
export async function requireCapability(
  capability: Capability,
): Promise<AuthResult> {
  const result = await requireActive();
  if (!permissions[capability](result.ctx)) {
    throw new AuthorizationError(`Missing capability: ${capability}`);
  }
  return result;
}
