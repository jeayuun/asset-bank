import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * OAuth code exchange, then profile check, then redirect to /, /no-access,
 * or /suspended (docs/BLUEPRINT.md §13). Middleware re-checks the same
 * live profile on every subsequent request — this route only handles the
 * first hop back from Google.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/no-access`);
  }

  if (profile.status === "suspended") {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/suspended`);
  }

  await supabase.schema("app").rpc("log_sign_in");

  return NextResponse.redirect(origin);
}
