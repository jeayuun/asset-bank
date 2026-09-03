import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  asSuperuser,
  createFixtureProfile,
  deleteFixtureProfile,
  type FixtureProfile,
  withRole,
} from "./helpers";

const createdUserIds: string[] = [];
const createdLessonIds: string[] = [];
const createdTaxonomyTermIds: string[] = [];

async function fixture(
  role: "viewer" | "admin" | "super_admin",
  opts?: { status?: "active" | "suspended" },
): Promise<FixtureProfile> {
  const profile = await createFixtureProfile(role, opts);
  createdUserIds.push(profile.userId);
  return profile;
}

let grade3Id: string;
let term2Id: string;

beforeAll(async () => {
  await asSuperuser(async (client) => {
    const grade = await client.query(
      "select id from public.grades where number = 3",
    );
    grade3Id = grade.rows[0].id;
    const term = await client.query(
      "select id from public.terms where number = 2",
    );
    term2Id = term.rows[0].id;
  });
});

afterEach(async () => {
  if (createdTaxonomyTermIds.length > 0) {
    await asSuperuser((client) =>
      client.query(
        "delete from public.taxonomy_terms where id = any($1::uuid[])",
        [createdTaxonomyTermIds],
      ),
    );
    createdTaxonomyTermIds.length = 0;
  }

  if (createdLessonIds.length > 0) {
    await asSuperuser((client) =>
      client.query("delete from public.lessons where id = any($1::uuid[])", [
        createdLessonIds,
      ]),
    );
    createdLessonIds.length = 0;
  }

  while (createdUserIds.length > 0) {
    const id = createdUserIds.pop();
    if (id) await deleteFixtureProfile(id);
  }
});

describe("lessons and the trigger-derived code", () => {
  it("derives the code from grade/term/lesson_number, matching the Blueprint's own example", async () => {
    const admin = await fixture("admin");

    const result = await withRole(admin.userId, (client) =>
      client.query(
        "insert into public.lessons (grade_id, term_id, lesson_number, title) values ($1, $2, 7, 'Test lesson') returning code",
        [grade3Id, term2Id],
      ),
    );

    expect(result.rows[0].code).toBe("M3T2L07");
  });

  it("overwrites a hand-supplied code", async () => {
    const admin = await fixture("admin");

    const result = await withRole(admin.userId, (client) =>
      client.query(
        "insert into public.lessons (grade_id, term_id, lesson_number, title, code) values ($1, $2, 8, 'Test lesson', 'BOGUS') returning code",
        [grade3Id, term2Id],
      ),
    );

    expect(result.rows[0].code).toBe("M3T2L08");
  });

  it("denies a Viewer from creating a lesson", async () => {
    const viewer = await fixture("viewer");

    await expect(
      withRole(viewer.userId, (client) =>
        client.query(
          "insert into public.lessons (grade_id, term_id, lesson_number, title) values ($1, $2, 9, 'Test lesson')",
          [grade3Id, term2Id],
        ),
      ),
    ).rejects.toThrow();
  });

  it("lets a Viewer read lessons", async () => {
    const viewer = await fixture("viewer");
    const rows = await withRole(viewer.userId, (client) =>
      client.query("select * from public.lessons"),
    );
    expect(rows.rowCount).toBeGreaterThanOrEqual(0);
  });

  it("blocks changing grades.number while a lesson references the grade", async () => {
    const inserted = await asSuperuser((client) =>
      client.query(
        "insert into public.lessons (grade_id, term_id, lesson_number, title) values ($1, $2, 10, 'Guard test') returning id",
        [grade3Id, term2Id],
      ),
    );
    createdLessonIds.push(inserted.rows[0].id);

    await expect(
      asSuperuser((client) =>
        client.query("update public.grades set number = 30 where id = $1", [
          grade3Id,
        ]),
      ),
    ).rejects.toThrow();
  });
});

