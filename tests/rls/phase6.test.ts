import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  asSuperuser,
  createFixtureProfile,
  deleteFixtureProfile,
  type FixtureProfile,
  withRole,
} from "./helpers";

const createdUserIds: string[] = [];
const createdAssetIds: string[] = [];
const createdCollectionIds: string[] = [];

async function fixture(
  role: "viewer" | "admin" | "super_admin" = "viewer",
): Promise<FixtureProfile> {
  const profile = await createFixtureProfile(role);
  createdUserIds.push(profile.userId);
  return profile;
}

let timersTypeId: string;
let ks1Id: string;

beforeAll(async () => {
  await asSuperuser(async (client) => {
    const type = await client.query(
      "select id from public.asset_types where slug = 'timers'",
    );
    timersTypeId = type.rows[0].id;
    const ks = await client.query(
      "select id from public.key_stages where code = 'KS1'",
    );
    ks1Id = ks.rows[0].id;
  });
});

afterEach(async () => {
  if (createdCollectionIds.length > 0) {
    await asSuperuser((client) =>
      client.query(
        "delete from public.collections where id = any($1::uuid[])",
        [createdCollectionIds],
      ),
    );
    createdCollectionIds.length = 0;
  }

  if (createdAssetIds.length > 0) {
    await asSuperuser((client) =>
      client.query("delete from public.assets where id = any($1::uuid[])", [
        createdAssetIds,
      ]),
    );
    createdAssetIds.length = 0;
  }

  while (createdUserIds.length > 0) {
    const id = createdUserIds.pop();
    if (id) await deleteFixtureProfile(id);
  }
});

async function makePublishedAsset(title: string) {
  return asSuperuser(async (client) => {
    const result = await client.query(
      `insert into public.assets (title, asset_type_id, drive_png_url, preview_path)
       values ($1, $2, 'https://drive.google.com/file/d/abc/view', 'assets/x/display-x.webp')
       returning id`,
      [title, timersTypeId],
    );
    const id = result.rows[0].id as string;
    await client.query(
      "insert into public.asset_key_stages (asset_id, key_stage_id) values ($1, $2)",
      [id, ks1Id],
    );
    await client.query(
      "update public.assets set status = 'published' where id = $1",
      [id],
    );
    return id;
  });
}

async function makeCollection(
  ownerId: string,
  visibility: "personal" | "team",
) {
  return asSuperuser(async (client) => {
    const result = await client.query(
      `insert into public.collections (name, owner_id, visibility) values ('Test collection', $1, $2) returning id`,
      [ownerId, visibility],
    );
    return result.rows[0].id as string;
  });
}

describe("favorites", () => {
  it("lets a Viewer favorite an asset and see only their own favorites", async () => {
    const viewer = await fixture();
    const other = await fixture();
    const assetId = await makePublishedAsset("Favorite target");
    createdAssetIds.push(assetId);

    const insertResult = await withRole(viewer.userId, (client) =>
      client.query(
        "insert into public.favorites (profile_id, asset_id) values ($1, $2) returning asset_id",
        [viewer.userId, assetId],
      ),
    );
    expect(insertResult.rowCount).toBe(1);

    await asSuperuser((client) =>
      client.query(
        "insert into public.favorites (profile_id, asset_id) values ($1, $2)",
        [viewer.userId, assetId],
      ),
    );

    const ownRows = await withRole(viewer.userId, (client) =>
      client.query("select * from public.favorites where profile_id = $1", [
        viewer.userId,
      ]),
    );
    expect(ownRows.rowCount).toBe(1);

    const otherRows = await withRole(other.userId, (client) =>
      client.query("select * from public.favorites where profile_id = $1", [
        viewer.userId,
      ]),
    );
    expect(otherRows.rowCount).toBe(0);
  });

  it("denies a Viewer from favoriting on another user's behalf", async () => {
    const viewer = await fixture();
    const other = await fixture();
    const assetId = await makePublishedAsset("Favorite target 2");
    createdAssetIds.push(assetId);

    await expect(
      withRole(viewer.userId, (client) =>
        client.query(
          "insert into public.favorites (profile_id, asset_id) values ($1, $2)",
          [other.userId, assetId],
        ),
      ),
    ).rejects.toThrow();
  });
});

