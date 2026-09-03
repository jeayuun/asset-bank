"use server";

import { revalidatePath } from "next/cache";
import { Resend } from "resend";

import { invitationEmail } from "@/emails/invitation";
import { requireRole } from "@/lib/auth/guards";
import { defaultExpiryDate } from "@/lib/auth/invitations";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  createInvitationSchema,
  invitationIdSchema,
  invitationRoleSchema,
} from "@/lib/validation/invitations";

async function sendInvitationEmail(params: {
  email: string;
  role: "viewer" | "admin";
  inviterName: string | null;
  expiresAt: Date;
}) {
  const resend = new Resend(env.RESEND_API_KEY);
  const { subject, text, html } = invitationEmail({
    inviterName: params.inviterName,
    role: params.role,
    signInUrl: `${env.NEXT_PUBLIC_SITE_URL}/login`,
    expiresAt: params.expiresAt,
  });

  const { error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: params.email,
    subject,
    text,
    html,
  });

  return error;
}

export async function createInvitation(input: unknown) {
  const { userId } = await requireRole("super_admin");
  const parsed = createInvitationSchema.parse(input);

  const supabase = await createClient();
  const { data: inviter } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  const expiresAt = defaultExpiryDate();

  const { error } = await supabase.from("invitations").insert({
    email: parsed.email,
    role: parsed.role,
    default_key_stage_id: parsed.defaultKeyStageId ?? null,
    invited_by: userId,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }

  // Email delivery failing must never roll back the invitation record
  // (docs/DECISIONS.md D-12) — the row above already exists regardless.
  const emailError = await sendInvitationEmail({
    email: parsed.email,
    role: parsed.role,
    inviterName: inviter?.full_name ?? null,
    expiresAt,
  });

  if (emailError) {
    console.error("Invitation email failed to send:", emailError);
  }

  revalidatePath("/super/invitations");
}

export async function revokeInvitation(input: unknown) {
  await requireRole("super_admin");
  const { invitationId } = invitationIdSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId)
    .eq("status", "pending");

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/super/invitations");
}

export async function resendInvitation(input: unknown) {
  await requireRole("super_admin");
  const { invitationId } = invitationIdSchema.parse(input);

  const supabase = await createClient();
  const { data: invitation, error: fetchError } = await supabase
    .from("invitations")
    .select("email, role")
    .eq("id", invitationId)
    .eq("status", "pending")
    .maybeSingle();

  if (fetchError || !invitation) {
    throw new Error(
      fetchError?.message ?? "Invitation not found or not pending",
    );
  }

  const expiresAt = defaultExpiryDate();

  const { error: updateError } = await supabase
    .from("invitations")
    .update({ expires_at: expiresAt.toISOString() })
    .eq("id", invitationId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const emailError = await sendInvitationEmail({
    email: invitation.email,
    // The invitations.role CHECK constraint guarantees this is never
    // 'super_admin' at the DB level, but the generated type doesn't know
    // about CHECK constraints — parse to narrow it for real.
    role: invitationRoleSchema.parse(invitation.role),
    inviterName: null,
    expiresAt,
  });

  if (emailError) {
    console.error("Invitation email failed to send:", emailError);
  }

  revalidatePath("/super/invitations");
}
