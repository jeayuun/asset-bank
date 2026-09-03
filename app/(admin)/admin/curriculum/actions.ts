"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { lessonSchema, lessonUpdateSchema } from "@/lib/validation/curriculum";

export async function createLesson(input: unknown) {
  await requireRole("admin");
  const parsed = lessonSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase.from("lessons").insert({
    grade_id: parsed.gradeId,
    term_id: parsed.termId,
    lesson_number: parsed.lessonNumber,
    title: parsed.title,
    description: parsed.description ?? null,
    // Always overwritten by app.set_lesson_code() — the column is
    // NOT NULL with no DB default, so the insert payload needs a
    // placeholder (docs/DECISIONS.md D-09).
    code: "",
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/curriculum");
}

export async function updateLesson(input: unknown) {
  await requireRole("admin");
  const parsed = lessonUpdateSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("lessons")
    .update({
      ...(parsed.title !== undefined && { title: parsed.title }),
      ...(parsed.description !== undefined && {
        description: parsed.description,
      }),
      ...(parsed.isActive !== undefined && { is_active: parsed.isActive }),
    })
    .eq("id", parsed.lessonId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/curriculum");
}
