import { describe, expect, it } from "vitest";

import {
  type AuthContext,
  type Capability,
  canActOnAccount,
  canModifyOwnerProfile,
  permissions,
} from "@/lib/auth/permissions";

const viewer: AuthContext = {
  role: "viewer",
  status: "active",
  isOwner: false,
};
const admin: AuthContext = { role: "admin", status: "active", isOwner: false };
const superAdmin: AuthContext = {
  role: "super_admin",
  status: "active",
  isOwner: false,
};
const owner: AuthContext = {
  role: "super_admin",
  status: "active",
  isOwner: true,
};

// [capability, viewer, admin, super_admin, owner] — mirrors docs/BLUEPRINT.md §6 exactly.
// Owner mirrors Super Admin for every capability here; the two rows where
// they diverge (Modify the Owner account, Be suspended/demoted/deleted)
// are tested separately below, since they depend on the target, not just
// the actor.
const matrix: [Capability, boolean, boolean, boolean, boolean][] = [
  ["signIn", true, true, true, true],
  ["browsePublishedAssets", true, true, true, true],
  ["viewDraftAndArchivedAssets", false, true, true, true],
  ["search", true, true, true, true],
  ["openDriveLinks", true, true, true, true],
  ["seeAllKeyStages", true, true, true, true],
  ["useFavorites", true, true, true, true],
  ["usePersonalCollections", true, true, true, true],
  ["readTeamCollections", true, true, true, true],
  ["createTeamCollections", true, true, true, true],
  ["editTeamCollectionAsOwnerOrMember", true, true, true, true],
  ["editAnyTeamCollection", false, false, true, true],
  ["submitAssetRequest", true, true, true, true],
  ["seeOwnAndWatchedRequests", true, true, true, true],
  ["seeAllRequests", false, true, true, true],
  ["commentOnVisibleRequest", true, true, true, true],
  ["manageRequestAssignmentAndStatus", false, true, true, true],
  ["addRequestWatchers", false, true, true, true],
  ["attachFinishedAssetLinks", false, true, true, true],
  ["uploadAsset", false, true, true, true],
  ["editAssetMetadata", false, true, true, true],
  ["uploadOrReplacePreview", false, true, true, true],
  ["changeAssetLifecycle", false, true, true, true],
  ["accessPublishingQueue", false, true, true, true],
  ["spreadsheetBatchImport", false, true, true, true],
  ["manageCurriculum", false, true, true, true],
  ["manageAssetLessonUsage", false, true, true, true],
  ["manageCharacterProfiles", false, true, true, true],
  ["deactivateLesson", false, true, true, true],
  ["deactivateTaxonomyTerm", false, false, true, true],
  ["manageTaxonomiesAndTerms", false, false, true, true],
  ["createAssetTypes", false, false, true, true],
  ["manageInvitations", false, false, true, true],
  ["suspendOrReactivateUsers", false, false, true, true],
  ["assignViewerOrAdminRole", false, false, true, true],
  ["assignSuperAdminRole", false, false, false, false],
  ["viewAuditLog", false, false, true, true],
  ["manageSecuritySettings", false, false, true, true],
  ["hardDeleteAnything", false, false, false, false],
];

describe("permissions matrix", () => {
  it.each(matrix)(
    "%s",
    (
      capability,
      viewerExpected,
      adminExpected,
      superAdminExpected,
      ownerExpected,
    ) => {
      expect(permissions[capability](viewer)).toBe(viewerExpected);
      expect(permissions[capability](admin)).toBe(adminExpected);
      expect(permissions[capability](superAdmin)).toBe(superAdminExpected);
      expect(permissions[capability](owner)).toBe(ownerExpected);
    },
  );

  it("denies every capability to a suspended user, regardless of role", () => {
    const suspended: AuthContext = {
      role: "super_admin",
      status: "suspended",
      isOwner: true,
    };
    for (const capability of Object.keys(permissions) as Capability[]) {
      expect(permissions[capability](suspended)).toBe(false);
    }
  });
});

describe("Owner-account protections", () => {
  it("lets the Owner modify their own profile", () => {
    expect(canModifyOwnerProfile(owner, true)).toBe(true);
  });

  it("refuses everyone else, including a Super Admin, from modifying the Owner's profile", () => {
    expect(canModifyOwnerProfile(superAdmin, true)).toBe(false);
    expect(canModifyOwnerProfile(admin, true)).toBe(false);
  });

  it("does not apply the Owner exemption to a non-Owner target", () => {
    expect(canModifyOwnerProfile(owner, false)).toBe(false);
  });

  it("refuses to act on the Owner's account (suspend/demote/remove)", () => {
    expect(canActOnAccount(true)).toBe(false);
  });

  it("allows acting on a non-Owner account", () => {
    expect(canActOnAccount(false)).toBe(true);
  });
});
