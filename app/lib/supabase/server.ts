import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Server Component / Route Handler client - reads the signed-in user's
// session from cookies (set by the browser client's magic-link sign-in).
// Used to check "who is this request from" in middleware, API routes, and
// the admin page. Respects RLS (a user can only ever read their own rows
// through this client), same as the browser client.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component that can't set cookies (e.g.
            // a page render, not a Route Handler/middleware) - safe to
            // ignore, since middleware already refreshes the session cookie
            // on every request that matters.
          }
        },
      },
    }
  );
}

// Privileged, server-only client using the service_role key - bypasses RLS
// entirely. ONLY used inside API routes for actions that are legitimately
// privileged: creating an access request on the user's behalf (after the
// route itself has verified who the user is via their session), and the
// admin approve/deny actions (after the route has verified the caller's
// email is in ADMIN_EMAILS). Never imported into any client component -
// the "server-only" import above makes that a build-time error if
// accidentally attempted.
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
