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

async function fixture(role: "viewer" | "admin"): Promise<FixtureProfile> {
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

async function publishedAsset(
  title: string,
  description: string | null = null,
) {
  return asSuperuser(async (client) => {
    const result = await client.query(
      `insert into public.assets (title, description, asset_type_id, drive_png_url, preview_path)
       values ($1, $2, $3, 'https://drive.google.com/file/d/abc/view', 'assets/x/display-x.webp')
       returning id`,
      [title, description, timersTypeId],
    );
    const id = result.rows[0].id;
    await client.query(
      "insert into public.asset_key_stages (asset_id, key_stage_id) values ($1, $2)",
      [id, ks1Id],
    );
    await client.query(
      "update public.assets set status = 'published' where id = $1",
      [id],
    );
    return id as string;
  });
}

describe("catalog search", () => {
  it("finds a published asset by a title word (websearch full-text)", async () => {
    const viewer = await fixture("viewer");
    const id = await publishedAsset(`Blue timer ${crypto.randomUUID()}`);
    createdAssetIds.push(id);

    const rows = await withRole(viewer.userId, (client) =>
      client.query(
        "select id from public.assets where status = 'published' and search_tsv @@ websearch_to_tsquery('english', 'blue timer')",
      ),
    );

    expect(rows.rows.some((r) => r.id === id)).toBe(true);
  });

  it("matches on description text too", async () => {
    const viewer = await fixture("viewer");
    const id = await publishedAsset(
      `Unrelated title ${crypto.randomUUID()}`,
      "A whimsical clockwork gizmo",
    );
    createdAssetIds.push(id);

    const rows = await withRole(viewer.userId, (client) =>
      client.query(
        "select id from public.assets where status = 'published' and search_tsv @@ websearch_to_tsquery('english', 'clockwork')",
      ),
    );

    expect(rows.rows.some((r) => r.id === id)).toBe(true);
  });
});

describe("catalog facet filtering", () => {
  it("narrows results to assets tagged with a given Key Stage", async () => {
    const viewer = await fixture("viewer");
    const id = await publishedAsset(`Facet test ${crypto.randomUUID()}`);
    createdAssetIds.push(id);

    const rows = await withRole(viewer.userId, (client) =>
      client.query(
        `select a.id from public.assets a
         join public.asset_key_stages aks on aks.asset_id = a.id
         where a.status = 'published' and aks.key_stage_id = $1 and a.id = $2`,
        [ks1Id, id],
      ),
    );

    expect(rows.rowCount).toBe(1);
  });
});

describe("archived assets stay invisible to a Viewer regardless of query shape", () => {
  it("excludes an archived asset from a search that would otherwise match it", async () => {
    const viewer = await fixture("viewer");
    const id = await publishedAsset(`Archived widget ${crypto.randomUUID()}`);
    createdAssetIds.push(id);

    // asSuperuser, not withRole, for the archive step: withRole always
    // rolls back its transaction, so an admin archiving through it would
    // never actually persist — the same class of bug fixed in
    // phase1.test.ts's suspend/reactivate test and phase2.test.ts's merge
    // test. Admin's ability to archive is already covered by
    // phase3.test.ts; this test only needs the row to actually be
    // archived before checking Viewer visibility.
    await asSuperuser((client) =>
      client.query(
        "update public.assets set status = 'archived' where id = $1",
        [id],
      ),
    );

    const rows = await withRole(viewer.userId, (client) =>
      client.query(
        "select id from public.assets where search_tsv @@ websearch_to_tsquery('english', 'archived widget')",
      ),
    );

    expect(rows.rows.some((r) => r.id === id)).toBe(false);
  });

  it("excludes an archived asset from a Key-Stage-filtered query", async () => {
    const viewer = await fixture("viewer");
    const id = await publishedAsset(
      `Archived by key stage ${crypto.randomUUID()}`,
    );
    createdAssetIds.push(id);

    await asSuperuser((client) =>
      client.query(
        "update public.assets set status = 'archived' where id = $1",
        [id],
      ),
    );

    const rows = await withRole(viewer.userId, (client) =>
      client.query(
        `select a.id from public.assets a
         join public.asset_key_stages aks on aks.asset_id = a.id
         where aks.key_stage_id = $1 and a.id = $2`,
        [ks1Id, id],
      ),
    );

    expect(rows.rowCount).toBe(0);
  });

  it("still lets an Admin see the archived asset via the same query shape", async () => {
    const admin = await fixture("admin");
    const id = await publishedAsset(
      `Admin sees archived ${crypto.randomUUID()}`,
    );
    createdAssetIds.push(id);

    await asSuperuser((client) =>
      client.query(
        "update public.assets set status = 'archived' where id = $1",
        [id],
      ),
    );

    const rows = await withRole(admin.userId, (client) =>
      client.query(
        "select id from public.assets where search_tsv @@ websearch_to_tsquery('english', 'archived')",
      ),
    );

    expect(rows.rows.some((r) => r.id === id)).toBe(true);
  });
});
