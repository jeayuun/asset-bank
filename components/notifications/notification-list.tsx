"use client";

import Link from "next/link";
import { useTransition } from "react";

import {
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/(app)/notifications/actions";
import { Button } from "@/components/ui/button";

export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  readAt: string | null;
  createdAt: string;
  emailStatus: string;
  emailError: string | null;
}

export function NotificationList({
  notifications,
}: {
  notifications: NotificationItem[];
}) {
  const [isPending, startTransition] = useTransition();
  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <div className="space-y-3">
      {hasUnread && (
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => startTransition(() => markAllNotificationsRead())}
        >
          Mark all as read
        </Button>
      )}

      {notifications.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">
          No notifications yet.
        </p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={
                notification.readAt ? "px-4 py-3" : "bg-accent/50 px-4 py-3"
              }
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  {notification.url ? (
                    <Link
                      href={notification.url}
                      className="text-sm font-medium underline"
                      onClick={() => {
                        if (!notification.readAt) {
                          startTransition(() =>
                            markNotificationRead({
                              notificationId: notification.id,
                            }),
                          );
                        }
                      }}
                    >
                      {notification.title}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium">{notification.title}</p>
                  )}
                  {notification.body && (
                    <p className="text-muted-foreground mt-1 text-sm">
                      {notification.body}
                    </p>
                  )}
                  <p className="text-muted-foreground mt-1 text-xs">
                    {new Date(notification.createdAt).toLocaleString()}
                    {notification.emailStatus === "failed" && (
                      <span className="text-destructive">
                        {" "}
                        · notification email failed
                        {notification.emailError
                          ? ` (${notification.emailError})`
                          : ""}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2 text-xs">
                  {!notification.readAt && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(() =>
                          markNotificationRead({
                            notificationId: notification.id,
                          }),
                        )
                      }
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Mark read
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(() =>
                        deleteNotification({ notificationId: notification.id }),
                      )
                    }
                    className="text-destructive hover:opacity-80"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
