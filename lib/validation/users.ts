import { z } from "zod";

// super_admin deliberately excluded — never an ordinary role-selector
// option (docs/DECISIONS.md D-04, docs/PRODUCT_SPEC.md §3).
export const assignableRoleSchema = z.enum(["viewer", "admin"]);

export const assignRoleSchema = z.object({
  targetId: z.string().uuid(),
  role: assignableRoleSchema,
});

export const targetUserSchema = z.object({
  targetId: z.string().uuid(),
});
