import type { Metadata } from "next";

import { AssetForm } from "@/components/assets/asset-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "New asset — Asset Bank",
};

export default async function NewAssetPage() {
  const supabase = await createClient();
  const [
    { data: assetTypes },
    { data: keyStages },
    { data: characterProfiles },
  ] = await Promise.all([
    supabase.from("asset_types").select("id, name, slug").order("sort_order"),
    supabase.from("key_stages").select("id, code").order("sort_order"),
    supabase
      .from("character_profiles")
      .select("id, name, profile_code, grades(label)")
      .eq("is_active", true)
      .order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">New asset</h1>
        <p className="text-muted-foreground text-sm">
          Add a title, at least one Drive link, and one Key Stage. You can
          upload a preview and publish after creating it.
        </p>
      </div>

      <AssetForm
        assetTypes={assetTypes ?? []}
        keyStages={keyStages ?? []}
        characterProfiles={characterProfiles ?? []}
      />
    </div>
  );
}
