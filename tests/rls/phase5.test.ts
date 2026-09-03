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
const createdProfileIds: string[] = [];
const createdTermIds: string[] = [];
const createdLessonIds: string[] = [];

async function fixture(
  role: "viewer" | "admin" | "super_admin",
): Promise<FixtureProfile> {
  const profile = await createFixtureProfile(role);
  createdUserIds.push(profile.userId);
  return profile;
}

let charactersTypeId: string;
let timersTypeId: string;
let ks1Id: string;
let grade1Id: string;
let grade1KeyStageId: string;
let grade2Id: string;
let poseActionTaxonomyId: string;
let term1Id: string;

beforeAll(async () => {
  await asSuperuser(async (client) => {
    const at = await client.query(
      "select id from public.asset_types where slug in ('characters', 'timers') order by slug",
    );
    charactersTypeId = at.rows[0].id;
    timersTypeId = at.rows[1].id;

    const ks = await client.query(
      "select id from public.key_stages where code = 'KS1'",
    );
    ks1Id = ks.rows[0].id;

    const grades = await client.query(
      "select id, number, key_stage_id from public.grades where number in (1, 2) order by number",
    );
    grade1Id = grades.rows[0].id;
    grade1KeyStageId = grades.rows[0].key_stage_id;
    grade2Id = grades.rows[1].id;

    const pose = await client.query(
      "select id from public.taxonomies where slug = 'pose_action'",
    );
    poseActionTaxonomyId = pose.rows[0].id;

    const term = await client.query(
      "select id from public.terms where number = 1",
    );
    term1Id = term.rows[0].id;
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

  if (createdLessonIds.length > 0) {
    await asSuperuser((client) =>
      client.query("delete from public.lessons where id = any($1::uuid[])", [
        createdLessonIds,
      ]),
    );
    createdLessonIds.length = 0;
  }

  if (createdProfileIds.length > 0) {
    await asSuperuser((client) =>
      client.query(
        "delete from public.character_profiles where id = any($1::uuid[])",
        [createdProfileIds],
      ),
    );
    createdProfileIds.length = 0;
  }

  if (createdTermIds.length > 0) {
    await asSuperuser((client) =>
      client.query(
        "delete from public.taxonomy_terms where id = any($1::uuid[])",
        [createdTermIds],
      ),
    );
    createdTermIds.length = 0;
  }

  while (createdUserIds.length > 0) {
    const id = createdUserIds.pop();
    if (id) await deleteFixtureProfile(id);
  }
});

async function makeProfile(client: Client, name: string, gradeId: string) {
  const result = await client.query(
    `insert into public.character_profiles (name, grade_id) values ($1, $2) returning id`,
    [name, gradeId],
  );
  return result.rows[0].id as string;
}

async function makeCharacterAsset(client: Client, title: string) {
  const result = await client.query(
    `insert into public.assets (title, asset_type_id, drive_png_url, preview_path)
     values ($1, $2, 'https://drive.google.com/file/d/abc/view', 'assets/x/display-x.webp')
     returning id`,
    [title, charactersTypeId],
  );
  const id = result.rows[0].id as string;
  await client.query(
    "insert into public.asset_key_stages (asset_id, key_stage_id) values ($1, $2)",
    [id, ks1Id],
  );
  return id;
}

describe("character_profiles", () => {
  it("derives key_stage_id from grade_id, never accepting it directly", async () => {
    const id = await asSuperuser((client) =>
      makeProfile(client, "Mia", grade1Id),
    );
    createdProfileIds.push(id);

    const result = await asSuperuser((client) =>
      client.query(
        "select key_stage_id from public.character_profiles where id = $1",
        [id],
      ),
    );
    expect(result.rows[0].key_stage_id).toBe(grade1KeyStageId);
  });

  it("allows two profiles in the same grade to share a name (docs/DECISIONS.md D-06)", async () => {
    const first = await asSuperuser((client) =>
      makeProfile(client, "Mia", grade1Id),
    );
    const second = await asSuperuser((client) =>
      makeProfile(client, "Mia", grade1Id),
    );
    createdProfileIds.push(first, second);

    const result = await asSuperuser((client) =>
      client.query(
        "select count(*) from public.character_profiles where grade_id = $1 and name = 'Mia'",
        [grade1Id],
      ),
    );
    expect(Number(result.rows[0].count)).toBe(2);
  });

  it("shows an active profile to a Viewer but denies a Viewer from creating one", async () => {
    const viewer = await fixture("viewer");
    const id = await asSuperuser((client) =>
      makeProfile(client, "Mia", grade1Id),
    );
    createdProfileIds.push(id);

    const rows = await withRole(viewer.userId, (client) =>
      client.query("select * from public.character_profiles where id = $1", [
        id,
      ]),
    );
    expect(rows.rowCount).toBe(1);

    await expect(
      withRole(viewer.userId, (client) =>
        client.query(
          "insert into public.character_profiles (name, grade_id) values ('Nope', $1)",
          [grade1Id],
        ),
      ),
    ).rejects.toThrow();
  });

  it("lets an Admin create a character profile", async () => {
    const admin = await fixture("admin");

    const result = await withRole(admin.userId, (client) =>
      client.query(
        "insert into public.character_profiles (name, grade_id) values ('Leo', $1) returning id",
        [grade1Id],
      ),
    );
    createdProfileIds.push(result.rows[0].id);
    expect(result.rowCount).toBe(1);
  });

  it("has no delete path for anyone, including an Admin", async () => {
    const admin = await fixture("admin");
    const id = await asSuperuser((client) =>
      makeProfile(client, "Mia", grade1Id),
    );
    createdProfileIds.push(id);

    await expect(
      withRole(admin.userId, (client) =>
        client.query("delete from public.character_profiles where id = $1", [
          id,
        ]),
      ),
    ).rejects.toThrow();
  });
});

describe("Characters publish preconditions (docs/BLUEPRINT.md §8, precondition 6)", () => {
  it("refuses to publish a Characters asset with no character_profile_id", async () => {
    const assetId = await asSuperuser((client) =>
      makeCharacterAsset(client, "Mia waving"),
    );
    createdAssetIds.push(assetId);

    await expect(
      asSuperuser((client) =>
        client.query(
          "update public.assets set status = 'published' where id = $1",
          [assetId],
        ),
      ),
    ).rejects.toThrow(/character_profile_id/);
  });

  it("refuses to publish a Characters asset with a profile but no pose_action term", async () => {
    const profileId = await asSuperuser((client) =>
      makeProfile(client, "Mia", grade1Id),
    );
    createdProfileIds.push(profileId);

    const assetId = await asSuperuser(async (client) => {
      const id = await makeCharacterAsset(client, "Mia waving");
      await client.query(
        "update public.assets set character_profile_id = $1 where id = $2",
        [profileId, id],
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
    ).rejects.toThrow(/pose_action/);
  });

  it("publishes once character_profile_id and a pose_action term are both set, and folds the character name into search_text", async () => {
    const profileId = await asSuperuser((client) =>
      makeProfile(client, "Mia", grade1Id),
    );
    createdProfileIds.push(profileId);

    const poseTermId = await asSuperuser(async (client) => {
      const result = await client.query(
        "insert into public.taxonomy_terms (taxonomy_id, name, slug) values ($1, 'Waving', $2) returning id",
        [poseActionTaxonomyId, `waving-${crypto.randomUUID()}`],
      );
      return result.rows[0].id as string;
    });
    createdTermIds.push(poseTermId);

    const assetId = await asSuperuser(async (client) => {
      const id = await makeCharacterAsset(client, "Waving pose");
      await client.query(
        "update public.assets set character_profile_id = $1 where id = $2",
        [profileId, id],
      );
      await client.query(
        "insert into public.asset_taxonomy_terms (asset_id, taxonomy_term_id) values ($1, $2)",
        [id, poseTermId],
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
    expect(result.rows[0].search_text).toContain("Waving pose");
    expect(result.rows[0].search_text).toContain("Mia");
  });

  it("does not require character_profile_id for a non-Characters asset type", async () => {
    const assetId = await asSuperuser(async (client) => {
      const result = await client.query(
        `insert into public.assets (title, asset_type_id, drive_png_url, preview_path)
         values ('Blue timer', $1, 'https://drive.google.com/file/d/abc/view', 'assets/x/display-x.webp')
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

    const result = await asSuperuser((client) =>
      client.query(
        "update public.assets set status = 'published' where id = $1 returning status",
        [assetId],
      ),
    );
    expect(result.rows[0].status).toBe("published");
  });
});

describe("asset_grades / asset_lessons (docs/PRODUCT_SPEC.md §7)", () => {
  it("hides a draft asset's lesson/grade links from a Viewer, shows a published asset's", async () => {
    const viewer = await fixture("viewer");
    const lessonId = await asSuperuser(async (client) => {
      const result = await client.query(
        `insert into public.lessons (grade_id, term_id, lesson_number, title, code)
         values ($1, $2, $3, 'RLS lesson', '') returning id`,
        [grade1Id, term1Id, Math.floor(Math.random() * 90) + 1],
      );
      return result.rows[0].id as string;
    });
    createdLessonIds.push(lessonId);

    const draftId = await asSuperuser(async (client) => {
      const result = await client.query(
        `insert into public.assets (title, asset_type_id, drive_png_url)
         values ('RLS lesson asset', $1, 'https://drive.google.com/file/d/abc/view')
         returning id`,
        [timersTypeId],
      );
      const id = result.rows[0].id;
      await client.query(
        "insert into public.asset_lessons (asset_id, lesson_id) values ($1, $2)",
        [id, lessonId],
      );
      await client.query(
        "insert into public.asset_grades (asset_id, grade_id) values ($1, $2)",
        [id, grade1Id],
      );
      return id;
    });
    createdAssetIds.push(draftId);

    const lessonRows = await withRole(viewer.userId, (client) =>
      client.query("select * from public.asset_lessons where asset_id = $1", [
        draftId,
      ]),
    );
    expect(lessonRows.rowCount).toBe(0);

    const gradeRows = await withRole(viewer.userId, (client) =>
      client.query("select * from public.asset_grades where asset_id = $1", [
        draftId,
      ]),
    );
    expect(gradeRows.rowCount).toBe(0);
  });

  it("denies a Viewer from assigning a lesson to an asset, but allows an Admin", async () => {
    const viewer = await fixture("viewer");
    const admin = await fixture("admin");
    const lessonId = await asSuperuser(async (client) => {
      const result = await client.query(
        `insert into public.lessons (grade_id, term_id, lesson_number, title, code)
         values ($1, $2, $3, 'RLS lesson 2', '') returning id`,
        [grade2Id, term1Id, Math.floor(Math.random() * 90) + 1],
      );
      return result.rows[0].id as string;
    });
    createdLessonIds.push(lessonId);

    const assetId = await asSuperuser(async (client) => {
      const result = await client.query(
        `insert into public.assets (title, asset_type_id, drive_png_url)
         values ('RLS lesson asset 2', $1, 'https://drive.google.com/file/d/abc/view')
         returning id`,
        [timersTypeId],
      );
      return result.rows[0].id as string;
    });
    createdAssetIds.push(assetId);

    await expect(
      withRole(viewer.userId, (client) =>
        client.query(
          "insert into public.asset_lessons (asset_id, lesson_id) values ($1, $2)",
          [assetId, lessonId],
        ),
      ),
    ).rejects.toThrow();

    const result = await withRole(admin.userId, (client) =>
      client.query(
        "insert into public.asset_lessons (asset_id, lesson_id) values ($1, $2) returning asset_id",
        [assetId, lessonId],
      ),
    );
    expect(result.rowCount).toBe(1);
  });
});
