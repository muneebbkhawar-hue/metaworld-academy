"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Mail, ShieldCheck } from "lucide-react";
import NavComp from "@/app/components/Nav";
import Footer from "@/app/components/Footer";
import { createSupabaseBrowserClient } from "@/app/lib/supabase/client";
import { toolTitle } from "@/app/lib/access/toolRegistry";

interface AccessRequest {
  id: string;
  user_email: string;
  requester_name: string;
  tool_id: string;
  status: "pending" | "approved" | "denied";
  requested_at: string;
  decided_at: string | null;
  decided_by: string | null;
}

type AuthState = "loading" | "not-signed-in" | "not-authorized" | "authorized";

export default function AdminPage() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [emailInput, setEmailInput] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [requests, setRequests] = useState<AccessRequest[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  async function loadRequests() {
    const res = await fetch("/api/admin/requests");
    if (res.status === 403) {
      setAuthState("not-authorized");
      return;
    }
    const data = await res.json();
    setRequests(data.requests || []);
    setAuthState("authorized");
  }

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user?.email) {
        setAuthState("not-signed-in");
        return;
      }
      loadRequests();
    });
  }, []);

  async function sendMagicLink() {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: emailInput.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/admin` },
    });
    if (error) {
      setError(error.message);
      return;
    }
    setLinkSent(true);
  }

  async function decide(requestId: string, decision: "approved" | "denied") {
    setBusyId(requestId);
    setError(null);
    try {
      const res = await fetch("/api/admin/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, decision }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      setRequests((prev) => prev?.map((r) => (r.id === requestId ? { ...r, status: decision } : r)) ?? null);
    } finally {
      setBusyId(null);
    }
  }

  const shown = requests?.filter((r) => filter === "all" || r.status === "pending") ?? [];

  return (
    <>
      <NavComp />
      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-6 flex items-center gap-2">
          <ShieldCheck size={26} className="text-[var(--purple-bright)]" /> Access Requests
        </h1>

        {authState === "loading" && <p className="text-[var(--text-secondary)]">Loading…</p>}

        {authState === "not-signed-in" && (
          <div className="max-w-sm rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6">
            {!linkSent ? (
              <>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Admin email</label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-void)] px-3 py-2 text-sm mb-3"
                />
                <button
                  type="button"
                  onClick={sendMagicLink}
                  className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-white font-semibold text-sm"
                  style={{ backgroundImage: "var(--gradient-primary)" }}
                >
                  <Mail size={16} /> Send sign-in link
                </button>
              </>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">Check your email for a sign-in link.</p>
            )}
            {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
          </div>
        )}

        {authState === "not-authorized" && (
          <p className="text-[var(--text-secondary)]">This page is restricted to admin accounts.</p>
        )}

        {authState === "authorized" && (
          <>
            <div className="flex gap-2 mb-5">
              <button
                type="button"
                onClick={() => setFilter("pending")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border ${filter === "pending" ? "border-[var(--purple-bright)] text-[var(--purple-bright)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)]"}`}
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border ${filter === "all" ? "border-[var(--purple-bright)] text-[var(--purple-bright)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)]"}`}
              >
                All
              </button>
            </div>

            {shown.length === 0 && <p className="text-[var(--text-secondary)]">No requests here.</p>}

            <div className="flex flex-col gap-3">
              {shown.map((r) => (
                <div key={r.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {r.requester_name} <span className="text-[var(--text-secondary)] font-normal">— {r.user_email}</span>
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {toolTitle(r.tool_id)} · requested {new Date(r.requested_at).toLocaleString()}
                    </p>
                  </div>
                  {r.status === "pending" ? (
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => decide(r.id, "approved")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white text-xs font-semibold disabled:opacity-50"
                        style={{ backgroundImage: "var(--gradient-primary)" }}
                      >
                        <CheckCircle2 size={13} /> Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => decide(r.id, "denied")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] disabled:opacity-50"
                      >
                        <XCircle size={13} /> Deny
                      </button>
                    </div>
                  ) : (
                    <span className={`shrink-0 flex items-center gap-1.5 text-xs font-medium ${r.status === "approved" ? "text-green-500" : "text-red-500"}`}>
                      {r.status === "approved" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      {r.status === "approved" ? "Approved" : "Denied"}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {error && <p className="text-sm text-red-500 mt-4">{error}</p>}
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
