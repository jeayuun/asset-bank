"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { assignRoleSchema, targetUserSchema } from "@/lib/validation/users";

export async function setUserRole(input: unknown) {
  await requireRole("super_admin");
  const { targetId, role } = assignRoleSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase.schema("app").rpc("set_user_role", {
    p_target: targetId,
    p_role: role,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/super/users");
}

export async function suspendUser(input: unknown) {
  await requireRole("super_admin");
  const { targetId } = targetUserSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase
    .schema("app")
    .rpc("suspend_user", { p_target: targetId });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/super/users");
}

export async function reactivateUser(input: unknown) {
  await requireRole("super_admin");
  const { targetId } = targetUserSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase.schema("app").rpc("reactivate_user", {
    p_target: targetId,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/super/users");
}
