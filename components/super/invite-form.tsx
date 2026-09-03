"use client";

import { type FormEvent, useState, useTransition } from "react";

import { createInvitation } from "@/app/(super)/super/invitations/actions";
import { Button } from "@/components/ui/button";
import { gmailAliasWarning } from "@/lib/auth/invitations";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "admin">("viewer");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const warning = gmailAliasWarning(email);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createInvitation({ email, role });
        setEmail("");
        setRole("viewer");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to send invitation",
        );
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border flex flex-wrap items-end gap-3 rounded-lg border p-4"
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor="invite-email"
          className="text-muted-foreground text-xs font-medium"
        >
          Email
        </label>
        <input
          id="invite-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="border-input bg-background h-9 w-64 rounded-md border px-3 text-sm"
          placeholder="person@example.com"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="invite-role"
          className="text-muted-foreground text-xs font-medium"
        >
          Role
        </label>
        <select
          id="invite-role"
          value={role}
          onChange={(event) =>
            setRole(event.target.value as "viewer" | "admin")
          }
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        >
          <option value="viewer">Viewer</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Sending…" : "Send invitation"}
      </Button>
      {warning && (
        <p className="text-muted-foreground w-full text-xs">{warning}</p>
      )}
      {error && (
        <p role="alert" className="text-destructive w-full text-xs">
          {error}
        </p>
      )}
    </form>
  );
}