describe("collections visibility", () => {
  it("hides a personal collection from everyone but its owner and a Super Admin", async () => {
    const owner = await fixture();
    const other = await fixture();
    const superAdmin = await fixture("super_admin");
    const collectionId = await makeCollection(owner.userId, "personal");
    createdCollectionIds.push(collectionId);

    const asOwner = await withRole(owner.userId, (client) =>
      client.query("select * from public.collections where id = $1", [
        collectionId,
      ]),
    );
    expect(asOwner.rowCount).toBe(1);

    const asOther = await withRole(other.userId, (client) =>
      client.query("select * from public.collections where id = $1", [
        collectionId,
      ]),
    );
    expect(asOther.rowCount).toBe(0);

    const asSuper = await withRole(superAdmin.userId, (client) =>
      client.query("select * from public.collections where id = $1", [
        collectionId,
      ]),
    );
    expect(asSuper.rowCount).toBe(1);
  });

  it("shows a team collection to any active Viewer", async () => {
    const owner = await fixture();
    const other = await fixture();
    const collectionId = await makeCollection(owner.userId, "team");
    createdCollectionIds.push(collectionId);

    const rows = await withRole(other.userId, (client) =>
      client.query("select * from public.collections where id = $1", [
        collectionId,
      ]),
    );
    expect(rows.rowCount).toBe(1);
  });

  it("denies creating a collection owned by someone else", async () => {
    const viewer = await fixture();
    const other = await fixture();

    await expect(
      withRole(viewer.userId, (client) =>
        client.query(
          "insert into public.collections (name, owner_id, visibility) values ('Nope', $1, 'personal')",
          [other.userId],
        ),
      ),
    ).rejects.toThrow();
  });
});

describe("app.can_edit_collection", () => {
  it("is true for the owner, false for a stranger, true for an editing member, false for a view-only member", async () => {
    const owner = await fixture();
    const stranger = await fixture();
    const editingMember = await fixture();
    const viewOnlyMember = await fixture();
    const collectionId = await makeCollection(owner.userId, "team");
    createdCollectionIds.push(collectionId);

    await asSuperuser((client) =>
      client.query(
        "insert into public.collection_members (collection_id, profile_id, can_edit) values ($1, $2, true), ($1, $3, false)",
        [collectionId, editingMember.userId, viewOnlyMember.userId],
      ),
    );

    const check = (userId: string) =>
      withRole(userId, (client) =>
        client.query("select app.can_edit_collection($1) as can_edit", [
          collectionId,
        ]),
      );

    expect((await check(owner.userId)).rows[0].can_edit).toBe(true);
    expect((await check(stranger.userId)).rows[0].can_edit).toBe(false);
    expect((await check(editingMember.userId)).rows[0].can_edit).toBe(true);
    expect((await check(viewOnlyMember.userId)).rows[0].can_edit).toBe(false);
  });
});

