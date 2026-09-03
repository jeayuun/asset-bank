import { z } from "zod";

export const requestPriorities = ["low", "normal", "high", "urgent"] as const;
export const requestStatuses = [
  "submitted",
  "under_review",
  "approved",
  "in_progress",
  "on_hold",
  "completed",
  "rejected",
  "cancelled",
] as const;

export const createRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).nullable().optional(),
  assetTypeId: z.string().uuid().nullable().optional(),
  keyStageId: z.string().uuid().nullable().optional(),
  gradeId: z.string().uuid().nullable().optional(),
  lessonId: z.string().uuid().nullable().optional(),
  priority: z.enum(requestPriorities).default("normal"),
  neededBy: z.string().trim().nullable().optional(),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const requestIdSchema = z.object({
  requestId: z.string().uuid(),
});

export const changeRequestStatusSchema = z.object({
  requestId: z.string().uuid(),
  newStatus: z.enum(requestStatuses),
  note: z.string().trim().max(2000).nullable().optional(),
});

export const assignRequestSchema = z.object({
  requestId: z.string().uuid(),
  assigneeId: z.string().uuid(),
});

export const addCommentSchema = z.object({
  requestId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

export const editCommentSchema = z.object({
  commentId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

export const deleteCommentSchema = z.object({
  commentId: z.string().uuid(),
});

export const addDeliverableSchema = z
  .object({
    requestId: z.string().uuid(),
    label: z.string().trim().min(1).max(160),
    assetId: z.string().uuid().nullable().optional(),
    driveUrl: z.string().trim().url().nullable().optional(),
  })
  .refine((data) => data.assetId || data.driveUrl, {
    message: "Provide an asset or a Drive link",
    path: ["driveUrl"],
  });

export const addWatcherByEmailSchema = z.object({
  requestId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email(),
});

export const removeWatcherSchema = z.object({
  requestId: z.string().uuid(),
  profileId: z.string().uuid(),
});
