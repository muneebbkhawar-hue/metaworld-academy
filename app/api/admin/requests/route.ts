import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/app/lib/supabase/server";
import { isAdminEmail } from "@/app/lib/access/toolRegistry";

export const runtime = "nodejs";

// Lists every access request (all users, all tools) - admin-only, since
// RLS on the browser client restricts a normal user to their own rows.
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("tool_access")
    .select("id, user_email, requester_name, tool_id, status, requested_at, decided_at, decided_by")
    .order("requested_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Could not load requests." }, { status: 500 });
  }

  return NextResponse.json({ requests: data });
}
