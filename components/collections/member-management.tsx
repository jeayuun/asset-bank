"use client";

import { type FormEvent, useState, useTransition } from "react";

import {
  addCollectionMemberByEmail,
  removeCollectionMember,
} from "@/app/(app)/collections/actions";
import { Button } from "@/components/ui/button";

interface Member {
  profileId: string;
  email: string;
  canEdit: boolean;
}

export function MemberManagement({
  collectionId,
  members,
}: {
  collectionId: string;
  members: Member[];
}) {
  const [email, setEmail] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await addCollectionMemberByEmail({ collectionId, email, canEdit });
        setEmail("");
        setCanEdit(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add member");
      }
    });
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Members</h2>
      {members.length === 0 ? (
        <p className="text-muted-foreground text-xs">No members added yet.</p>
      ) : (
        <ul className="space-y-1">
          {members.map((member) => (
            <li
              key={member.profileId}
              className="flex items-center justify-between text-sm"
            >
              <span>
                {member.email}{" "}
                <span className="text-muted-foreground text-xs">
                  {member.canEdit ? "· can edit" : "· can view"}
                </span>
              </span>
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(() =>
                    removeCollectionMember({
                      collectionId,
                      profileId: member.profileId,
                    }),
                  )
                }
                className="text-destructive text-xs hover:opacity-80"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-3 pt-2"
      >
        <div className="flex flex-col gap-1">
          <label
            htmlFor="member-email"
            className="text-muted-foreground text-xs font-medium"
          >
            Add member by email
          </label>
          <input
            id="member-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="border-input bg-background h-9 w-56 rounded-md border px-3 text-sm"
            placeholder="name@example.com"
          />
        </div>
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={canEdit}
            onChange={(event) => setCanEdit(event.target.checked)}
          />
          Can edit
        </label>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Adding…" : "Add"}
        </Button>
        {error && (
          <p role="alert" className="text-destructive w-full text-xs">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
