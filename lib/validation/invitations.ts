import { z } from "zod";

export const invitationRoleSchema = z.enum(["viewer", "admin"]);

export const createInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: invitationRoleSchema,
  defaultKeyStageId: z.string().uuid().nullable().optional(),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const invitationIdSchema = z.object({
  invitationId: z.string().uuid(),
});
