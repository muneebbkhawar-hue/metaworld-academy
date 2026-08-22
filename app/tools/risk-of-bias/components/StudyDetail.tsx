"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import type { StudyAssessment, DomainAssessment, RoB2Judgment, RobinsIJudgment, Quadas2Judgment } from "@/app/lib/rob/types";
import { rob2Overall } from "@/app/lib/rob/rob2";
import { robinsIOverall } from "@/app/lib/rob/robinsI";
import { quadas2Overall } from "@/app/lib/rob/quadas2";

const JUDGMENT_OPTIONS: Record<StudyAssessment["framework"], string[]> = {
  RoB2: ["Low risk of bias", "Some concerns", "High risk of bias"],
  "ROBINS-I": ["Low", "Moderate", "Serious", "Critical", "No information"],
  "QUADAS-2": ["Low", "High", "Unclear"],
};

function EvidenceRow({ q }: { q: DomainAssessment<string>["questions"][number] }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-void)] p-3 text-xs space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[var(--text-secondary)]">{q.question_id}</span>
        <span className="font-medium text-[var(--text-primary)]">{q.answer}</span>
      </div>
      <p className="text-[var(--text-tertiary)]">{q.reasoning}</p>
      {q.supporting_text ? (
        <blockquote className="border-l-2 border-[var(--purple-primary)] pl-2 italic text-[var(--text-secondary)]">
          &ldquo;{q.supporting_text}&rdquo;
          {(q.page || q.section) && (
            <span className="not-italic text-[var(--text-tertiary)]">
              {" "}— {q.section ?? "Page"} {q.page ? `p.${q.page}` : ""}
            </span>
          )}
        </blockquote>
      ) : (
        <p className="text-[var(--text-tertiary)]">No supporting evidence found ({q.evidence_status}).</p>
      )}
      <div className="flex items-center gap-3 text-[var(--text-tertiary)]">
        <span>Confidence: {Math.round(q.confidence * 100)}%</span>
        {q.needs_review && <span className="text-amber-300">⚠ {q.needs_review_reason}</span>}
      </div>
    </div>
  );
}

