import { z } from "zod";

export const notificationTypes = [
  "request_status_changed",
  "request_assigned",
  "request_comment",
] as const;

export const markNotificationReadSchema = z.object({
  notificationId: z.string().uuid(),
});

export const deleteNotificationSchema = z.object({
  notificationId: z.string().uuid(),
});

export const setNotificationPreferenceSchema = z.object({
  type: z.enum(notificationTypes),
  inApp: z.boolean(),
  email: z.boolean(),
});
