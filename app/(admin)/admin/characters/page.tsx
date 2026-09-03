import type { Metadata } from "next";

import { CharacterProfileForm } from "@/components/characters/character-profile-form";
import { CharacterProfileRowActions } from "@/components/characters/character-profile-row-actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Characters — Asset Bank",
};

export default async function CharactersPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: grades }, { data: terms }] = await Promise.all([
    supabase.from("grades").select("id, number, label").order("number"),
    supabase
      .from("taxonomy_terms")
      .select("id, name, taxonomies!inner(slug)")
      .in("taxonomies.slug", ["character_type", "gender", "character_group"])
      .eq("is_active", true)
      .order("name"),
  ]);

  const characterTypes = (terms ?? []).filter(
    (t) => t.taxonomies?.slug === "character_type",
  );
  const genders = (terms ?? []).filter((t) => t.taxonomies?.slug === "gender");
  const characterGroups = (terms ?? []).filter(
    (t) => t.taxonomies?.slug === "character_group",
  );

  const selectedGradeNumber = Number(params.grade ?? grades?.[0]?.number ?? 1);
  const selectedGrade = grades?.find((g) => g.number === selectedGradeNumber);

  const { data: profiles } = selectedGrade
    ? await supabase
        .from("character_profiles")
        .select(
          "id, name, profile_code, is_active, character_type:taxonomy_terms!character_profiles_character_type_term_id_fkey(name), gender:taxonomy_terms!character_profiles_gender_term_id_fkey(name), character_group:taxonomy_terms!character_profiles_character_group_term_id_fkey(name)",
        )
        .eq("grade_id", selectedGrade.id)
        .order("name")
    : { data: [] };

  const rows = profiles ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Character profiles
        </h1>
        <p className="text-muted-foreground text-sm">
          Every profile belongs to exactly one grade. Two profiles in the same
          grade may share a name — that&apos;s expected, not an error.
        </p>
      </div>

      <form method="get" className="flex gap-3">
        <select
          name="grade"
          defaultValue={selectedGradeNumber}
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        >
          {(grades ?? []).map((grade) => (
            <option key={grade.id} value={grade.number}>
              {grade.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="border-input hover:bg-accent h-9 rounded-md border px-3 text-sm"
        >
          Filter
        </button>
      </form>

      {selectedGrade && (
        <CharacterProfileForm
          gradeId={selectedGrade.id}
          characterTypes={characterTypes}
          genders={genders}
          characterGroups={characterGroups}
        />
      )}

      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground text-left text-xs uppercase">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Gender</th>
              <th className="px-4 py-2">Group</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((profile) => (
              <tr key={profile.id} className="border-border border-t">
                <td className="px-4 py-2">{profile.name}</td>
                <td className="px-4 py-2 font-mono text-xs">
                  {profile.profile_code ?? "—"}
                </td>
                <td className="px-4 py-2">
                  {profile.character_type?.name ?? "—"}
                </td>
                <td className="px-4 py-2">{profile.gender?.name ?? "—"}</td>
                <td className="px-4 py-2">
                  {profile.character_group?.name ?? "—"}
                </td>
                <td className="px-4 py-2">
                  {profile.is_active ? "Active" : "Inactive"}
                </td>
                <td className="px-4 py-2 text-right">
                  <CharacterProfileRowActions
                    profileId={profile.id}
                    isActive={profile.is_active}
                  />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="text-muted-foreground px-4 py-6 text-center"
                >
                  No character profiles yet for this grade.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
