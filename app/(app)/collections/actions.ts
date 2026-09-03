"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActive } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  addCollectionMemberByEmailSchema,
  collectionIdSchema,
  collectionItemSchema,
  collectionMemberSchema,
  createCollectionSchema,
  removeCollectionMemberSchema,
} from "@/lib/validation/personalization";

export async function createCollection(input: unknown) {
  const { userId } = await requireActive();
  const parsed = createCollectionSchema.parse(input);

  const supabase = await createClient();
  const { data: collection, error } = await supabase
    .from("collections")
    .insert({
      name: parsed.name,
      description: parsed.description ?? null,
      visibility: parsed.visibility,
      owner_id: userId,
    })
    .select("id")
    .single();

  if (error || !collection) {
    throw new Error(error?.message ?? "Failed to create collection");
  }

  revalidatePath("/collections");
  redirect(`/collections/${collection.id}`);
}

export async function deleteCollection(input: unknown) {
  await requireActive();
  const { collectionId } = collectionIdSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("collections")
    .delete()
    .eq("id", collectionId);
  if (error) throw new Error(error.message);

  revalidatePath("/collections");
  redirect("/collections");
}

export async function addCollectionItem(input: unknown) {
  const { userId } = await requireActive();
  const { collectionId, assetId } = collectionItemSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase.from("collection_items").insert({
    collection_id: collectionId,
    asset_id: assetId,
    added_by: userId,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/collections/${collectionId}`);
  revalidatePath(`/assets/${assetId}`);
}

export async function removeCollectionItem(input: unknown) {
  await requireActive();
  const { collectionId, assetId } = collectionItemSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("collection_items")
    .delete()
    .eq("collection_id", collectionId)
    .eq("asset_id", assetId);
  if (error) throw new Error(error.message);

  revalidatePath(`/collections/${collectionId}`);
  revalidatePath(`/assets/${assetId}`);
}

export async function addCollectionMember(input: unknown) {
  await requireActive();
  const { collectionId, profileId, canEdit } =
    collectionMemberSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase.from("collection_members").insert({
    collection_id: collectionId,
    profile_id: profileId,
    can_edit: canEdit,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/collections/${collectionId}`);
}

export async function addCollectionMemberByEmail(input: unknown) {
  await requireActive();
  const { collectionId, email, canEdit } =
    addCollectionMemberByEmailSchema.parse(input);

  const supabase = await createClient();
  const { data: profileId, error: lookupError } = await supabase
    .schema("app")
    .rpc("find_profile_id_by_email", { p_email: email });
  if (lookupError) throw new Error(lookupError.message);
  if (!profileId) throw new Error("No active user found with that email");

  const { error } = await supabase.from("collection_members").insert({
    collection_id: collectionId,
    profile_id: profileId,
    can_edit: canEdit,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/collections/${collectionId}`);
}

export async function removeCollectionMember(input: unknown) {
  await requireActive();
  const { collectionId, profileId } = removeCollectionMemberSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("collection_members")
    .delete()
    .eq("collection_id", collectionId)
    .eq("profile_id", profileId);
  if (error) throw new Error(error.message);

  revalidatePath(`/collections/${collectionId}`);
}
