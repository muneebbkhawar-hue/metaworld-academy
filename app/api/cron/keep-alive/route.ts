import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

// Supabase's free tier pauses a project after 7 days with no database
// activity - this makes one trivial query daily (see vercel.json's cron
// entry) so the access-request system never silently goes to sleep.
// Vercel's free Cron Jobs feature calls this automatically; it does
// nothing else and is safe to hit manually or extra times.
export async function GET() {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("tool_access").select("id", { count: "exact", head: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[cron/keep-alive] failed:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
