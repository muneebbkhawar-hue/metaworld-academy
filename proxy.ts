import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { GATED_TOOL_IDS } from "./app/lib/access/toolRegistry";

// Gates every /tools/<id> route (the tool itself) behind sign-in +
// per-tool approval. /tools (the directory/browse page) is deliberately
// NOT gated - per the brief, everyone can SEE what's on offer, they just
// can't open a locked one until approved.
//
// This runs at the edge before any page renders, so a locked tool's
// client-side code (including anything that would call an R backend or
// Gemini) never even loads for an unapproved visitor - not just hidden
// behind a UI overlay.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const match = pathname.match(/^\/tools\/([^/]+)/);
  if (!match) return NextResponse.next();
  const toolId = match[1];
  if (!GATED_TOOL_IDS.has(toolId)) return NextResponse.next();

  // No Supabase configured yet (e.g. mid-setup, or NEXT_PUBLIC_SUPABASE_URL
  // not set in this environment) - fail OPEN rather than lock out every
  // tool with a broken/blank page. This only matters during initial setup;
  // once the env vars are set in Vercel, gating is fully active.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.next();

  const res = NextResponse.next();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.redirect(new URL(`/request-access/${toolId}`, req.url));
  }

  const { data: access } = await supabase
    .from("tool_access")
    .select("status")
    .eq("user_email", user.email.toLowerCase())
    .eq("tool_id", toolId)
    .maybeSingle();

  if (access?.status === "approved") return res;

  return NextResponse.redirect(new URL(`/request-access/${toolId}`, req.url));
}

export const config = {
  matcher: ["/tools/:path+"],
};
