import { describe, expect, it } from "vitest";

import {
  defaultExpiryDate,
  gmailAliasWarning,
  INVITATION_EXPIRY_DAYS,
} from "@/lib/auth/invitations";

describe("defaultExpiryDate", () => {
  it("adds the proposed expiry window", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    const expires = defaultExpiryDate(from);
    const daysApart =
      (expires.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysApart).toBe(INVITATION_EXPIRY_DAYS);
  });
});

describe("gmailAliasWarning", () => {
  it("warns on a dotted Gmail local part", () => {
    expect(gmailAliasWarning("first.last@gmail.com")).not.toBeNull();
  });

  it("warns on a plus-tagged Gmail local part", () => {
    expect(gmailAliasWarning("person+tag@gmail.com")).not.toBeNull();
  });

  it("does not warn on a plain Gmail address", () => {
    expect(gmailAliasWarning("person@gmail.com")).toBeNull();
  });

  it("does not warn on a non-Gmail domain, even with a dot", () => {
    expect(gmailAliasWarning("first.last@example.com")).toBeNull();
  });

  it("does not throw on a malformed address", () => {
    expect(gmailAliasWarning("not-an-email")).toBeNull();
  });
});
