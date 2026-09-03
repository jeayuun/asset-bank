"use client";

import { type FormEvent, useState, useTransition } from "react";

import { createCharacterProfile } from "@/app/(admin)/admin/characters/actions";
import { Button } from "@/components/ui/button";

interface TermOption {
  id: string;
  name: string;
}

export function CharacterProfileForm({
  gradeId,
  characterTypes,
  genders,
  characterGroups,
}: {
  gradeId: string;
  characterTypes: TermOption[];
  genders: TermOption[];
  characterGroups: TermOption[];
}) {
  const [name, setName] = useState("");
  const [profileCode, setProfileCode] = useState("");
  const [characterTypeTermId, setCharacterTypeTermId] = useState("");
  const [genderTermId, setGenderTermId] = useState("");
  const [characterGroupTermId, setCharacterGroupTermId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setWarning(null);
    startTransition(async () => {
      try {
        const result = await createCharacterProfile({
          name,
          gradeId,
          profileCode: profileCode || null,
          characterTypeTermId: characterTypeTermId || null,
          genderTermId: genderTermId || null,
          characterGroupTermId: characterGroupTermId || null,
        });
        setName("");
        setProfileCode("");
        setCharacterTypeTermId("");
        setGenderTermId("");
        setCharacterGroupTermId("");
        setWarning(result.duplicateWarning);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to create character profile",
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
          htmlFor="character-name"
          className="text-muted-foreground text-xs font-medium"
        >
          Name
        </label>
        <input
          id="character-name"
          type="text"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="border-input bg-background h-9 w-48 rounded-md border px-3 text-sm"
          placeholder="Mia"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="character-code"
          className="text-muted-foreground text-xs font-medium"
        >
          Profile code
        </label>
        <input
          id="character-code"
          type="text"
          value={profileCode}
          onChange={(event) => setProfileCode(event.target.value)}
          className="border-input bg-background h-9 w-32 rounded-md border px-3 text-sm"
          placeholder="Optional"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="character-type"
          className="text-muted-foreground text-xs font-medium"
        >
          Character type
        </label>
        <select
          id="character-type"
          value={characterTypeTermId}
          onChange={(event) => setCharacterTypeTermId(event.target.value)}
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        >
          <option value="">—</option>
          {characterTypes.map((term) => (
            <option key={term.id} value={term.id}>
              {term.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="character-gender"
          className="text-muted-foreground text-xs font-medium"
        >
          Gender
        </label>
        <select
          id="character-gender"
          value={genderTermId}
          onChange={(event) => setGenderTermId(event.target.value)}
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        >
          <option value="">—</option>
          {genders.map((term) => (
            <option key={term.id} value={term.id}>
              {term.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="character-group"
          className="text-muted-foreground text-xs font-medium"
        >
          Character group
        </label>
        <select
          id="character-group"
          value={characterGroupTermId}
          onChange={(event) => setCharacterGroupTermId(event.target.value)}
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        >
          <option value="">—</option>
          {characterGroups.map((term) => (
            <option key={term.id} value={term.id}>
              {term.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Adding…" : "Add character profile"}
      </Button>
      {error && (
        <p role="alert" className="text-destructive w-full text-xs">
          {error}
        </p>
      )}
      {warning && (
        <p className="text-muted-foreground w-full text-xs">{warning}</p>
      )}
    </form>
  );
}
