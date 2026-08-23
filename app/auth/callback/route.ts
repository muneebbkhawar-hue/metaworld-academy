import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase/server";

// Supabase's magic-link email points here with a one-time `code` - this
// exchanges it for a real session (setting the auth cookies), then sends
// the user back to wherever they were trying to go (?next=...), defaulting
// to the tools directory.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = req.nextUrl.searchParams.get("next") || "/tools";

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, req.url));
}
