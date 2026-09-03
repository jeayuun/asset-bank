export type Role = "viewer" | "admin" | "super_admin";
export type ProfileStatus = "active" | "suspended";

export interface AuthContext {
  role: Role;
  status: ProfileStatus;
  isOwner: boolean;
}

function isActive(ctx: AuthContext): boolean {
  return ctx.status === "active";
}

function atLeastAdmin(ctx: AuthContext): boolean {
  return isActive(ctx) && (ctx.role === "admin" || ctx.role === "super_admin");
}

function isSuperAdmin(ctx: AuthContext): boolean {
  return isActive(ctx) && ctx.role === "super_admin";
}

/**
 * The role/capability matrix (docs/BLUEPRINT.md §6, docs/PRODUCT_SPEC.md §3).
 * UI guards call these; they do not reimplement the logic (CLAUDE.md §7).
 * The database enforces authorization independently regardless of what
 * this module returns (§4.3) — most notably, ownership/membership scoping
 * ("Own", "Own / member" in the matrix) is not encoded here. These
 * functions only answer "can this role attempt the action at all"; which
 * specific rows are visible or editable is a data-layer (RLS) question.
 * "Owner" is not a fourth role value — it is role === 'super_admin' with
 * is_owner === true, and only changes the answer for the two functions at
 * the bottom of this file.
 */
export const permissions = {
  signIn: isActive,
  browsePublishedAssets: isActive,
  viewDraftAndArchivedAssets: atLeastAdmin,
  search: isActive,
  openDriveLinks: isActive,
  seeAllKeyStages: isActive,
  useFavorites: isActive,
  usePersonalCollections: isActive,
  readTeamCollections: isActive,
  createTeamCollections: isActive,
  editTeamCollectionAsOwnerOrMember: isActive,
  editAnyTeamCollection: isSuperAdmin,
  submitAssetRequest: isActive,
  seeOwnAndWatchedRequests: isActive,
  seeAllRequests: atLeastAdmin,
  commentOnVisibleRequest: isActive,
  manageRequestAssignmentAndStatus: atLeastAdmin,
  addRequestWatchers: atLeastAdmin,
  attachFinishedAssetLinks: atLeastAdmin,
  uploadAsset: atLeastAdmin,
  editAssetMetadata: atLeastAdmin,
  uploadOrReplacePreview: atLeastAdmin,
  changeAssetLifecycle: atLeastAdmin,
  accessPublishingQueue: atLeastAdmin,
  spreadsheetBatchImport: atLeastAdmin,
  manageCurriculum: atLeastAdmin,
  manageAssetLessonUsage: atLeastAdmin,
  manageCharacterProfiles: atLeastAdmin,
  deactivateLesson: atLeastAdmin,
  deactivateTaxonomyTerm: isSuperAdmin,
  manageTaxonomiesAndTerms: isSuperAdmin,
  createAssetTypes: isSuperAdmin,
  manageInvitations: isSuperAdmin,
  suspendOrReactivateUsers: isSuperAdmin,
  assignViewerOrAdminRole: isSuperAdmin,
  /** Protected manual database operation — never true via the app, for anyone. */
  assignSuperAdminRole: () => false,
  viewAuditLog: isSuperAdmin,
  manageSecuritySettings: isSuperAdmin,
  /** No hard delete exists in the app, for any role (docs/DECISIONS.md D-05). */
  hardDeleteAnything: () => false,
} as const satisfies Record<string, (ctx: AuthContext) => boolean>;

export type Capability = keyof typeof permissions;

/** Only the Owner may modify the Owner's own profile (name, default Key Stage). */
export function canModifyOwnerProfile(
  ctx: AuthContext,
  targetIsOwner: boolean,
): boolean {
  if (!targetIsOwner) return false;
  return ctx.isOwner;
}

/** The Owner can never be suspended, demoted, or removed through any path. */
export function canActOnAccount(targetIsOwner: boolean): boolean {
  return !targetIsOwner;
}
