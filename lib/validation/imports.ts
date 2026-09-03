import { z } from "zod";

export const importKindSchema = z.enum(["assets", "characters", "lessons"]);

export const commitImportBatchSchema = z.object({
  batchId: z.string().uuid(),
});

export const setImportRowSkippedSchema = z.object({
  batchId: z.string().uuid(),
  rowId: z.string().uuid(),
  skipped: z.boolean(),
});
