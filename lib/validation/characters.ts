import { z } from "zod";

export const createCharacterProfileSchema = z.object({
  name: z.string().trim().min(1).max(160),
  gradeId: z.string().uuid(),
  profileCode: z.string().trim().min(1).max(60).nullable().optional(),
  characterTypeTermId: z.string().uuid().nullable().optional(),
  genderTermId: z.string().uuid().nullable().optional(),
  characterGroupTermId: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});

export type CreateCharacterProfileInput = z.infer<
  typeof createCharacterProfileSchema
>;

export const characterProfileIdSchema = z.object({
  profileId: z.string().uuid(),
});

export const setCharacterProfileActiveSchema = z.object({
  profileId: z.string().uuid(),
  isActive: z.boolean(),
});
