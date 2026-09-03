import type { Client } from "pg";
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
const createdTaxonomyTermIds: string[] = [];
const createdAssetTypeIds: string[] = [];

async function fixture(
  role: "viewer" | "admin" | "super_admin",
  opts?: { status?: "active" | "suspended" },
): Promise<FixtureProfile> {
  const profile = await createFixtureProfile(role, opts);
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
  // Assets first: asset_taxonomy_terms cascades from assets, and
  // taxonomy_terms has ON DELETE RESTRICT from asset_taxonomy_terms, so
  // deleting a merge target/source term before its still-referencing
  // asset is deleted fails the FK.
  if (createdAssetIds.length > 0) {
    await asSuperuser((client) =>
      client.query("delete from public.assets where id = any($1::uuid[])", [
        createdAssetIds,
      ]),
    );
    createdAssetIds.length = 0;
  }

  if (createdAssetTypeIds.length > 0) {
    await asSuperuser((client) =>
      client.query(
        "delete from public.asset_types where id = any($1::uuid[])",
        [createdAssetTypeIds],
      ),
    );
    createdAssetTypeIds.length = 0;
  }

  if (createdTaxonomyTermIds.length > 0) {
    await asSuperuser((client) =>
      client.query(
        "delete from public.taxonomy_terms where id = any($1::uuid[])",
        [createdTaxonomyTermIds],
      ),
    );
    createdTaxonomyTermIds.length = 0;
  }

  while (createdUserIds.length > 0) {
    const id = createdUserIds.pop();
    if (id) await deleteFixtureProfile(id);
  }
});

async function makeDraftAsset(client: Client) {
  const result = await client.query(
    `insert into public.assets (title, asset_type_id, drive_png_url)
     values ('RLS test asset', $1, 'https://drive.google.com/file/d/abc/view')
     returning id`,
    [timersTypeId],
  );
  return result.rows[0].id as string;
}

describe("asset_types", () => {
  it("denies an Admin from creating an asset type (Super Admin only)", async () => {
    const admin = await fixture("admin");

    await expect(
      withRole(admin.userId, (client) =>
        client.query(
          "insert into public.asset_types (slug, name) values ($1, 'Nope')",
          [`nope-${crypto.randomUUID()}`],
        ),
      ),
    ).rejects.toThrow();
  });

  it("lets a Super Admin create an asset type", async () => {
    const superAdmin = await fixture("super_admin");
    const slug = `new-type-${crypto.randomUUID()}`;

    const result = await withRole(superAdmin.userId, (client) =>
      client.query(
        "insert into public.asset_types (slug, name) values ($1, 'New Type') returning id",
        [slug],
      ),
    );

    createdAssetTypeIds.push(result.rows[0].id);
    expect(result.rowCount).toBe(1);
  });

  it("keeps a system asset type's slug immutable and non-deactivatable", async () => {
    await expect(
      asSuperuser((client) =>
        client.query(
          "update public.asset_types set slug = 'timerz' where slug = 'timers'",
        ),
      ),
    ).rejects.toThrow();

    await expect(
      asSuperuser((client) =>
        client.query(
          "update public.asset_types set is_active = false where slug = 'timers'",
        ),
      ),
    ).rejects.toThrow();
  });
});

