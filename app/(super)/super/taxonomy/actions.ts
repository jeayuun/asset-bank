"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  createTaxonomyTermSchema,
  mergeTaxonomyTermSchema,
  renameTaxonomyTermSchema,
  setTaxonomyTermActiveSchema,
} from "@/lib/validation/taxonomy";

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createTaxonomyTerm(input: unknown) {
  await requireRole("super_admin");
  const parsed = createTaxonomyTermSchema.parse(input);

  const supabase = await createClient();

  // is_closed rejects new terms entirely — enforced here since the UI
  // already hides the "add term" control for a closed taxonomy
  // (docs/BLUEPRINT.md §5.4 "Taxonomy guardrails").
  const { data: taxonomy, error: taxonomyError } = await supabase
    .from("taxonomies")
    .select("is_closed")
    .eq("id", parsed.taxonomyId)
    .maybeSingle();

  if (taxonomyError || !taxonomy) {
    throw new Error(taxonomyError?.message ?? "Taxonomy not found");
  }
  if (taxonomy.is_closed) {
    throw new Error("This taxonomy is closed to new terms");
  }

  const { error } = await supabase.from("taxonomy_terms").insert({
    taxonomy_id: parsed.taxonomyId,
    parent_id: parsed.parentId ?? null,
    name: parsed.name,
    slug: slugify(parsed.name),
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/super/taxonomy");
}

export async function renameTaxonomyTerm(input: unknown) {
  await requireRole("super_admin");
  const parsed = renameTaxonomyTermSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("taxonomy_terms")
    .update({ name: parsed.name })
    .eq("id", parsed.termId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/super/taxonomy");
}

export async function setTaxonomyTermActive(input: unknown) {
  await requireRole("super_admin");
  const { termId, isActive } = setTaxonomyTermActiveSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("taxonomy_terms")
    .update({ is_active: isActive })
    .eq("id", termId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/super/taxonomy");
}

export async function mergeTaxonomyTerms(input: unknown) {
  await requireRole("super_admin");
  const { sourceId, targetId } = mergeTaxonomyTermSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase.schema("app").rpc("merge_taxonomy_term", {
    p_source: sourceId,
    p_target: targetId,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/super/taxonomy");
}
