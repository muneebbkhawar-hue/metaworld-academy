"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import type { ConversionResult } from "@/app/lib/statConversions/conversions";

const CERTAINTY_LABEL: Record<ConversionResult["certainty"], string> = {
  exact: "EXACT CONVERSION",
  estimated: "ESTIMATED CONVERSION",
  "assumption-based": "ASSUMPTION-BASED CONVERSION",
};
const CERTAINTY_CLASS: Record<ConversionResult["certainty"], string> = {
  exact: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  estimated: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  "assumption-based": "bg-rose-500/10 text-rose-300 border-rose-500/30",
};

function fmt(v: number, decimals = 4): string {
  if (!Number.isFinite(v)) return "—";
  return Number(v.toFixed(decimals)).toString();
}

export default function ResultCard({ result }: { result: ConversionResult }) {
  const [methodOpen, setMethodOpen] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  function copyValue(i: number, label: string, value: number) {
    navigator.clipboard?.writeText(`${label}: ${fmt(value)}`).then(() => {
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx((c) => (c === i ? null : c)), 1500);
    });
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-void)] p-4 space-y-3">
      <span className={`inline-block px-2 py-1 rounded-md border text-[11px] font-semibold tracking-wide ${CERTAINTY_CLASS[result.certainty]}`}>
        {CERTAINTY_LABEL[result.certainty]}
      </span>

      <div className="grid sm:grid-cols-2 gap-3">
        {result.values.map((v, i) => (
          <div key={v.label} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--bg-surface-2)] px-3 py-2">
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">{v.label}</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">{fmt(v.value, v.decimals)}</p>
            </div>
            <button
              onClick={() => copyValue(i, v.label, v.value)}
              aria-label={`Copy ${v.label}`}
              className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--purple-bright)] hover:bg-[var(--bg-void)] focus-visible:outline-2 focus-visible:outline-[var(--purple-bright)]"
            >
              {copiedIdx === i ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        ))}
      </div>

      {result.warnings.map((w, i) => (
        <p key={i} className="text-xs text-amber-300 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">⚠ {w}</p>
      ))}

      <button
        onClick={() => setMethodOpen((o) => !o)}
        aria-expanded={methodOpen}
        className="flex items-center gap-1.5 text-xs font-medium text-[var(--purple-bright)]"
      >
        {methodOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        Method / Formula
      </button>
      {methodOpen && (
        <div className="text-xs text-[var(--text-secondary)] space-y-1.5 border-t border-[var(--border-subtle)] pt-2">
          <p><span className="text-[var(--text-tertiary)]">Method:</span> {result.method}</p>
          <p><span className="text-[var(--text-tertiary)]">Reference:</span> {result.reference}</p>
          {result.assumptions.length > 0 && (
            <div>
              <span className="text-[var(--text-tertiary)]">Assumptions:</span>
              <ul className="list-disc list-inside">
                {result.assumptions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