function DomainBlock({
  domain, options, onOverride,
}: {
  domain: DomainAssessment<string>;
  options: string[];
  onOverride: (domainKey: string, judgment: string, rationale: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rationale, setRationale] = useState(domain.reviewer_rationale ?? "");

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-[var(--bg-surface-2)] text-left"
        aria-expanded={open}
      >
        <span className="font-medium text-[var(--text-primary)] text-sm">{domain.domain_key} — {domain.domain_label}</span>
        {open ? <ChevronUp size={16} className="text-[var(--text-tertiary)]" /> : <ChevronDown size={16} className="text-[var(--text-tertiary)]" />}
      </button>
      {open && (
        <div className="p-4 space-y-4">
          {/* Category A - AI-derived, read-only (matches the NMA CertaintyAssessment A/B convention) */}
          <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3 text-sm">
            <p className="text-[var(--text-tertiary)] text-xs uppercase tracking-wide mb-1">AI-proposed judgment</p>
            <p className="text-[var(--text-primary)] font-semibold">{domain.ai_judgment}</p>
          </div>
          {/* Category B - researcher-owned final judgment */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
            <p className="text-[var(--text-tertiary)] text-xs uppercase tracking-wide">Human final judgment</p>
            <select
              value={domain.human_judgment}
              onChange={(e) => onOverride(domain.domain_key, e.target.value, rationale)}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            {domain.human_override_applied && (
              <>
                <p className="text-xs text-amber-300">Human override applied.</p>
                <input
                  type="text"
                  placeholder="Reviewer rationale (recommended)"
                  value={rationale}
                  onChange={(e) => { setRationale(e.target.value); onOverride(domain.domain_key, domain.human_judgment, e.target.value); }}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)]"
                />
              </>
            )}
          </div>
          <div className="space-y-2">
            {domain.questions.map((q) => <EvidenceRow key={q.question_id} q={q} />)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudyDetail({
  assessment, onChange, onClose,
}: {
  assessment: StudyAssessment;
  onChange: (updated: StudyAssessment) => void;
  onClose: () => void;
}) {
  const options = JUDGMENT_OPTIONS[assessment.framework];

  function applyOverride(target: DomainAssessment<string>[], domainKey: string, judgment: string, rationale: string): DomainAssessment<string>[] {
    return target.map((d) =>
      d.domain_key === domainKey
        ? { ...d, human_judgment: judgment, human_override_applied: judgment !== d.ai_judgment || d.human_override_applied, reviewer_rationale: rationale || null }
        : d
    );
  }

  function overrideDomain(domainKey: string, judgment: string, rationale: string) {
    const updatedDomains = applyOverride(assessment.domains, domainKey, judgment, rationale);
    const humanJudgments = updatedDomains.map((d) => d.human_judgment);
    if (assessment.framework === "RoB2") {
      onChange({ ...assessment, domains: updatedDomains as DomainAssessment<RoB2Judgment>[], human_overall: rob2Overall(humanJudgments as RoB2Judgment[]) });
    } else if (assessment.framework === "ROBINS-I") {
      onChange({ ...assessment, domains: updatedDomains as DomainAssessment<RobinsIJudgment>[], human_overall: robinsIOverall(humanJudgments as RobinsIJudgment[]) });
    } else {
      onChange({ ...assessment, domains: updatedDomains as DomainAssessment<Quadas2Judgment>[], human_overall: quadas2Overall(humanJudgments as Quadas2Judgment[]) });
    }
  }

  // QUADAS-2's applicability list has no separate "overall" concept (§26),
  // so overriding it never touches human_overall.
  function overrideApplicability(domainKey: string, judgment: string, rationale: string) {
    if (assessment.framework !== "QUADAS-2") return;
    const updated = applyOverride(assessment.applicability, domainKey, judgment, rationale) as DomainAssessment<Quadas2Judgment>[];
    onChange({ ...assessment, applicability: updated });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center overflow-y-auto p-4 md:p-8" role="dialog" aria-modal="true" aria-label={`Study detail for ${assessment.study_id}`}>
      <div className="w-full max-w-3xl bg-[var(--bg-void)] border border-[var(--border-hover)] rounded-2xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] sticky top-0 bg-[var(--bg-void)] rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">{assessment.study_id}</h2>
            <p className="text-xs text-[var(--text-tertiary)]">{assessment.filename} · {assessment.framework}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg hover:bg-[var(--bg-surface-2)] text-[var(--text-tertiary)]">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <section className="space-y-2 text-sm">
            <h3 className="text-[var(--text-primary)] font-semibold">Study design classification</h3>
            <p className="text-[var(--text-secondary)]">
              {assessment.classification.study_design} (confidence {Math.round(assessment.classification.confidence * 100)}%)
            </p>
            {assessment.classification.evidence && (
              <blockquote className="border-l-2 border-[var(--purple-primary)] pl-2 italic text-[var(--text-tertiary)] text-xs">
                &ldquo;{assessment.classification.evidence}&rdquo;{assessment.classification.page ? ` — p.${assessment.classification.page}` : ""}
              </blockquote>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-[var(--text-primary)] font-semibold text-sm">Domains</h3>
            {assessment.domains.map((d) => (
              <DomainBlock key={d.domain_key} domain={d} options={options} onOverride={overrideDomain} />
            ))}
          </section>

          {assessment.framework === "QUADAS-2" && (
            <section className="space-y-2">
              <h3 className="text-[var(--text-primary)] font-semibold text-sm">Applicability concerns (separate from risk of bias)</h3>
              {assessment.applicability.map((d) => (
                <DomainBlock key={d.domain_key} domain={d} options={["Low", "High", "Unclear"]} onOverride={overrideApplicability} />
              ))}
            </section>
          )}

          <section className="rounded-xl border border-[var(--border-subtle)] p-4 flex items-center justify-between">
            <span className="text-sm text-[var(--text-secondary)]">Overall judgment</span>
            <span className="font-bold text-[var(--text-primary)]">{assessment.human_overall}</span>
          </section>

          {assessment.human_review_required && (
            <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
              <p className="font-medium mb-1">Human review recommended</p>
              <ul className="list-disc list-inside space-y-0.5 text-amber-300/90">
                {assessment.human_review_reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
