"use client";

import { useState, useTransition } from "react";

import {
  setAssetPoseAction,
  updateAsset,
} from "@/app/(admin)/admin/assets/actions";
import { Button } from "@/components/ui/button";

interface Option {
  id: string;
  label: string;
}

export function CharacterAssignment({
  assetId,
  characterProfiles,
  poseActionTerms,
  currentCharacterProfileId,
  currentPoseActionTermId,
}: {
  assetId: string;
  characterProfiles: Option[];
  poseActionTerms: Option[];
  currentCharacterProfileId: string | null;
  currentPoseActionTermId: string | null;
}) {
  const [characterProfileId, setCharacterProfileId] = useState(
    currentCharacterProfileId ?? "",
  );
  const [poseActionTermId, setPoseActionTermId] = useState(
    currentPoseActionTermId ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateAsset({
          assetId,
          characterProfileId: characterProfileId || null,
        });
        await setAssetPoseAction({
          assetId,
          poseActionTermId: poseActionTermId || null,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Character & pose</h2>
      <p className="text-muted-foreground text-xs">
        Both are required before this asset can be published (docs/BLUEPRINT.md
        §8).
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="edit-character-profile"
            className="text-muted-foreground text-xs font-medium"
          >
            Character profile
          </label>
          <select
            id="edit-character-profile"
            value={characterProfileId}
            onChange={(event) => setCharacterProfileId(event.target.value)}
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
          >
            <option value="">—</option>
            {characterProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="edit-pose-action"
            className="text-muted-foreground text-xs font-medium"
          >
            Pose / action
          </label>
          <select
            id="edit-pose-action"
            value={poseActionTermId}
            onChange={(event) => setPoseActionTermId(event.target.value)}
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
          >
            <option value="">—</option>
            {poseActionTerms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.label}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={handleSave}
        >
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
