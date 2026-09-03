"use client";

import Link from "next/link";
import { type FormEvent, useState, useTransition } from "react";

import { createAsset } from "@/app/(admin)/admin/assets/actions";
import { Button } from "@/components/ui/button";

interface AssetFormProps {
  assetTypes: { id: string; name: string; slug: string }[];
  keyStages: { id: string; code: string }[];
  characterProfiles: {
    id: string;
    name: string;
    profile_code: string | null;
    grades: { label: string } | null;
  }[];
}

export function AssetForm({
  assetTypes,
  keyStages,
  characterProfiles,
}: AssetFormProps) {
  const [title, setTitle] = useState("");
  const [assetTypeId, setAssetTypeId] = useState(assetTypes[0]?.id ?? "");
  const [drivePngUrl, setDrivePngUrl] = useState("");
  const [driveEpsUrl, setDriveEpsUrl] = useState("");
  const [driveMp4Url, setDriveMp4Url] = useState("");
  const [primaryMedia, setPrimaryMedia] = useState<"image" | "video">("image");
  const [selectedKeyStages, setSelectedKeyStages] = useState<string[]>([]);
  const [characterProfileId, setCharacterProfileId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isCharacterType =
    assetTypes.find((type) => type.id === assetTypeId)?.slug === "characters";

  function toggleKeyStage(id: string) {
    setSelectedKeyStages((current) =>
      current.includes(id) ? current.filter((k) => k !== id) : [...current, id],
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createAsset({
          title,
          assetTypeId,
          drivePngUrl: drivePngUrl || null,
          driveEpsUrl: driveEpsUrl || null,
          driveMp4Url: driveMp4Url || null,
          primaryMedia,
          keyStageIds: selectedKeyStages,
          characterProfileId: isCharacterType
            ? characterProfileId || null
            : null,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create asset");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border max-w-xl space-y-4 rounded-lg border p-6"
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor="asset-title"
          className="text-muted-foreground text-xs font-medium"
        >
          Title
        </label>
        <input
          id="asset-title"
          type="text"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          placeholder="Girl student waving KS1"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="asset-type"
          className="text-muted-foreground text-xs font-medium"
        >
          Asset type
        </label>
        <select
          id="asset-type"
          value={assetTypeId}
          onChange={(event) => setAssetTypeId(event.target.value)}
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        >
          {assetTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </div>

      {isCharacterType && (
        <div className="flex flex-col gap-1">
          <label
            htmlFor="character-profile"
            className="text-muted-foreground text-xs font-medium"
          >
            Character profile
          </label>
          <select
            id="character-profile"
            value={characterProfileId}
            onChange={(event) => setCharacterProfileId(event.target.value)}
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
          >
            <option value="">Choose a profile…</option>
            {characterProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
                {profile.grades ? ` (${profile.grades.label})` : ""}
                {profile.profile_code ? ` — ${profile.profile_code}` : ""}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-xs">
            Manage profiles on the{" "}
            <Link href="/admin/characters" className="underline">
              Characters
            </Link>{" "}
            page. The pose (e.g. Waving) and lesson usage are set after creating
            this asset.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label
          htmlFor="drive-png"
          className="text-muted-foreground text-xs font-medium"
        >
          Drive PNG link
        </label>
        <input
          id="drive-png"
          type="url"
          value={drivePngUrl}
          onChange={(event) => setDrivePngUrl(event.target.value)}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          placeholder="https://drive.google.com/file/d/…/view"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="drive-eps"
          className="text-muted-foreground text-xs font-medium"
        >
          Drive EPS link
        </label>
        <input
          id="drive-eps"
          type="url"
          value={driveEpsUrl}
          onChange={(event) => setDriveEpsUrl(event.target.value)}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="drive-mp4"
          className="text-muted-foreground text-xs font-medium"
        >
          Drive MP4 link
        </label>
        <input
          id="drive-mp4"
          type="url"
          value={driveMp4Url}
          onChange={(event) => setDriveMp4Url(event.target.value)}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="primary-media"
          className="text-muted-foreground text-xs font-medium"
        >
          Primary media
        </label>
        <select
          id="primary-media"
          value={primaryMedia}
          onChange={(event) =>
            setPrimaryMedia(event.target.value as "image" | "video")
          }
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        >
          <option value="image">Image</option>
          <option value="video">Video</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs font-medium">
          Key Stages
        </span>
        <div className="flex flex-wrap gap-3">
          {keyStages.map((ks) => (
            <label key={ks.id} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={selectedKeyStages.includes(ks.id)}
                onChange={() => toggleKeyStage(ks.id)}
              />
              {ks.code}
            </label>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create asset"}
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </form>
  );
}
