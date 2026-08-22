"use client";

import type { StudyAssessment, RoB2Judgment, RobinsIJudgment, Quadas2Judgment } from "@/app/lib/rob/types";

function badgeClasses(j: string): string {
  // Accessible, non-emoji badges: color + text label together (not color
  // alone), matching this codebase's restrained purple-scale palette rather
  // than literal red/yellow/green traffic-light colors in the DATA table
  // (the actual traffic-light PLOT, rendered separately via robvis, is
  // where the conventional red/yellow/green appears - see PlotPanel).
  const low = /^low/i.test(j);
  const high = /^(high|serious|critical)/i.test(j);
  const info = /no information|unclear/i.test(j);
  if (low) return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
  if (high) return "bg-rose-500/10 text-rose-300 border-rose-500/30";
  if (info) return "bg-[var(--bg-surface-2)] text-[var(--text-tertiary)] border-[var(--border-subtle)]";
  return "bg-amber-500/10 text-amber-300 border-amber-500/30"; // Some concerns / Moderate
}

function Badge({ children }: { children: string }) {
  return <span className={`inline-block px-2 py-1 rounded-md border text-xs font-medium whitespace-nowrap ${badgeClasses(children)}`}>{children}</span>;
}

export default function ResultsTable({ assessments, onSelect }: { assessments: StudyAssessment[]; onSelect: (studyId: string) => void }) {
  if (assessments.length === 0) return null;
  const framework = assessments[0].framework;

  const columns =
    framework === "RoB2"
      ? [{ k: "D1", l: "D1" }, { k: "D2", l: "D2" }, { k: "D3", l: "D3" }, { k: "D4", l: "D4" }, { k: "D5", l: "D5" }]
      : framework === "ROBINS-I"
      ? [{ k: "D1", l: "D1" }, { k: "D2", l: "D2" }, { k: "D3", l: "D3" }, { k: "D4", l: "D4" }, { k: "D5", l: "D5" }, { k: "D6", l: "D6" }, { k: "D7", l: "D7" }]
      : [{ k: "D1", l: "D1" }, { k: "D2", l: "D2" }, { k: "D3", l: "D3" }, { k: "D4", l: "D4" }];

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <table className="w-full text-sm min-w-[720px]">
          <caption className="sr-only">Risk of bias domain judgments per study</caption>
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-left text-[var(--text-tertiary)] text-xs uppercase tracking-wide">
              <th scope="col" className="px-4 py-3">Study ID</th>
              {columns.map((c) => <th scope="col" key={c.k} className="px-3 py-3">{c.l}</th>)}
              <th scope="col" className="px-4 py-3">Overall</th>
              <th scope="col" className="px-4 py-3">Review status</th>
            </tr>
          </thead>
          <tbody>
            {assessments.map((a) => (
              <tr
                key={a.study_id}
                className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-surface-2)] cursor-pointer transition-colors"
                onClick={() => onSelect(a.study_id)}
              >
                <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{a.study_id}</td>
                {columns.map((c) => {
                  const d = a.domains.find((x) => x.domain_key === c.k);
                  const j = (d?.human_judgment ?? "—") as RoB2Judgment | RobinsIJudgment | Quadas2Judgment;
                  return <td key={c.k} className="px-3 py-3"><Badge>{String(j)}</Badge></td>;
                })}
                <td className="px-4 py-3"><Badge>{a.human_overall}</Badge></td>
                <td className="px-4 py-3 text-xs text-[var(--text-tertiary)]">
                  {a.human_review_required ? <span className="text-amber-300">Needs review</span> : "Reviewed"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {framework === "QUADAS-2" && (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <table className="w-full text-sm min-w-[600px]">
            <caption className="sr-only">Applicability concerns per study (separate from risk of bias)</caption>
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left text-[var(--text-tertiary)] text-xs uppercase tracking-wide">
                <th scope="col" className="px-4 py-3">Study ID</th>
                <th scope="col" className="px-3 py-3">Patient selection</th>
                <th scope="col" className="px-3 py-3">Index test</th>
                <th scope="col" className="px-3 py-3">Reference standard</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => {
                if (a.framework !== "QUADAS-2") return null;
                return (
                  <tr key={a.study_id} className="border-b border-[var(--border-subtle)] last:border-0">
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{a.study_id}</td>
                    {["D1", "D2", "D3"].map((k) => {
                      const d = a.applicability.find((x) => x.domain_key === k);
                      return <td key={k} className="px-3 py-3">{d ? <Badge>{d.human_judgment}</Badge> : "—"}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
