"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import type { StudyExtraction, Evidence } from "@/app/lib/extraction/types";
import type { EvidenceModalData } from "./EvidenceModal";

interface Row {
  studyId: string;
  filename: string;
  arm: string | null;
  variable: string;
  value: string;
  standardizedValue?: string | null;
  transformation?: string | null;
  evidence: Evidence;
}

function armName(study: StudyExtraction, armId: string): string {
  return study.arms.find((a) => a.arm_id === armId)?.arm_name ?? armId;
}

function studyCharacteristicRows(studies: StudyExtraction[]): Row[] {
  return studies.flatMap((s) => s.study_characteristics.map((c) => ({ studyId: s.study_id, filename: s.filename, arm: null, variable: c.variable, value: c.unit ? `${c.value} ${c.unit}` : c.value, evidence: c.evidence })));
}

function baselineRows(studies: StudyExtraction[]): Row[] {
  return studies.flatMap((s) => s.baseline_characteristics.map((b) => ({
    studyId: s.study_id, filename: s.filename, arm: b.arm_id === null ? "Overall" : armName(s, b.arm_id),
    variable: b.variable_canonical_name, value: b.reported_unit ? `${b.reported_value} ${b.reported_unit}` : b.reported_value,
    standardizedValue: b.standardized_value ? `${b.standardized_value}${b.standardized_unit ? ` ${b.standardized_unit}` : ""}` : null,
    transformation: b.transformation, evidence: b.evidence,
  })));
}

function dichotomousRows(studies: StudyExtraction[]): Row[] {
  return studies.flatMap((s) => s.outcomes.dichotomous.map((o) => ({
    studyId: s.study_id, filename: s.filename, arm: armName(s, o.arm_id),
    variable: `${o.outcome_name}${o.timepoint ? ` (${o.timepoint})` : ""}`, value: `${o.events ?? "NR"} / ${o.total ?? "NR"}`, evidence: o.evidence,
  })));
}

function continuousRows(studies: StudyExtraction[]): Row[] {
  return studies.flatMap((s) => s.outcomes.continuous.map((o) => ({
    studyId: s.study_id, filename: s.filename, arm: armName(s, o.arm_id),
    variable: `${o.outcome_name}${o.timepoint ? ` (${o.timepoint})` : ""}`, value: `${o.mean ?? "NR"} ± ${o.sd ?? "NR"} (n=${o.total ?? "NR"})`, evidence: o.evidence,
  })));
}

function genericIVRows(studies: StudyExtraction[]): Row[] {
  return studies.flatMap((s) => s.outcomes.generic_iv.map((o) => {
    const measure = o.effect_measure === "Other" ? o.effect_measure_other_label ?? "Other" : o.effect_measure;
    return {
      studyId: s.study_id, filename: s.filename, arm: null,
      variable: `${o.outcome_name}${o.timepoint ? ` (${o.timepoint})` : ""}`,
      value: `${measure} = ${o.estimate ?? "NR"} [${o.lower_ci ?? "NR"}, ${o.upper_ci ?? "NR"}]${o.derived_log_effect !== null ? ` (log=${o.derived_log_effect.toFixed(3)}, SE=${o.derived_se?.toFixed(3)})` : ""}`,
      evidence: o.evidence,
    };
  }));
}

const BUILDERS = {
  "study-characteristics": studyCharacteristicRows,
  baseline: baselineRows,
  dichotomous: dichotomousRows,
  continuous: continuousRows,
  "generic-iv": genericIVRows,
} as const;

export type TableKind = keyof typeof BUILDERS;

export default function ExtractionTables({ kind, studies, onViewEvidence }: { kind: TableKind; studies: StudyExtraction[]; onViewEvidence: (data: EvidenceModalData) => void }) {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => BUILDERS[kind](studies), [kind, studies]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.studyId.toLowerCase().includes(q) || r.variable.toLowerCase().includes(q) || r.value.toLowerCase().includes(q));
  }, [rows, query]);

  if (rows.length === 0) return <p className="text-sm text-[var(--text-tertiary)] py-6 text-center">No data extracted for this section.</p>;

  return (
    <div>
      <div className="relative max-w-xs mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" aria-hidden="true" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" aria-label="Search table" className="w-full bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg pl-8 pr-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-hover)]" />
      </div>
      <div className="overflow-auto rounded-xl border border-[var(--border-subtle)] max-h-[520px]">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-[var(--bg-surface-2)] sticky top-0 z-10">
            <tr className="text-left text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
              <th className="px-3 py-2 sticky left-0 bg-[var(--bg-surface-2)] z-20">Study</th>
              {kind !== "study-characteristics" && kind !== "generic-iv" && <th className="px-3 py-2">Arm</th>}
              <th className="px-3 py-2">Variable</th>
              <th className="px-3 py-2">Value</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Confidence</th>
              <th className="px-3 py-2">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-surface-2)]/50">
                <td className="px-3 py-2 font-medium text-[var(--text-primary)] sticky left-0 bg-[var(--bg-surface)] whitespace-nowrap">{r.studyId}</td>
                {kind !== "study-characteristics" && kind !== "generic-iv" && <td className="px-3 py-2 text-[var(--text-secondary)] whitespace-nowrap">{r.arm ?? "—"}</td>}
                <td className="px-3 py-2 text-[var(--text-secondary)]">{r.variable}</td>
                <td className="px-3 py-2 text-[var(--text-primary)]">{r.value}</td>
                <td className="px-3 py-2 text-[var(--text-tertiary)] whitespace-nowrap">{r.evidence.status.replace("_", " ")}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${r.evidence.confidence === "High" ? "bg-emerald-500/15 text-emerald-300" : r.evidence.confidence === "Medium" ? "bg-amber-500/15 text-amber-300" : "bg-rose-500/15 text-rose-300"}`}>{r.evidence.confidence}</span>
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => onViewEvidence({ studyId: r.studyId, filename: r.filename, variable: r.variable, originalValue: r.value, standardizedValue: r.standardizedValue, transformation: r.transformation, evidence: r.evidence })}
                    className="inline-flex items-center gap-1 text-xs text-[var(--purple-bright)] hover:underline"
                  >
                    {r.evidence.quote_verified === false && <AlertTriangle size={11} className="text-rose-300" />}
                    View evidence
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
