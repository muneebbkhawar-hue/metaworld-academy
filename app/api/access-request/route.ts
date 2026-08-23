import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/app/lib/supabase/server";
import { GATED_TOOL_IDS, toolTitle, ADMIN_EMAILS } from "@/app/lib/access/toolRegistry";

export const runtime = "nodejs";

// Creates (or re-notifies on) a pending access request for the SIGNED-IN
// user - the requester's identity comes from their Supabase session, not
// from the request body, so nobody can submit a request as someone else.
// Uses the service-role client to write the row (bypasses RLS - the
// server has already established who the caller actually is via their
// session, which is the real authorization check here).
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "You must be signed in to request access." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const toolId = body?.toolId;
  const requesterName = typeof body?.name === "string" ? body.name.trim() : "";
  if (!toolId || !GATED_TOOL_IDS.has(toolId)) {
    return NextResponse.json({ error: "Unknown tool." }, { status: 400 });
  }
  if (!requesterName) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }

  const email = user.email.toLowerCase();
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from("tool_access")
    .select("status")
    .eq("user_email", email)
    .eq("tool_id", toolId)
    .maybeSingle();

  if (existing?.status === "approved") {
    return NextResponse.json({ status: "approved" });
  }

  // Upsert: a previously denied user can ask again (re-submitting resets
  // them to pending) - a currently-pending request is just left as is
  // rather than erroring, so re-clicking "Request Access" is harmless.
  const { error } = await admin.from("tool_access").upsert(
    {
      user_email: email,
      requester_name: requesterName,
      tool_id: toolId,
      status: "pending",
      requested_at: new Date().toISOString(),
      decided_at: null,
      decided_by: null,
    },
    { onConflict: "user_email,tool_id" }
  );

  if (error) {
    console.error("[access-request] failed to write request:", error.message);
    return NextResponse.json({ error: "Could not submit your request. Please try again." }, { status: 500 });
  }

  // Best-effort email notification - a failure here must never block the
  // request itself from being recorded (admins can still see it in the
  // admin panel even if the email never arrives).
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "MetaWorld Research Academy <onboarding@resend.dev>",
        to: ADMIN_EMAILS,
        subject: `Access request: ${requesterName} - ${toolTitle(toolId)}`,
        text: `${requesterName} (${email}) is requesting access to "${toolTitle(toolId)}".\n\nReview and approve/deny at: ${process.env.NEXT_PUBLIC_SITE_URL || "https://metaworld-academy.vercel.app"}/admin`,
      });
    } catch (err) {
      console.error("[access-request] email notification failed (request was still recorded):", err);
    }
  }

  return NextResponse.json({ status: "pending" });
}
