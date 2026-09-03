"use server";

import { revalidatePath } from "next/cache";

import { requireActive } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { toggleFavoriteSchema } from "@/lib/validation/personalization";

export async function toggleFavorite(input: unknown) {
  const { userId } = await requireActive();
  const { assetId } = toggleFavoriteSchema.parse(input);

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("favorites")
    .select("asset_id")
    .eq("profile_id", userId)
    .eq("asset_id", assetId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("profile_id", userId)
      .eq("asset_id", assetId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("favorites")
      .insert({ profile_id: userId, asset_id: assetId });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/favorites");
  revalidatePath(`/assets/${assetId}`);
}
