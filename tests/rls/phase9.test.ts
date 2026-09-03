import { afterEach, describe, expect, it } from "vitest";

import {
  asSuperuser,
  createFixtureProfile,
  deleteFixtureProfile,
  type FixtureProfile,
  withRole,
} from "./helpers";

const createdUserIds: string[] = [];
const createdBatchIds: string[] = [];
const createdAssetIds: string[] = [];
const createdLessonIds: string[] = [];
const createdProfileIds: string[] = [];

async function fixture(
  role: "viewer" | "admin" | "super_admin" = "viewer",
): Promise<FixtureProfile> {
  const profile = await createFixtureProfile(role);
  createdUserIds.push(profile.userId);
  return profile;
}

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
  if (createdBatchIds.length > 0) {
    await asSuperuser((client) =>
      client.query(
        "delete from public.import_batches where id = any($1::uuid[])",
        [createdBatchIds],
      ),
    );
    createdBatchIds.length = 0;
  }

  while (createdUserIds.length > 0) {
    const id = createdUserIds.pop();
    if (id) await deleteFixtureProfile(id);
  }
});

async function makeBatch(
  uploadedBy: string,
  kind: "assets" | "characters" | "lessons",
  filename = "test.xlsx",
) {
  return asSuperuser(async (client) => {
    const result = await client.query(
      `insert into public.import_batches (kind, filename, uploaded_by, status, row_count)
       values ($1, $2, $3, 'validated', 1) returning id`,
      [kind, filename, uploadedBy],
    );
    return result.rows[0].id as string;
  });
}

async function makeRow(
  batchId: string,
  normalized: Record<string, unknown>,
  status: "valid" | "skipped" = "valid",
) {
  return asSuperuser(async (client) => {
    const result = await client.query(
      `insert into public.import_rows (batch_id, row_number, raw, normalized, status)
       values ($1, 1, '{}'::jsonb, $2, $3) returning id`,
      [batchId, JSON.stringify(normalized), status],
    );
    return result.rows[0].id as string;
  });
}

describe("app.commit_import_rows", () => {
  it("denies a Viewer from committing", async () => {
    const viewer = await fixture();
    const admin = await fixture("admin");
    const batchId = await makeBatch(admin.userId, "lessons");
    createdBatchIds.push(batchId);
    const rowId = await makeRow(batchId, {});

    await expect(
      withRole(viewer.userId, (client) =>
        client.query("select app.commit_import_rows($1, $2::uuid[])", [
          batchId,
          [rowId],
        ]),
      ),
    ).rejects.toThrow(/Admin/);
  });

  it("commits a valid assets row as a draft with its Key Stage linked", async () => {
    const admin = await fixture("admin");
    const batchId = await makeBatch(admin.userId, "assets");
    createdBatchIds.push(batchId);

    const { assetTypeId, keyStageId } = await asSuperuser(async (client) => {
      const type = await client.query(
        "select id from public.asset_types where slug = 'timers'",
      );
      const ks = await client.query(
        "select id from public.key_stages where code = 'KS1'",
      );
      return { assetTypeId: type.rows[0].id, keyStageId: ks.rows[0].id };
    });

    const rowId = await makeRow(batchId, {
      title: "Imported timer",
      description: "from import",
      assetTypeId,
      keyStageIds: [keyStageId],
      drivePngUrl: "https://drive.google.com/file/d/xyz/view",
      drivePngFileId: "xyz",
      primaryMedia: "image",
    });

    const result = await withRole(admin.userId, async (client) => {
      await client.query("select app.commit_import_rows($1, $2::uuid[])", [
        batchId,
        [rowId],
      ]);
      return client.query(
        `select ir.status, ir.asset_id, a.status as asset_status, a.title,
                exists (select 1 from public.asset_key_stages where asset_id = ir.asset_id and key_stage_id = $2) as key_stage_linked
         from public.import_rows ir join public.assets a on a.id = ir.asset_id
         where ir.id = $1`,
        [rowId, keyStageId],
      );
    });

    expect(typeof result.rows[0].asset_id).toBe("string");
    expect(result.rows[0]).toMatchObject({
      status: "committed",
      asset_status: "draft",
      title: "Imported timer",
      key_stage_linked: true,
    });
    createdAssetIds.push(result.rows[0].asset_id);
  });

  it("commits a valid characters row with key_stage_id derived from grade", async () => {
    const admin = await fixture("admin");
    const batchId = await makeBatch(admin.userId, "characters");
    createdBatchIds.push(batchId);

    const { gradeId, keyStageId } = await asSuperuser(async (client) => {
      const grade = await client.query(
        "select id, key_stage_id from public.grades where number = 1",
      );
      return {
        gradeId: grade.rows[0].id,
        keyStageId: grade.rows[0].key_stage_id,
      };
    });

    const rowId = await makeRow(batchId, {
      name: "Imported Mia",
      gradeId,
      profileCode: null,
      characterTypeTermId: null,
      genderTermId: null,
      characterGroupTermId: null,
      description: null,
    });

    // Commit and the resulting row both have to be read back inside the
    // same withRole() transaction — it always rolls back on exit, so a
    // row created there is never visible to a later, separate
    // asSuperuser() call (the recurring bug class fixed in every earlier
    // phase's test suite too).
    const result = await withRole(admin.userId, async (client) => {
      await client.query("select app.commit_import_rows($1, $2::uuid[])", [
        batchId,
        [rowId],
      ]);
      const rowStatus = await client.query(
        `select status from public.import_rows where id = $1`,
        [rowId],
      );
      const profile = await client.query(
        "select id, key_stage_id from public.character_profiles where name = 'Imported Mia'",
      );
      return { rowStatus: rowStatus.rows[0], profile: profile.rows[0] };
    });

    expect(result.rowStatus.status).toBe("committed");
    expect(result.profile.key_stage_id).toBe(keyStageId);
    createdProfileIds.push(result.profile.id);
  });

  it("commits a valid lessons row with a derived code", async () => {
    const admin = await fixture("admin");
    const batchId = await makeBatch(admin.userId, "lessons");
    createdBatchIds.push(batchId);

    const { gradeId, termId } = await asSuperuser(async (client) => {
      const grade = await client.query(
        "select id from public.grades where number = 2",
      );
      const term = await client.query(
        "select id from public.terms where number = 3",
      );
      return { gradeId: grade.rows[0].id, termId: term.rows[0].id };
    });

    const rowId = await makeRow(batchId, {
      gradeId,
      termId,
      lessonNumber: 9,
      title: "Imported lesson",
      description: null,
    });

    const lesson = await withRole(admin.userId, async (client) => {
      await client.query("select app.commit_import_rows($1, $2::uuid[])", [
        batchId,
        [rowId],
      ]);
      const result = await client.query(
        "select id, code from public.lessons where title = 'Imported lesson'",
      );
      return result.rows[0];
    });
    expect(lesson.code).toBe("M2T3L09");
    createdLessonIds.push(lesson.id);
  });

  it("leaves a skipped row untouched", async () => {
    const admin = await fixture("admin");
    const batchId = await makeBatch(admin.userId, "lessons");
    createdBatchIds.push(batchId);
    const rowId = await makeRow(
      batchId,
      { title: "Should not commit" },
      "skipped",
    );

    const result = await withRole(admin.userId, async (client) => {
      await client.query("select app.commit_import_rows($1, $2::uuid[])", [
        batchId,
        [rowId],
      ]);
      return client.query(
        "select status from public.import_rows where id = $1",
        [rowId],
      );
    });
    expect(result.rows[0].status).toBe("skipped");
  });
});

