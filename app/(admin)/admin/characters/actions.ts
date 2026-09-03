"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  createCharacterProfileSchema,
  setCharacterProfileActiveSchema,
} from "@/lib/validation/characters";

export async function createCharacterProfile(input: unknown) {
  const { userId } = await requireRole("admin");
  const parsed = createCharacterProfileSchema.parse(input);

  const supabase = await createClient();

  // Non-blocking duplicate warning (docs/BLUEPRINT.md §5.3, docs/DECISIONS.md
  // D-06): two Grade 1 profiles named "Mia" are allowed — the UI only
  // surfaces existing same-name profiles in the same grade, it never
  // refuses to create the row.
  const { data: duplicates } = await supabase
    .from("character_profiles")
    .select("name, profile_code")
    .eq("grade_id", parsed.gradeId)
    .ilike("name", parsed.name);

  const { data: grade, error: gradeError } = await supabase
    .from("grades")
    .select("key_stage_id")
    .eq("id", parsed.gradeId)
    .single();
  if (gradeError || !grade) {
    throw new Error(gradeError?.message ?? "Unknown grade");
  }

  const { data: profile, error } = await supabase
    .from("character_profiles")
    .insert({
      name: parsed.name,
      grade_id: parsed.gradeId,
      // Always overwritten by app.set_character_profile_key_stage() — the
      // column is NOT NULL with no DB default (docs/DECISIONS.md D-09's
      // reasoning), so the insert payload needs the real value up front.
      key_stage_id: grade.key_stage_id,
      profile_code: parsed.profileCode || null,
      character_type_term_id: parsed.characterTypeTermId ?? null,
      gender_term_id: parsed.genderTermId ?? null,
      character_group_term_id: parsed.characterGroupTermId ?? null,
      description: parsed.description ?? null,
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .single();

  if (error || !profile) {
    throw new Error(error?.message ?? "Failed to create character profile");
  }

  revalidatePath("/admin/characters");

  return {
    id: profile.id,
    duplicateWarning:
      (duplicates?.length ?? 0) > 0
        ? `${duplicates!.length} existing profile(s) in this grade already use the name "${parsed.name}"${
            duplicates!.some((d) => d.profile_code)
              ? ` (${duplicates!
                  .filter((d) => d.profile_code)
                  .map((d) => d.profile_code)
                  .join(", ")})`
              : ""
          }.`
        : null,
  };
}

export async function setCharacterProfileActive(input: unknown) {
  await requireRole("admin");
  const { profileId, isActive } = setCharacterProfileActiveSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("character_profiles")
    .update({ is_active: isActive })
    .eq("id", profileId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/characters");
}
