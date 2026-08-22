"use client";

import type { VariableDictionaryEntry } from "@/app/lib/extraction/types";

const THRESHOLDS = [30, 40, 50, 60, 70, 80];

const CLASS_STYLE: Record<VariableDictionaryEntry["classification"], string> = {
  "COMMON VARIABLE": "bg-emerald-500/15 text-emerald-300",
  "IMPORTANT POTENTIAL MODERATOR": "bg-[var(--purple-primary)]/15 text-[var(--purple-bright)]",
  "RARE VARIABLE": "bg-[var(--bg-surface-2)] text-[var(--text-tertiary)]",
};

function Table({ title, entries }: { title: string; entries: VariableDictionaryEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">{title}</h4>
      <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-[var(--bg-surface-2)] sticky top-0">
            <tr className="text-left text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
              <th className="px-3 py-2">Variable</th>
              <th className="px-3 py-2">Original labels</th>
              <th className="px-3 py-2">Reporting</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Recommended</th>
              <th className="px-3 py-2">Classification</th>
            </tr>
          </thead>
          <tbody>
            {entries.sort((a, b) => b.reporting_pct - a.reporting_pct).map((e) => (
              <tr key={e.canonical_variable} className="border-t border-[var(--border-subtle)]">
                <td className="px-3 py-2 font-medium text-[var(--text-primary)]">{e.canonical_variable}</td>
                <td className="px-3 py-2 text-[var(--text-tertiary)] max-w-xs truncate" title={e.original_labels.join(", ")}>{e.original_labels.join(", ")}</td>
                <td className="px-3 py-2 text-[var(--text-secondary)]">{e.reporting_count}/{e.studies_total} ({e.reporting_pct}%)</td>
                <td className="px-3 py-2 text-[var(--text-secondary)]">{e.conflicting_units ? <span className="text-amber-300">mixed</span> : e.typical_unit ?? "—"}</td>
                <td className="px-3 py-2">{e.recommended ? "Yes" : "No"}</td>
                <td className="px-3 py-2"><span className={`text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap ${CLASS_STYLE[e.classification]}`}>{e.classification}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function VariableFrequencyReport({
  studyCharacteristics, baselineCharacteristics, threshold, onThresholdChange,
}: {
  studyCharacteristics: VariableDictionaryEntry[];
  baselineCharacteristics: VariableDictionaryEntry[];
  threshold: number | null;
  onThresholdChange: (t: number | null) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mr-1">Recommendation threshold:</span>
        {THRESHOLDS.map((t) => (
          <button
            key={t}
            onClick={() => onThresholdChange(t)}
            aria-pressed={threshold === t}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${threshold === t ? "text-white border-transparent" : "text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-hover)]"}`}
            style={threshold === t ? { backgroundImage: "var(--gradient-primary)" } : undefined}
          >
            {t}%
          </button>
        ))}
        <button
          onClick={() => onThresholdChange(null)}
          aria-pressed={threshold === null}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${threshold === null ? "text-white border-transparent" : "text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-hover)]"}`}
          style={threshold === null ? { backgroundImage: "var(--gradient-primary)" } : undefined}
        >
          Include all
        </button>
      </div>
      <Table title="Study characteristics" entries={studyCharacteristics} />
      <Table title="Baseline characteristics" entries={baselineCharacteristics} />
    </div>
  );
}
