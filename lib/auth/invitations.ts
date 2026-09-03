// Proposed default, pending owner confirmation (docs/PROGRESS.md open
// blocker #4 / docs/BLUEPRINT.md §17.4).
export const INVITATION_EXPIRY_DAYS = 14;

export function defaultExpiryDate(from: Date = new Date()): Date {
  const expires = new Date(from);
  expires.setUTCDate(expires.getUTCDate() + INVITATION_EXPIRY_DAYS);
  return expires;
}

/**
 * docs/BLUEPRINT.md §16 risk 3: dots and plus-addressing make one Gmail
 * account match many address strings. Warn, don't block — the invitation
 * must still use the exact address the person signs in with.
 */
export function gmailAliasWarning(email: string): string | null {
  const [local, domain] = email.split("@");
  if (!local || !domain) return null;
  if (!/^(gmail\.com|googlemail\.com)$/i.test(domain)) return null;
  if (local.includes(".") || local.includes("+")) {
    return "This looks like a Gmail address with a dot or a plus sign. Google treats dotted and plus-tagged variants as the same account, but this app does not normalize them — use the exact address the person signs in with.";
  }
  return null;
}