describe("app.finish_import_batch", () => {
  it("denies a Viewer, marks the batch committed for an Admin", async () => {
    const viewer = await fixture();
    const admin = await fixture("admin");
    const batchId = await makeBatch(admin.userId, "lessons");
    createdBatchIds.push(batchId);

    await expect(
      withRole(viewer.userId, (client) =>
        client.query("select app.finish_import_batch($1)", [batchId]),
      ),
    ).rejects.toThrow(/Admin/);

    const status = await withRole(admin.userId, async (client) => {
      await client.query("select app.finish_import_batch($1)", [batchId]);
      const result = await client.query(
        "select status from public.import_batches where id = $1",
        [batchId],
      );
      return result.rows[0].status as string;
    });
    expect(status).toBe("committed");
  });

  it("notifies the uploader once the batch finishes", async () => {
    const admin = await fixture("admin");
    const batchId = await makeBatch(admin.userId, "lessons");
    createdBatchIds.push(batchId);

    const rows = await withRole(admin.userId, async (client) => {
      const before = await client.query("select now() as ts");
      await client.query("select app.finish_import_batch($1)", [batchId]);
      const result = await client.query(
        "select recipient_email, title from app.pending_notification_emails_for_entity('import_batch', $1, $2)",
        [batchId, before.rows[0].ts],
      );
      return result.rows;
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].recipient_email).toBe(admin.email);
  });
});

describe("import_batches / import_rows RLS", () => {
  it("hides batches from a Viewer, shows them to an Admin", async () => {
    const viewer = await fixture();
    const admin = await fixture("admin");
    const batchId = await makeBatch(admin.userId, "lessons");
    createdBatchIds.push(batchId);

    const asViewer = await withRole(viewer.userId, (client) =>
      client.query("select * from public.import_batches where id = $1", [
        batchId,
      ]),
    );
    expect(asViewer.rowCount).toBe(0);

    const asAdmin = await withRole(admin.userId, (client) =>
      client.query("select * from public.import_batches where id = $1", [
        batchId,
      ]),
    );
    expect(asAdmin.rowCount).toBe(1);
  });

  it("denies a Viewer from creating a batch, allows an Admin for their own upload", async () => {
    const viewer = await fixture();
    const admin = await fixture("admin");

    await expect(
      withRole(viewer.userId, (client) =>
        client.query(
          "insert into public.import_batches (kind, filename, uploaded_by) values ('lessons', 'x.xlsx', $1)",
          [viewer.userId],
        ),
      ),
    ).rejects.toThrow();

    const result = await withRole(admin.userId, (client) =>
      client.query(
        "insert into public.import_batches (kind, filename, uploaded_by) values ('lessons', 'x.xlsx', $1) returning id",
        [admin.userId],
      ),
    );
    expect(result.rowCount).toBe(1);
  });

  it("has no delete path for anyone", async () => {
    const admin = await fixture("admin");
    const batchId = await makeBatch(admin.userId, "lessons");
    createdBatchIds.push(batchId);

    await expect(
      withRole(admin.userId, (client) =>
        client.query("delete from public.import_batches where id = $1", [
          batchId,
        ]),
      ),
    ).rejects.toThrow();
  });
});
