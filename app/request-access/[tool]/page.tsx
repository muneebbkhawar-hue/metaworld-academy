"use client";

import { useCallback, useEffect, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, CheckCircle2, Clock, XCircle } from "lucide-react";
import NavComp from "@/app/components/Nav";
import Footer from "@/app/components/Footer";
import { createSupabaseBrowserClient } from "@/app/lib/supabase/client";
import { toolTitle, GATED_TOOL_IDS } from "@/app/lib/access/toolRegistry";

type ViewState =
  | { kind: "loading" }
  | { kind: "not-signed-in" }
  | { kind: "code-sent"; email: string }
  | { kind: "no-request"; email: string }
  | { kind: "pending"; email: string }
  | { kind: "denied"; email: string }
  | { kind: "approved" };

export default function RequestAccessPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = usePromise(params);
  const router = useRouter();
  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [emailInput, setEmailInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = toolTitle(tool);
  const known = GATED_TOOL_IDS.has(tool);

  // Resolves the view once we know who's signed in (or that nobody is) -
  // shared by the initial page load and by a successful code verification,
  // so both paths land on the exact same pending/approved/denied/no-request
  // logic.
  const resolveForUser = useCallback(
    async (email: string | undefined | null) => {
      if (!email) {
        setState({ kind: "not-signed-in" });
        return;
      }
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("tool_access")
        .select("status")
        .eq("user_email", email.toLowerCase())
        .eq("tool_id", tool)
        .maybeSingle();
      if (data?.status === "approved") {
        setState({ kind: "approved" });
        router.replace(`/tools/${tool}`);
      } else if (data?.status === "denied") {
        setState({ kind: "denied", email });
      } else if (data?.status === "pending") {
        setState({ kind: "pending", email });
      } else {
        setState({ kind: "no-request", email });
      }
    },
    [tool, router]
  );

  useEffect(() => {
    if (!known) return;
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => resolveForUser(user?.email));
  }, [known, resolveForUser]);

  // Sends a 6-digit one-time code by email rather than a clickable magic
  // link. Clickable links get silently "pre-clicked" and invalidated by
  // Gmail/corporate email security scanners before the real user ever
  // clicks them (a well-documented Supabase issue) - a typed-in code has
  // nothing for a scanner to prefetch, so it can't be broken that way.
  async function sendCode() {
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({ email: emailInput.trim() });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setState({ kind: "code-sent", email: emailInput.trim() });
  }

  async function verifyCode() {
    if (state.kind !== "code-sent") return;
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email: state.email,
      token: codeInput.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    await resolveForUser(data.user?.email);
  }

  async function submitRequest() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId: tool, name: nameInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setBusy(false);
        return;
      }
      if (data.status === "approved") {
        setState({ kind: "approved" });
        router.replace(`/tools/${tool}`);
        return;
      }
      setState((s) => (s.kind === "no-request" ? { kind: "pending", email: s.email } : s));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <NavComp />
      <main className="max-w-lg mx-auto px-6 py-20">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-8 text-center">
          <Lock size={28} className="mx-auto mb-4 text-[var(--purple-bright)]" />
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            {known ? title : "Unknown tool"}
          </h1>

          {!known && <p className="text-[var(--text-secondary)]">This tool doesn&apos;t exist.</p>}

          {known && state.kind === "loading" && <p className="text-[var(--text-secondary)]">Checking access…</p>}

          {known && state.kind === "not-signed-in" && (
            <div className="text-left">
              <p className="text-[var(--text-secondary)] mb-4 text-center">
                This tool requires approved access. Enter your email to sign in and request access.
              </p>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Email</label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-void)] px-3 py-2 text-sm mb-3"
              />
              <button
                type="button"
                onClick={sendCode}
                disabled={busy || !emailInput.includes("@")}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-50"
                style={{ backgroundImage: "var(--gradient-primary)" }}
              >
                <Mail size={16} /> {busy ? "Sending…" : "Send me a sign-in code"}
              </button>
            </div>
          )}

          {known && state.kind === "code-sent" && (
            <div className="text-left">
              <p className="text-[var(--text-secondary)] mb-4 text-center">
                We sent a 6-digit code to <strong>{state.email}</strong>. Enter it below.
              </p>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Code</label>
              <input
                type="text"
                inputMode="numeric"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verifyCode()}
                placeholder="123456"
                className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-void)] px-3 py-2 text-sm mb-3 text-center tracking-widest text-lg"
              />
              <button
                type="button"
                onClick={verifyCode}
                disabled={busy || codeInput.trim().length < 6}
                className="w-full px-5 py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-50"
                style={{ backgroundImage: "var(--gradient-primary)" }}
              >
                {busy ? "Verifying…" : "Verify"}
              </button>
            </div>
          )}

          {known && state.kind === "no-request" && (
            <div className="text-left">
              <p className="text-[var(--text-secondary)] mb-4 text-center">
                Signed in as <strong>{state.email}</strong>. Enter your name to request access.
              </p>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Full name</label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-void)] px-3 py-2 text-sm mb-3"
              />
              <button
                type="button"
                onClick={submitRequest}
                disabled={busy || !nameInput.trim()}
                className="w-full px-5 py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-50"
                style={{ backgroundImage: "var(--gradient-primary)" }}
              >
                {busy ? "Submitting…" : "Request Access"}
              </button>
            </div>
          )}

          {known && state.kind === "pending" && (
            <p className="text-[var(--text-secondary)] flex flex-col items-center gap-2">
              <Clock size={20} className="text-amber-500" />
              Your request is pending review. You&apos;ll be able to open this tool once approved.
            </p>
          )}

          {known && state.kind === "denied" && (
            <div className="flex flex-col items-center gap-3">
              <XCircle size={20} className="text-red-500" />
              <p className="text-[var(--text-secondary)]">Your request for this tool was not approved.</p>
              <button
                type="button"
                onClick={() => setState({ kind: "no-request", email: (state as { email: string }).email })}
                className="text-sm text-[var(--purple-bright)] hover:underline"
              >
                Request again
              </button>
            </div>
          )}

          {known && state.kind === "approved" && (
            <p className="text-[var(--text-secondary)] flex flex-col items-center gap-2">
              <CheckCircle2 size={20} className="text-green-500" /> Approved — redirecting…
            </p>
          )}

          {error && <p className="text-sm text-red-500 mt-4">{error}</p>}
        </div>
      </main>
      <Footer />
    </>
  );
}
