import { describe, expect, it } from "vitest";

import { invitationEmail } from "@/emails/invitation";

describe("invitationEmail", () => {
  it("names the inviter and role, and links to /login", () => {
    const { text, html } = invitationEmail({
      inviterName: "Jamie Rivera",
      role: "admin",
      signInUrl: "https://example.com/login",
      expiresAt: new Date("2026-09-14T00:00:00Z"),
    });

    expect(text).toContain("Jamie Rivera");
    expect(text).toContain("an Admin");
    expect(text).toContain("https://example.com/login");
    expect(html).toContain('href="https://example.com/login"');
  });

  it("falls back to a generic inviter label when the name is unknown", () => {
    const { text } = invitationEmail({
      inviterName: null,
      role: "viewer",
      signInUrl: "https://example.com/login",
      expiresAt: new Date(),
    });

    expect(text).toContain("A team member");
    expect(text).toContain("a Viewer");
  });

  it("never mentions Google Drive access being requested", () => {
    const { text } = invitationEmail({
      inviterName: "Jamie",
      role: "viewer",
      signInUrl: "https://example.com/login",
      expiresAt: new Date(),
    });

    expect(text).toContain("never requests access to your Google Drive");
  });
});
