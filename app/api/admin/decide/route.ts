import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/app/lib/supabase/server";
import { isAdminEmail, toolTitle } from "@/app/lib/access/toolRegistry";

export const runtime = "nodejs";

// Approve/deny a pending access request. Authorization is the caller's own
// signed-in email being in ADMIN_EMAILS - checked server-side against the
// real session, never trusted from the request body.
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const { requestId, decision } = body || {};
  if (!requestId || (decision !== "approved" && decision !== "denied")) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: row, error: fetchError } = await admin
    .from("tool_access")
    .select("user_email, requester_name, tool_id")
    .eq("id", requestId)
    .single();

  if (fetchError || !row) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  const { error } = await admin
    .from("tool_access")
    .update({ status: decision, decided_at: new Date().toISOString(), decided_by: user!.email })
    .eq("id", requestId);

  if (error) {
    return NextResponse.json({ error: "Could not update the request." }, { status: 500 });
  }

  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://metaworld-academy.vercel.app";
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "MetaWorld Research Academy <onboarding@resend.dev>",
        to: [row.user_email],
        subject: decision === "approved" ? `Access approved: ${toolTitle(row.tool_id)}` : `Access request update: ${toolTitle(row.tool_id)}`,
        text:
          decision === "approved"
            ? `Hi ${row.requester_name},\n\nYour access to "${toolTitle(row.tool_id)}" has been approved. You can now open it here: ${siteUrl}/tools/${row.tool_id}`
            : `Hi ${row.requester_name},\n\nYour access request for "${toolTitle(row.tool_id)}" was not approved at this time.`,
      });
    } catch (err) {
      console.error("[admin/decide] notification email failed (decision was still recorded):", err);
    }
  }

  return NextResponse.json({ status: decision });
}
