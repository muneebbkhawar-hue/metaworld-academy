"use client";

import { AlertTriangle } from "lucide-react";
import type { StudyExtraction, SameStudyConflict, CrossStudyWarning } from "@/app/lib/extraction/types";

const SEVERITY_STYLE: Record<string, string> = {
  high: "border-rose-500/30 bg-rose-500/5 text-rose-200",
  medium: "border-amber-500/30 bg-amber-500/5 text-amber-200",
  low: "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]",
};

export default function WarningsPanel({ studies, conflicts, crossStudyWarnings }: { studies: StudyExtraction[]; conflicts: SameStudyConflict[]; crossStudyWarnings: CrossStudyWarning[] }) {
  const studyWarnings = studies.flatMap((s) => [...s.warnings.map((w) => ({ studyId: s.study_id, text: w })), ...s.quality_flags.map((q) => ({ studyId: s.study_id, text: q }))]);

  if (studyWarnings.length === 0 && conflicts.length === 0 && crossStudyWarnings.length === 0) {
    return <p className="text-sm text-[var(--text-tertiary)] py-4">No warnings or conflicts were flagged.</p>;
  }

  return (
    <div className="space-y-2">
      {crossStudyWarnings.map((w, i) => (
        <div key={`cw-${i}`} className={`rounded-xl border p-3 text-sm flex items-start gap-2 ${SEVERITY_STYLE[w.severity]}`}>
          <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
          <div><strong>{w.study_id ?? "Cross-study"}:</strong> {w.warning} <p className="text-xs opacity-80 mt-0.5">{w.suggested_action}</p></div>
        </div>
      ))}
      {conflicts.map((c, i) => (
        <div key={`c-${i}`} className={`rounded-xl border p-3 text-sm flex items-start gap-2 ${SEVERITY_STYLE[c.severity]}`}>
          <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
          <div>
            <strong>{c.study_id}</strong> — conflicting values for &quot;{c.variable}&quot;: {c.values.map((v) => v.value).join(" vs. ")}
            <p className="text-xs opacity-80 mt-0.5">{c.suggested_action}</p>
          </div>
        </div>
      ))}
      {studyWarnings.map((w, i) => (
        <div key={`sw-${i}`} className={`rounded-xl border p-3 text-sm flex items-start gap-2 ${SEVERITY_STYLE.medium}`}>
          <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
          <span><strong>{w.studyId}:</strong> {w.text}</span>
        </div>
      ))}
    </div>
  );
}