describe("taxonomies and taxonomy_terms", () => {
  it("denies an Admin from creating a taxonomy term (Super Admin only)", async () => {
    const admin = await fixture("admin");
    const taxonomyId = await asSuperuser(async (client) => {
      const r = await client.query(
        "select id from public.taxonomies where slug = 'wardrobe'",
      );
      return r.rows[0].id as string;
    });

    await expect(
      withRole(admin.userId, (client) =>
        client.query(
          "insert into public.taxonomy_terms (taxonomy_id, name, slug) values ($1, 'Lab Coat', $2)",
          [taxonomyId, `lab-coat-${crypto.randomUUID()}`],
        ),
      ),
    ).rejects.toThrow();
  });

  it("lets a Super Admin create a taxonomy term", async () => {
    const superAdmin = await fixture("super_admin");
    const taxonomyId = await asSuperuser(async (client) => {
      const r = await client.query(
        "select id from public.taxonomies where slug = 'wardrobe'",
      );
      return r.rows[0].id as string;
    });
    const slug = `lab-coat-${crypto.randomUUID()}`;

    const result = await withRole(superAdmin.userId, (client) =>
      client.query(
        "insert into public.taxonomy_terms (taxonomy_id, name, slug) values ($1, 'Lab Coat', $2) returning id",
        [taxonomyId, slug],
      ),
    );

    createdTaxonomyTermIds.push(result.rows[0].id);
    expect(result.rowCount).toBe(1);
  });

  it("denies a suspended user from reading taxonomies", async () => {
    const suspended = await fixture("admin", { status: "suspended" });
    const rows = await withRole(suspended.userId, (client) =>
      client.query("select * from public.taxonomies"),
    );
    expect(rows.rowCount).toBe(0);
  });

  it("rejects a third hierarchy level", async () => {
    const professionId = await asSuperuser(async (client) => {
      const r = await client.query(
        "select id from public.taxonomies where slug = 'profession'",
      );
      return r.rows[0].id as string;
    });

    const l0 = await asSuperuser((client) =>
      client.query(
        "insert into public.taxonomy_terms (taxonomy_id, name, slug) values ($1, 'Healthcare', $2) returning id",
        [professionId, `healthcare-${crypto.randomUUID()}`],
      ),
    );
    createdTaxonomyTermIds.push(l0.rows[0].id);

    const l1 = await asSuperuser((client) =>
      client.query(
        "insert into public.taxonomy_terms (taxonomy_id, parent_id, name, slug) values ($1, $2, 'Nurse', $3) returning id",
        [professionId, l0.rows[0].id, `nurse-${crypto.randomUUID()}`],
      ),
    );
    createdTaxonomyTermIds.push(l1.rows[0].id);

    await expect(
      asSuperuser((client) =>
        client.query(
          "insert into public.taxonomy_terms (taxonomy_id, parent_id, name, slug) values ($1, $2, 'Too Deep', $3)",
          [professionId, l1.rows[0].id, `too-deep-${crypto.randomUUID()}`],
        ),
      ),
    ).rejects.toThrow();
  });

  it("rejects a parent on a non-hierarchical taxonomy", async () => {
    const taxonomyId = await asSuperuser(async (client) => {
      const r = await client.query(
        "select id from public.taxonomies where slug = 'character_type'",
      );
      return r.rows[0].id as string;
    });

    const a = await asSuperuser((client) =>
      client.query(
        "insert into public.taxonomy_terms (taxonomy_id, name, slug) values ($1, 'Student', $2) returning id",
        [taxonomyId, `student-${crypto.randomUUID()}`],
      ),
    );
    createdTaxonomyTermIds.push(a.rows[0].id);

    await expect(
      asSuperuser((client) =>
        client.query(
          "insert into public.taxonomy_terms (taxonomy_id, parent_id, name, slug) values ($1, $2, 'Sub', $3)",
          [taxonomyId, a.rows[0].id, `sub-${crypto.randomUUID()}`],
        ),
      ),
    ).rejects.toThrow();
  });

  it("keeps a system taxonomy's slug immutable", async () => {
    await expect(
      asSuperuser((client) =>
        client.query(
          "update public.taxonomies set slug = 'genders' where slug = 'gender'",
        ),
      ),
    ).rejects.toThrow();
  });

  it("refuses to deactivate a system taxonomy", async () => {
    await expect(
      asSuperuser((client) =>
        client.query(
          "update public.taxonomies set is_active = false where slug = 'gender'",
        ),
      ),
    ).rejects.toThrow();
  });
});

