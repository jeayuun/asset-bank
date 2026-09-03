export interface InvitationEmailParams {
  inviterName: string | null;
  role: "viewer" | "admin";
  signInUrl: string;
  expiresAt: Date;
}

/**
 * The one Phase 1 email template (docs/BLUEPRINT.md §13 "Email"). Plain
 * text + minimal HTML — no react-email or similar isn't in the accepted
 * stack (docs/PRODUCT_SPEC.md §11).
 */
export function invitationEmail({
  inviterName,
  role,
  signInUrl,
  expiresAt,
}: InvitationEmailParams) {
  const subject = "You've been invited to Asset Bank";
  const roleLabel = role === "admin" ? "an Admin" : "a Viewer";
  const inviter = inviterName ?? "A team member";
  const expiryLabel = expiresAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const text = `${inviter} invited you to Asset Bank as ${roleLabel}.

Sign in with the Google account this invitation was sent to: ${signInUrl}

This invitation expires on ${expiryLabel}. Asset Bank never requests access to your Google Drive.`;

  const html = `
    <p>${inviter} invited you to Asset Bank as ${roleLabel}.</p>
    <p><a href="${signInUrl}">Sign in with the Google account this invitation was sent to</a></p>
    <p>This invitation expires on ${expiryLabel}. Asset Bank never requests access to your Google Drive.</p>
  `.trim();

  return { subject, text, html };
}