describe("assets visibility", () => {
  it("hides a draft asset from a Viewer but shows it to an Admin", async () => {
    const viewer = await fixture("viewer");
    const admin = await fixture("admin");
    const assetId = await asSuperuser((client) => makeDraftAsset(client));
    createdAssetIds.push(assetId);

    const asViewer = await withRole(viewer.userId, (client) =>
      client.query("select * from public.assets where id = $1", [assetId]),
    );
    expect(asViewer.rowCount).toBe(0);

    const asAdmin = await withRole(admin.userId, (client) =>
      client.query("select * from public.assets where id = $1", [assetId]),
    );
    expect(asAdmin.rowCount).toBe(1);
  });

  it("denies a Viewer from creating an asset", async () => {
    const viewer = await fixture("viewer");

    await expect(
      withRole(viewer.userId, (client) =>
        client.query(
          "insert into public.assets (title, asset_type_id, drive_png_url) values ('Nope', $1, 'https://drive.google.com/file/d/x/view')",
          [timersTypeId],
        ),
      ),
    ).rejects.toThrow();
  });

  it("shows a published asset to a Viewer", async () => {
    const viewer = await fixture("viewer");
    const assetId = await asSuperuser(async (client) => {
      const id = await makeDraftAsset(client);
      await client.query(
        "update public.assets set preview_path = 'assets/x/display-x.webp' where id = $1",
        [id],
      );
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
    createdAssetIds.push(assetId);

    const rows = await withRole(viewer.userId, (client) =>
      client.query("select * from public.assets where id = $1", [assetId]),
    );
    expect(rows.rowCount).toBe(1);
  });
});

describe("publish preconditions", () => {
  it("refuses to publish without a preview_path", async () => {
    const assetId = await asSuperuser((client) => makeDraftAsset(client));
    createdAssetIds.push(assetId);

    await expect(
      asSuperuser((client) =>
        client.query(
          "update public.assets set status = 'published' where id = $1",
          [assetId],
        ),
      ),
    ).rejects.toThrow(/preview_path/);
  });

  it("refuses to publish without a Key Stage", async () => {
    const assetId = await asSuperuser(async (client) => {
      const id = await makeDraftAsset(client);
      await client.query(
        "update public.assets set preview_path = 'assets/x/display-x.webp' where id = $1",
        [id],
      );
      return id;
    });
    createdAssetIds.push(assetId);

    await expect(
      asSuperuser((client) =>
        client.query(
          "update public.assets set status = 'published' where id = $1",
          [assetId],
        ),
      ),
    ).rejects.toThrow(/Key Stage/);
  });

  it("refuses to publish with a non-Drive URL", async () => {
    const assetId = await asSuperuser(async (client) => {
      const result = await client.query(
        `insert into public.assets (title, asset_type_id, drive_png_url, preview_path)
         values ('Bad url', $1, 'https://evil.example.com/x.png', 'assets/x/display-x.webp')
         returning id`,
        [timersTypeId],
      );
      const id = result.rows[0].id;
      await client.query(
        "insert into public.asset_key_stages (asset_id, key_stage_id) values ($1, $2)",
        [id, ks1Id],
      );
      return id;
    });
    createdAssetIds.push(assetId);

    await expect(
      asSuperuser((client) =>
        client.query(
          "update public.assets set status = 'published' where id = $1",
          [assetId],
        ),
      ),
    ).rejects.toThrow(/Drive URL/);
  });

  it("refuses to publish a video asset with no drive_mp4_url", async () => {
    const assetId = await asSuperuser(async (client) => {
      const result = await client.query(
        `insert into public.assets (title, asset_type_id, drive_png_url, preview_path, primary_media)
         values ('Video test', $1, 'https://drive.google.com/file/d/x/view', 'assets/x/display-x.webp', 'video')
         returning id`,
        [timersTypeId],
      );
      const id = result.rows[0].id;
      await client.query(
        "insert into public.asset_key_stages (asset_id, key_stage_id) values ($1, $2)",
        [id, ks1Id],
      );
      return id;
    });
    createdAssetIds.push(assetId);

    await expect(
      asSuperuser((client) =>
        client.query(
          "update public.assets set status = 'published' where id = $1",
          [assetId],
        ),
      ),
    ).rejects.toThrow(/drive_mp4_url/);
  });

  it("publishes once every precondition is met, and derives the lesson-code-style search_tsv", async () => {
    const assetId = await asSuperuser(async (client) => {
      const id = await makeDraftAsset(client);
      await client.query(
        "update public.assets set preview_path = 'assets/x/display-x.webp' where id = $1",
        [id],
      );
      await client.query(
        "insert into public.asset_key_stages (asset_id, key_stage_id) values ($1, $2)",
        [id, ks1Id],
      );
      return id;
    });
    createdAssetIds.push(assetId);

    const result = await asSuperuser((client) =>
      client.query(
        "update public.assets set status = 'published' where id = $1 returning status, search_text",
        [assetId],
      ),
    );

    expect(result.rows[0].status).toBe("published");
    expect(result.rows[0].search_text).toContain("RLS test asset");
  });
});

describe("asset_key_stages visibility", () => {
  it("hides a draft asset's key stage rows from a Viewer, shows a published asset's", async () => {
    const viewer = await fixture("viewer");
    const draftId = await asSuperuser(async (client) => {
      const id = await makeDraftAsset(client);
      await client.query(
        "insert into public.asset_key_stages (asset_id, key_stage_id) values ($1, $2)",
        [id, ks1Id],
      );
      return id;
    });
    createdAssetIds.push(draftId);

    const rows = await withRole(viewer.userId, (client) =>
      client.query(
        "select * from public.asset_key_stages where asset_id = $1",
        [draftId],
      ),
    );
    expect(rows.rowCount).toBe(0);
  });

  it("denies a Viewer from inserting an asset_key_stages row", async () => {
    const viewer = await fixture("viewer");
    const assetId = await asSuperuser((client) => makeDraftAsset(client));
    createdAssetIds.push(assetId);

    await expect(
      withRole(viewer.userId, (client) =>
        client.query(
          "insert into public.asset_key_stages (asset_id, key_stage_id) values ($1, $2)",
          [assetId, ks1Id],
        ),
      ),
    ).rejects.toThrow();
  });
});

describe("taxonomy_asset_types", () => {
  it("has the seeded mappings", async () => {
    const result = await asSuperuser((client) =>
      client.query(
        `select t.slug as taxonomy, at.slug as asset_type
         from public.taxonomy_asset_types tat
         join public.taxonomies t on t.id = tat.taxonomy_id
         join public.asset_types at on at.id = tat.asset_type_id
         where t.slug = 'timer_style'`,
      ),
    );
    expect(result.rows).toEqual([
      { taxonomy: "timer_style", asset_type: "timers" },
    ]);
  });
});

describe("app.merge_taxonomy_term reassigns asset_taxonomy_terms", () => {
  it("moves an asset's taxonomy term assignment from source to target on merge", async () => {
    const superAdmin = await fixture("super_admin");
    const taxonomyId = await asSuperuser(async (client) => {
      const r = await client.query(
        "select id from public.taxonomies where slug = 'timer_style'",
      );
      return r.rows[0].id as string;
    });
    const assetId = await asSuperuser((client) => makeDraftAsset(client));
    createdAssetIds.push(assetId);

    const source = await asSuperuser((client) =>
      client.query(
        "insert into public.taxonomy_terms (taxonomy_id, name, slug) values ($1, 'Digital', $2) returning id",
        [taxonomyId, `digital-${crypto.randomUUID()}`],
      ),
    );
    const target = await asSuperuser((client) =>
      client.query(
        "insert into public.taxonomy_terms (taxonomy_id, name, slug) values ($1, 'Analog', $2) returning id",
        [taxonomyId, `analog-${crypto.randomUUID()}`],
      ),
    );
    createdTaxonomyTermIds.push(source.rows[0].id, target.rows[0].id);

    await asSuperuser((client) =>
      client.query(
        "insert into public.asset_taxonomy_terms (asset_id, taxonomy_term_id) values ($1, $2)",
        [assetId, source.rows[0].id],
      ),
    );

    const { reassignedCount, afterTermId } = await withRole(
      superAdmin.userId,
      async (client) => {
        await client.query("select app.merge_taxonomy_term($1, $2)", [
          source.rows[0].id,
          target.rows[0].id,
        ]);
        const after = await client.query(
          "select taxonomy_term_id from public.asset_taxonomy_terms where asset_id = $1",
          [assetId],
        );
        const audit = await client.query(
          "select after from public.audit_log where entity_type = 'taxonomy_term' and entity_id = $1",
          [source.rows[0].id],
        );
        return {
          reassignedCount: audit.rows[0]?.after?.reassigned_count,
          afterTermId: after.rows[0]?.taxonomy_term_id,
        };
      },
    );

    expect(afterTermId).toBe(target.rows[0].id);
    expect(reassignedCount).toBe(1);
  });
});