describe("app.merge_taxonomy_term", () => {
  it("deactivates the source term and audits the merge, for a Super Admin", async () => {
    const superAdmin = await fixture("super_admin");
    const taxonomyId = await asSuperuser(async (client) => {
      const r = await client.query(
        "select id from public.taxonomies where slug = 'wardrobe'",
      );
      return r.rows[0].id as string;
    });

    const source = await asSuperuser((client) =>
      client.query(
        "insert into public.taxonomy_terms (taxonomy_id, name, slug) values ($1, 'Lab Coat', $2) returning id",
        [taxonomyId, `lab-coat-${crypto.randomUUID()}`],
      ),
    );
    const target = await asSuperuser((client) =>
      client.query(
        "insert into public.taxonomy_terms (taxonomy_id, name, slug) values ($1, 'White Coat', $2) returning id",
        [taxonomyId, `white-coat-${crypto.randomUUID()}`],
      ),
    );
    createdTaxonomyTermIds.push(source.rows[0].id, target.rows[0].id);

    // withRole always rolls back, so the merge call and the checks that
    // observe its effect have to run inside the same transaction (see the
    // identical fix in tests/rls/phase1.test.ts "lets a Super Admin
    // suspend and reactivate").
    const { isActiveAfter, auditRowCount, auditAction } = await withRole(
      superAdmin.userId,
      async (client) => {
        await client.query("select app.merge_taxonomy_term($1, $2)", [
          source.rows[0].id,
          target.rows[0].id,
        ]);

        const after = await client.query(
          "select is_active from public.taxonomy_terms where id = $1",
          [source.rows[0].id],
        );

        const audit = await client.query(
          "select action from public.audit_log where entity_type = 'taxonomy_term' and entity_id = $1",
          [source.rows[0].id],
        );

        return {
          isActiveAfter: after.rows[0].is_active,
          auditRowCount: audit.rowCount,
          auditAction: audit.rows[0]?.action,
        };
      },
    );

    expect(isActiveAfter).toBe(false);
    expect(auditRowCount).toBe(1);
    expect(auditAction).toBe("merge");
  });

  it("refuses an Admin (Super Admin only)", async () => {
    const admin = await fixture("admin");
    const taxonomyId = await asSuperuser(async (client) => {
      const r = await client.query(
        "select id from public.taxonomies where slug = 'wardrobe'",
      );
      return r.rows[0].id as string;
    });

    const source = await asSuperuser((client) =>
      client.query(
        "insert into public.taxonomy_terms (taxonomy_id, name, slug) values ($1, 'A', $2) returning id",
        [taxonomyId, `a-${crypto.randomUUID()}`],
      ),
    );
    const target = await asSuperuser((client) =>
      client.query(
        "insert into public.taxonomy_terms (taxonomy_id, name, slug) values ($1, 'B', $2) returning id",
        [taxonomyId, `b-${crypto.randomUUID()}`],
      ),
    );
    createdTaxonomyTermIds.push(source.rows[0].id, target.rows[0].id);

    await expect(
      withRole(admin.userId, (client) =>
        client.query("select app.merge_taxonomy_term($1, $2)", [
          source.rows[0].id,
          target.rows[0].id,
        ]),
      ),
    ).rejects.toThrow();
  });

  it("refuses merging across two different taxonomies", async () => {
    const superAdmin = await fixture("super_admin");
    const wardrobeId = await asSuperuser(async (client) => {
      const r = await client.query(
        "select id from public.taxonomies where slug = 'wardrobe'",
      );
      return r.rows[0].id as string;
    });
    const timerId = await asSuperuser(async (client) => {
      const r = await client.query(
        "select id from public.taxonomies where slug = 'timer_style'",
      );
      return r.rows[0].id as string;
    });

    const source = await asSuperuser((client) =>
      client.query(
        "insert into public.taxonomy_terms (taxonomy_id, name, slug) values ($1, 'A', $2) returning id",
        [wardrobeId, `a-${crypto.randomUUID()}`],
      ),
    );
    const target = await asSuperuser((client) =>
      client.query(
        "insert into public.taxonomy_terms (taxonomy_id, name, slug) values ($1, 'B', $2) returning id",
        [timerId, `b-${crypto.randomUUID()}`],
      ),
    );
    createdTaxonomyTermIds.push(source.rows[0].id, target.rows[0].id);

    await expect(
      withRole(superAdmin.userId, (client) =>
        client.query("select app.merge_taxonomy_term($1, $2)", [
          source.rows[0].id,
          target.rows[0].id,
        ]),
      ),
    ).rejects.toThrow();
  });
});
