"use client";

import { useTransition } from "react";

import { resendInvitation, revokeInvitation } from "./actions";

export function InvitationActions({ invitationId }: { invitationId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex justify-end gap-3 text-xs">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(() => resendInvitation({ invitationId }))
        }
        className="text-muted-foreground hover:text-foreground"
      >
        Resend
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(() => revokeInvitation({ invitationId }))
        }
        className="text-destructive hover:opacity-80"
      >
        Revoke
      </button>
    </div>
  );
}