describe("collection_items", () => {
  it("denies a non-editing viewer from adding an item, but allows an editing member", async () => {
    const owner = await fixture();
    const editingMember = await fixture();
    const stranger = await fixture();
    const collectionId = await makeCollection(owner.userId, "team");
    createdCollectionIds.push(collectionId);
    const assetId = await makePublishedAsset("Collection item target");
    createdAssetIds.push(assetId);

    await asSuperuser((client) =>
      client.query(
        "insert into public.collection_members (collection_id, profile_id, can_edit) values ($1, $2, true)",
        [collectionId, editingMember.userId],
      ),
    );

    await expect(
      withRole(stranger.userId, (client) =>
        client.query(
          "insert into public.collection_items (collection_id, asset_id) values ($1, $2)",
          [collectionId, assetId],
        ),
      ),
    ).rejects.toThrow();

    const result = await withRole(editingMember.userId, (client) =>
      client.query(
        "insert into public.collection_items (collection_id, asset_id) values ($1, $2) returning asset_id",
        [collectionId, assetId],
      ),
    );
    expect(result.rowCount).toBe(1);
  });

  it("drops an archived asset from a collection silently, matching D-11", async () => {
    const owner = await fixture();
    const collectionId = await makeCollection(owner.userId, "personal");
    createdCollectionIds.push(collectionId);
    const assetId = await makePublishedAsset("Later archived");
    createdAssetIds.push(assetId);

    await asSuperuser((client) =>
      client.query(
        "insert into public.collection_items (collection_id, asset_id) values ($1, $2)",
        [collectionId, assetId],
      ),
    );

    const beforeArchive = await withRole(owner.userId, (client) =>
      client.query(
        `select ci.asset_id from public.collection_items ci
         join public.assets a on a.id = ci.asset_id
         where ci.collection_id = $1`,
        [collectionId],
      ),
    );
    expect(beforeArchive.rowCount).toBe(1);

    await asSuperuser((client) =>
      client.query(
        "update public.assets set status = 'archived' where id = $1",
        [assetId],
      ),
    );

    const afterArchive = await withRole(owner.userId, (client) =>
      client.query(
        `select ci.asset_id from public.collection_items ci
         join public.assets a on a.id = ci.asset_id
         where ci.collection_id = $1`,
        [collectionId],
      ),
    );
    expect(afterArchive.rowCount).toBe(0);

    // The row itself is untouched — it's only the join to a
    // Viewer-invisible asset that drops.
    const rawRow = await asSuperuser((client) =>
      client.query(
        "select 1 from public.collection_items where collection_id = $1 and asset_id = $2",
        [collectionId, assetId],
      ),
    );
    expect(rawRow.rowCount).toBe(1);
  });
});

describe("collection_members", () => {
  it("denies an editing member (not the owner) from adding another member", async () => {
    const owner = await fixture();
    const editingMember = await fixture();
    const newMember = await fixture();
    const collectionId = await makeCollection(owner.userId, "team");
    createdCollectionIds.push(collectionId);

    await asSuperuser((client) =>
      client.query(
        "insert into public.collection_members (collection_id, profile_id, can_edit) values ($1, $2, true)",
        [collectionId, editingMember.userId],
      ),
    );

    await expect(
      withRole(editingMember.userId, (client) =>
        client.query(
          "insert into public.collection_members (collection_id, profile_id, can_edit) values ($1, $2, false)",
          [collectionId, newMember.userId],
        ),
      ),
    ).rejects.toThrow();
  });

  it("lets the owner add a member", async () => {
    const owner = await fixture();
    const newMember = await fixture();
    const collectionId = await makeCollection(owner.userId, "team");
    createdCollectionIds.push(collectionId);

    const result = await withRole(owner.userId, (client) =>
      client.query(
        "insert into public.collection_members (collection_id, profile_id, can_edit) values ($1, $2, false) returning profile_id",
        [collectionId, newMember.userId],
      ),
    );
    expect(result.rowCount).toBe(1);
  });
});

describe("app.find_profile_id_by_email", () => {
  it("resolves an exact, active email to a profile id for any active user", async () => {
    const viewer = await fixture();
    const target = await fixture();

    const result = await withRole(viewer.userId, (client) =>
      client.query("select app.find_profile_id_by_email($1) as id", [
        target.email,
      ]),
    );
    expect(result.rows[0].id).toBe(target.userId);
  });

  it("returns null for an email with no active account", async () => {
    const viewer = await fixture();

    const result = await withRole(viewer.userId, (client) =>
      client.query("select app.find_profile_id_by_email($1) as id", [
        "nobody-here@rls-test.local",
      ]),
    );
    expect(result.rows[0].id).toBeNull();
  });
});
