"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getUnreadNotificationCount } from "@/app/(app)/notifications/actions";

// "A lightweight poll on the bell component" (docs/BLUEPRINT.md §5.7,
// docs/DECISIONS.md D-12) — no Realtime, no websocket.
const POLL_INTERVAL_MS = 30_000;

export function NotificationBell({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const interval = setInterval(() => {
      getUnreadNotificationCount()
        .then(setCount)
        .catch(() => {
          // A failed poll just keeps the last known count — worth
          // retrying next tick, not worth surfacing an error for.
        });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link
      href="/notifications"
      className="text-muted-foreground hover:text-foreground relative"
      aria-label={count > 0 ? `${count} unread notifications` : "Notifications"}
    >
      Notifications
      {count > 0 && (
        <span className="bg-destructive text-destructive-foreground ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
