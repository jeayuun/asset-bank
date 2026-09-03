import type { Metadata } from "next";
import Link from "next/link";

import { CreateCollectionForm } from "@/components/collections/create-collection-form";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Collections — Asset Bank",
};

export default async function CollectionsPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data: collections } = await supabase
    .from("collections")
    .select("id, name, description, visibility, owner_id")
    .order("created_at", { ascending: false });

  const rows = collections ?? [];
  const myCollections = rows.filter((c) => c.owner_id === profile?.id);
  const teamCollections = rows.filter(
    (c) => c.visibility === "team" && c.owner_id !== profile?.id,
  );

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Collections</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Personal collections are visible only to you. Team-shared collections
          are visible to everyone.
        </p>
      </div>

      <CreateCollectionForm />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">My collections</h2>
        {myCollections.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            You haven&apos;t created a collection yet.
          </p>
        ) : (
          <ul className="divide-border border-border divide-y rounded-lg border">
            {myCollections.map((collection) => (
              <li key={collection.id}>
                <Link
                  href={`/collections/${collection.id}`}
                  className="hover:bg-accent flex items-center justify-between px-4 py-3 text-sm"
                >
                  <span>{collection.name}</span>
                  <span className="text-muted-foreground text-xs capitalize">
                    {collection.visibility}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Team-shared collections</h2>
        {teamCollections.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No team-shared collections yet.
          </p>
        ) : (
          <ul className="divide-border border-border divide-y rounded-lg border">
            {teamCollections.map((collection) => (
              <li key={collection.id}>
                <Link
                  href={`/collections/${collection.id}`}
                  className="hover:bg-accent block px-4 py-3 text-sm"
                >
                  {collection.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
