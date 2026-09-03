"use client";

import { type FormEvent, useState, useTransition } from "react";

import { addWatcherByEmail, removeWatcher } from "@/app/(app)/requests/actions";
import { Button } from "@/components/ui/button";

export interface Watcher {
  profileId: string;
  email: string;
}

export function WatcherList({
  requestId,
  watchers,
  isAdmin,
}: {
  requestId: string;
  watchers: Watcher[];
  isAdmin: boolean;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await addWatcherByEmail({ requestId, email });
        setEmail("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add watcher");
      }
    });
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Watchers</h2>
      {watchers.length === 0 ? (
        <p className="text-muted-foreground text-sm">No watchers.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {watchers.map((watcher) => (
            <li
              key={watcher.profileId}
              className="flex items-center justify-between"
            >
              <span>{watcher.email}</span>
              {isAdmin && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(() =>
                      removeWatcher({
                        requestId,
                        profileId: watcher.profileId,
                      }),
                    )
                  }
                  className="text-destructive text-xs hover:opacity-80"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isAdmin && (
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="watcher-email"
              className="text-muted-foreground text-xs font-medium"
            >
              Add watcher by email
            </label>
            <input
              id="watcher-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="border-input bg-background h-9 w-56 rounded-md border px-3 text-sm"
              placeholder="name@example.com"
            />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Adding…" : "Add"}
          </Button>
          {error && (
            <p role="alert" className="text-destructive w-full text-xs">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
