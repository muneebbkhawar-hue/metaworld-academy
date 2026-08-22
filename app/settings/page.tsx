"use client";

import { useEffect, useState } from "react";
import Nav from "../components/Nav";

// Desktop-app-only Settings page. On the live website this page still
// technically renders (Next.js doesn't have per-page "desktop only" route
// exclusion), but /api/desktop-settings 404s there, so it correctly shows
// "not available in the browser version" - it never silently pretends a
// save worked on Vercel where there's no local machine to save a key to.
export default function SettingsPage() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [modelInput, setModelInput] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    fetch("/api/desktop-settings")
      .then((res) => {
        if (!res.ok) { setAvailable(false); return null; }
        setAvailable(true);
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setHasKey(Boolean(data.hasGeminiKey));
        setModelInput(data.geminiModel || "");
      })
      .catch(() => setAvailable(false));
  }, []);

  async function save() {
    setStatus("saving");
    try {
      const res = await fetch("/api/desktop-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geminiApiKey: keyInput, geminiModel: modelInput || undefined }),
      });
      if (!res.ok) throw new Error();
      setStatus("saved");
      setHasKey(keyInput.length > 0);
      setKeyInput("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <Nav />
      <main className="max-w-2xl mx-auto px-6 py-16 text-[var(--text-primary)]">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-[var(--text-secondary)] mb-8">
          Your Gemini API key powers the AI-Assisted Risk of Bias and Meta-Analysis Data Extraction tools. It is
          stored only on this computer and is never sent anywhere except directly to Google&apos;s Gemini API.
        </p>

        {available === false && (
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6">
            This page only works in the MetaWorld Research Academy desktop app - it isn&apos;t available in the
            browser version of the site.
          </div>
        )}

        {available === true && (
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Gemini API key</label>
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder={hasKey ? "A key is already saved - enter a new one to replace it" : "Paste your Gemini API key"}
                className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-void)] px-3 py-2 text-sm"
              />
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Get a free key at{" "}
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline">
                  aistudio.google.com/apikey
                </a>
                . Status: {hasKey ? "a key is saved" : "no key saved yet"}.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Gemini model (optional)</label>
              <input
                type="text"
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                placeholder="gemini-3.6-flash (default)"
                className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-void)] px-3 py-2 text-sm"
              />
            </div>

            <button
              type="button"
              onClick={save}
              disabled={status === "saving"}
              className="self-start px-5 py-2 rounded-lg text-white font-semibold text-sm disabled:opacity-60"
              style={{ backgroundImage: "var(--gradient-primary)" }}
            >
              {status === "saving" ? "Saving..." : "Save"}
            </button>

            {status === "saved" && (
              <p className="text-sm text-green-500">
                Saved. Restart the app for the AI tools to pick up this change.
              </p>
            )}
            {status === "error" && <p className="text-sm text-red-500">Could not save - please try again.</p>}
          </div>
        )}
      </main>
    </>
  );
}
