"use client";

// Browser-side Supabase client - used for the passwordless email magic-link
// sign-in flow and for a signed-in user reading their OWN access-request
// rows (RLS-restricted, see supabase/schema.sql). Never used for anything
// privileged - approving/denying requests always goes through a server
// route using the service-role client (see server.ts).
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
