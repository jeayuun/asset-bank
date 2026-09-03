import { z } from "zod";

export const lessonSchema = z.object({
  gradeId: z.string().uuid(),
  termId: z.string().uuid(),
  lessonNumber: z.number().int().min(1).max(99),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
});

export type LessonInput = z.infer<typeof lessonSchema>;

export const lessonUpdateSchema = lessonSchema.partial().extend({
  lessonId: z.string().uuid(),
  isActive: z.boolean().optional(),
});
