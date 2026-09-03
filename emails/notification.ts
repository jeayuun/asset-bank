export interface NotificationEmailParams {
  title: string;
  body: string | null;
  url: string;
}

/**
 * The one Phase 8 email template (docs/BLUEPRINT.md §5.7). Plain text +
 * minimal HTML, matching emails/invitation.ts — react-email or similar
 * isn't in the accepted stack (docs/PRODUCT_SPEC.md §11).
 */
export function notificationEmail({
  title,
  body,
  url,
}: NotificationEmailParams) {
  const subject = title;

  const text = `${title}${body ? `\n\n${body}` : ""}\n\nView it in Asset Bank: ${url}`;

  const html = `
    <p><strong>${title}</strong></p>
    ${body ? `<p>${body}</p>` : ""}
    <p><a href="${url}">View it in Asset Bank</a></p>
  `.trim();

  return { subject, text, html };
}
