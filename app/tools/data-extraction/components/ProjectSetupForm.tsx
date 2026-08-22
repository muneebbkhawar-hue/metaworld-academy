"use client";

import type { ProjectConfig, OutcomeTypeHint } from "../lib/types";

const OUTCOME_TYPES: OutcomeTypeHint[] = ["Let AI detect", "Dichotomous", "Continuous", "Generic Inverse Variance", "Mixed"];

const inputClass = "w-full bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--border-hover)] transition-colors";
const labelClass = "block text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5";

export default function ProjectSetupForm({ config, onChange, locked }: { config: ProjectConfig; onChange: (c: ProjectConfig) => void; locked: boolean }) {
  const set = <K extends keyof ProjectConfig>(key: K, value: ProjectConfig[K]) => onChange({ ...config, [key]: value });

  return (
    <div className="grid sm:grid-cols-2 gap-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
      <div>
        <label className={labelClass} htmlFor="de-project-name">Project name</label>
        <input id="de-project-name" className={inputClass} placeholder="e.g. Drug A for Acute Stroke" value={config.projectName} disabled={locked} onChange={(e) => set("projectName", e.target.value)} />
      </div>
      <div>
        <label className={labelClass} htmlFor="de-review-id">Review / project ID (optional)</label>
        <input id="de-review-id" className={inputClass} placeholder="e.g. PROSPERO CRD..." value={config.reviewId} disabled={locked} onChange={(e) => set("reviewId", e.target.value)} />
      </div>
      <div>
        <label className={labelClass} htmlFor="de-exp-group">Experimental group</label>
        <input id="de-exp-group" className={inputClass} placeholder="e.g. Drug A" value={config.experimentalGroup} disabled={locked} onChange={(e) => set("experimentalGroup", e.target.value)} />
      </div>
      <div>
        <label className={labelClass} htmlFor="de-ctrl-group">Control group</label>
        <input id="de-ctrl-group" className={inputClass} placeholder="e.g. Placebo" value={config.controlGroup} disabled={locked} onChange={(e) => set("controlGroup", e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass} htmlFor="de-outcome-type">Outcome type (optional)</label>
        <select id="de-outcome-type" className={inputClass} value={config.outcomeType} disabled={locked} onChange={(e) => set("outcomeType", e.target.value as OutcomeTypeHint)}>
          {OUTCOME_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
    </div>
  );
}
