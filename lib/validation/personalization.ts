import { z } from "zod";

export const toggleFavoriteSchema = z.object({
  assetId: z.string().uuid(),
});

export const createCollectionSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  visibility: z.enum(["personal", "team"]).default("personal"),
});

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;

export const collectionIdSchema = z.object({
  collectionId: z.string().uuid(),
});

export const collectionItemSchema = z.object({
  collectionId: z.string().uuid(),
  assetId: z.string().uuid(),
});

export const collectionMemberSchema = z.object({
  collectionId: z.string().uuid(),
  profileId: z.string().uuid(),
  canEdit: z.boolean().default(false),
});

export const addCollectionMemberByEmailSchema = z.object({
  collectionId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email(),
  canEdit: z.boolean().default(false),
});

export const removeCollectionMemberSchema = z.object({
  collectionId: z.string().uuid(),
  profileId: z.string().uuid(),
});
