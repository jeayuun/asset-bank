import { z } from "zod";

export const createTaxonomyTermSchema = z.object({
  taxonomyId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  parentId: z.string().uuid().nullable().optional(),
});

export type CreateTaxonomyTermInput = z.infer<typeof createTaxonomyTermSchema>;

export const taxonomyTermIdSchema = z.object({
  termId: z.string().uuid(),
});

export const setTaxonomyTermActiveSchema = z.object({
  termId: z.string().uuid(),
  isActive: z.boolean(),
});

export const renameTaxonomyTermSchema = z.object({
  termId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
});

export const mergeTaxonomyTermSchema = z.object({
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
});
