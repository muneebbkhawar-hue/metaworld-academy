"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DataInput from './components/DataInput';
import ModelSettings from './components/ModelSettings';
import ModeratorSelection from './components/ModeratorSelection';
import ResultsDashboard from './components/ResultsDashboard';
import { validateRows, validateModerators, groupByOutcome, findDuplicateStudyOutcomePairs, computeEligibilityPreview } from './lib/validation';
import type { MetaRegDataRow, SelectedModerator, OutcomeType, EffectMeasure } from './lib/types';
import { SINGLE_OUTCOME_KEY } from './lib/types';
import type { MetaRegResult } from '../../types/statistics';
import { META_REGRESSION_API_URL } from '../../lib/apiConfig';
import { BACKEND_UNAVAILABLE_MESSAGE } from '../../lib/apiClient';
import LazyOutcomeCard from '@/app/components/multiOutcome/LazyOutcomeCard';
import { runSequentialBatch, type BatchProgress } from '@/app/lib/multiOutcome/batch';
import { sanitizeFilenamePart } from '@/app/lib/multiOutcome/filenames';

interface MetaRegRunState {
  outcomeKey: string;
  outcomeLabel: string;
  rowsTotal: number;
  status: "pending" | "running" | "success" | "failed";
  result?: MetaRegResult;
  error?: string;
}

// Pairwise Meta-Regression. STANDALONE tool, separate from the existing NMA
// Meta-Regression (network-meta-analysis/components/extensions/
// NMAMetaRegression.tsx, which fits netmetareg() on a NETWORK via
// nma-api.R). This tool fits an ordinary pairwise meta-regression via
// metafor::rma.uni() on its own dedicated R backend (metareg-api.R, port
// 8003) - entirely separate process, entirely separate statistical model.
// Neither tool touches the other.
const METAREG_API = `${META_REGRESSION_API_URL}/api/metareg`;
const HEALTH_POLL_MS = 15000;

export default function MetaRegressionTool() {
  const [outcomeType, setOutcomeType] = useState<OutcomeType>("dichotomous");
  const [effectMeasure, setEffectMeasure] = useState<EffectMeasure>("OR");
  const [model, setModel] = useState("Random-effects");
  const [tauMethod, setTauMethod] = useState("REML");
  const [ciLevel, setCiLevel] = useState(95);
  const [knha, setKnha] = useState(true);

  const [rows, setRows] = useState<MetaRegDataRow[]>([]);
  const [moderators, setModerators] = useState<SelectedModerator[]>([]);

  const [errorMessage, setErrorMessage] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const [backendStatus, setBackendStatus] = useState("checking");

  // --- Multi-outcome grouping/selection/batch state ---
  // Grouping ALWAYS produces at least one OutcomeGroup (under
  // SINGLE_OUTCOME_KEY when the sheet has no Outcome column), so the rest
  // of this page runs through one path regardless of whether the dataset
  // has one implicit outcome or several explicit ones.
  const outcomeGroups = useMemo(() => groupByOutcome(rows), [rows]);
  const isMultiOutcome = outcomeGroups.length > 1 || (outcomeGroups.length === 1 && outcomeGroups[0].key !== SINGLE_OUTCOME_KEY);
  const [selectedOutcomeKeys, setSelectedOutcomeKeys] = useState<Set<string>>(new Set());
  const duplicatePairs = useMemo(() => findDuplicateStudyOutcomePairs(rows), [rows]);

  const [multiRunStates, setMultiRunStates] = useState<MetaRegRunState[]>([]);
  const [multiRunning, setMultiRunning] = useState(false);
  const [multiProgress, setMultiProgress] = useState<BatchProgress | null>(null);

  // Auto-select every detected outcome whenever the dataset changes (upload
  // or re-parse) - the researcher can still deselect any they don't want,
  // matching the "select one / select multiple / select all" requirement
  // while defaulting to the common case of analyzing everything uploaded.
  // Adjusted directly during render (React's documented pattern for
  // "resetting state when a prop changes") rather than in a useEffect, so
  // this doesn't trigger an extra render pass.
  const [lastGroupSignature, setLastGroupSignature] = useState("");
  const groupSignature = outcomeGroups.map(g => g.key).join("|");
  if (groupSignature !== lastGroupSignature) {
    setLastGroupSignature(groupSignature);
    setSelectedOutcomeKeys(new Set(outcomeGroups.map(g => g.key)));
    setMultiRunStates([]);
  }

  function toggleOutcome(key: string) {
    setSelectedOutcomeKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${META_REGRESSION_API_URL}/health`, { signal: AbortSignal.timeout(5000) });
        if (!cancelled) setBackendStatus(res.ok ? "ok" : "unreachable");
      } catch {
        if (!cancelled) setBackendStatus("unreachable");
      }
    };
    check();
    const interval = setInterval(check, HEALTH_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Runs meta-regression independently for every SELECTED outcome, calling
  // the exact same /api/metareg/analyze endpoint once per outcome (no R
  // backend change needed for multi-outcome support - grouping/batching is
  // pure frontend data partitioning, not a statistical calculation). One
  // outcome's validation failure or backend error never stops the others -
  // matches every other multi-outcome tool in this app.
  const runAnalysis = async () => {
    const groups = outcomeGroups.filter(g => selectedOutcomeKeys.has(g.key));
    if (groups.length === 0) { setValidationErrors(["Select at least one outcome to run."]); return; }
    if (moderators.length === 0) { setValidationErrors(["Select at least one moderator - this tool is for meta-regression, not an ordinary pooled estimate."]); return; }
    if (backendStatus === "unreachable") return;
    setValidationErrors([]);
    setErrorMessage("");
    setMultiRunning(true);
    setMultiRunStates(groups.map(g => ({ outcomeKey: g.key, outcomeLabel: g.label, rowsTotal: g.rows.length, status: "pending" as const })));

    const configPayload = {
      outcome_type: outcomeType,
      effect_measure: effectMeasure,
      model,
      tau_method: tauMethod,
      ci_level: ciLevel,
      knha,
      moderators: moderators.map(m => ({ name: m.name, type: m.type, reference: m.reference })),
    };

    const finalStates = await runSequentialBatch<typeof groups[number], MetaRegRunState>(
      groups,
      (g) => g.label,
      async (g) => {
        const dataErrors = validateRows(g.rows, outcomeType);
        const modErrors = validateModerators(g.rows, moderators);
        if (dataErrors.length > 0 || modErrors.length > 0) {
          return { outcomeKey: g.key, outcomeLabel: g.label, rowsTotal: g.rows.length, status: "failed", error: [...dataErrors, ...modErrors].join(" ") };
        }
        try {
          const res = await fetch(`${METAREG_API}/analyze`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studies: g.rows.map(r => ({ ...r, ...r.moderators })), ...configPayload }),
            signal: AbortSignal.timeout(120000),
          });
          const text = await res.text();
          let data: MetaRegResult | { status: "error"; message: string };
          try { data = JSON.parse(text); } catch {
            return { outcomeKey: g.key, outcomeLabel: g.label, rowsTotal: g.rows.length, status: "failed", error: "Meta-regression R Plumber returned an invalid response for this outcome." };
          }
          if (data.status === "success") return { outcomeKey: g.key, outcomeLabel: g.label, rowsTotal: g.rows.length, status: "success", result: data };
          return { outcomeKey: g.key, outcomeLabel: g.label, rowsTotal: g.rows.length, status: "failed", error: data.message || "Unknown error occurred inside R." };
        } catch {
          return { outcomeKey: g.key, outcomeLabel: g.label, rowsTotal: g.rows.length, status: "failed", error: BACKEND_UNAVAILABLE_MESSAGE };
        }
      },
      (progress) => {
        setMultiProgress(progress);
        setMultiRunStates(prev => prev.map((s, i) => (i === progress.index ? { ...s, status: "running" } : s)));
      }
    );
    setMultiRunStates(finalStates);
    setMultiRunning(false);
    setMultiProgress(null);
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] text-slate-200 font-sans pb-24">
      <nav className="border-b border-indigo-900/30 bg-[#0f111a]/90 backdrop-blur px-8 py-4 flex justify-between items-center sticky top-0 z-50">
        <div><Link href="/" className="text-xl font-bold text-white">MetaWorld <span className="text-indigo-400 font-normal">Research Academy</span></Link></div>
        <div className="flex gap-6 text-sm font-medium">
          <Link href="/" className="hover:text-indigo-400 text-slate-400">Home</Link>
          <Link href="/tools" className="text-indigo-400">Tools</Link>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-8">
          <Link href="/tools" className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium">← Back to Tools Dashboard</Link>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Pairwise Meta-Regression</h1>
            <p className="text-slate-400 text-sm max-w-3xl">
              Investigate whether study-level moderators explain variation in treatment effects, via the R <code>metafor</code> package
              (<code>rma.uni()</code>). This is a separate tool from the Network Meta-Analysis module&apos;s NMA Meta-Regression - it fits an
              ordinary pairwise meta-regression, not a network model.
            </p>
          </div>

          <div className="bg-sky-950/30 border border-sky-600/40 rounded-xl p-4 text-xs text-sky-200">
            ℹ️ Meta-regression uses study-level characteristics. Associations observed at the study level should not automatically be interpreted as individual-level effects.
          </div>

          {backendStatus === "unreachable" && (
            <div className="bg-red-950/80 border border-red-500/80 text-red-200 p-4 rounded-xl text-sm shadow-lg flex items-center gap-2">
              <span className="animate-pulse">●</span> Statistical analysis backend unavailable. Attempting to reconnect…
            </div>
          )}
          {errorMessage && <div className="bg-red-950/80 border border-red-500/80 text-red-200 p-5 rounded-xl text-sm font-mono shadow-lg">{errorMessage}</div>}
          {validationErrors.length > 0 && (
            <div className="bg-amber-950/40 border border-amber-600/50 rounded-xl p-5 text-sm text-amber-200 space-y-1">
              <strong>Please fix the following before running the analysis:</strong>
              <ul className="list-disc list-inside">{validationErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}

          <ModelSettings
            outcomeType={outcomeType} setOutcomeType={setOutcomeType}
            effectMeasure={effectMeasure} setEffectMeasure={setEffectMeasure}
            model={model} setModel={setModel}
            tauMethod={tauMethod} setTauMethod={setTauMethod}
            ciLevel={ciLevel} setCiLevel={setCiLevel}
            knha={knha} setKnha={setKnha}
          />

          <DataInput outcomeType={outcomeType} rows={rows} setRows={setRows} />

          {isMultiOutcome && duplicatePairs.length > 0 && (
            <div className="bg-amber-950/40 border border-amber-600/50 rounded-xl p-4 text-xs text-amber-300">
              <strong>⚠ Duplicate study/outcome rows detected</strong> - each pair below appears more than once in the uploaded
              data. Only distinct study rows are valid per outcome; check for accidental double-entry before running the analysis.
              <ul className="list-disc list-inside mt-1">{duplicatePairs.map((d, i) => <li key={i}>{d}</li>)}</ul>
            </div>
          )}

          {isMultiOutcome && (
            <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 space-y-3">
              <h3 className="text-white font-semibold text-sm">Detected Outcomes ({outcomeGroups.length})</h3>
              <p className="text-slate-500 text-xs">Each selected outcome is fit as its own, completely independent meta-regression model - results are never combined across outcomes.</p>
              <div className="flex items-center gap-2 mb-1">
                <button type="button" onClick={() => setSelectedOutcomeKeys(new Set(outcomeGroups.map(g => g.key)))} className="text-xs text-indigo-400 hover:text-indigo-300">Select all</button>
                <span className="text-slate-700">·</span>
                <button type="button" onClick={() => setSelectedOutcomeKeys(new Set())} className="text-xs text-indigo-400 hover:text-indigo-300">Deselect all</button>
              </div>
              <div className="space-y-2">
                {outcomeGroups.map(g => (
                  <label key={g.key} className="flex items-center gap-3 bg-[#0b0c10] border border-slate-800 rounded-lg p-3 cursor-pointer">
                    <input type="checkbox" checked={selectedOutcomeKeys.has(g.key)} onChange={() => toggleOutcome(g.key)} />
                    <span className="text-white font-medium text-sm">{g.label}</span>
                    <span className="text-xs text-slate-500">({g.rows.length} studies)</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <ModeratorSelection rows={rows} selected={moderators} setSelected={setModerators} />

          {rows.length > 0 && moderators.length > 0 && (
            <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 space-y-3">
              <h3 className="text-white font-semibold text-sm">Data Eligibility Preview</h3>
              <p className="text-slate-500 text-xs">
                Estimated per selected outcome, based on the currently selected moderator(s) - the R backend performs the
                authoritative exclusion when the analysis actually runs; this is a preview so you know what to expect first.
              </p>
              <div className="grid md:grid-cols-2 gap-3">
                {outcomeGroups.filter(g => selectedOutcomeKeys.has(g.key)).map(g => {
                  const preview = computeEligibilityPreview(g.rows, outcomeType, moderators);
                  return (
                    <div key={g.key} className="bg-[#0b0c10] border border-slate-800 rounded-lg p-3 text-xs text-slate-300">
                      <p className="text-white font-semibold mb-1">{g.label}</p>
                      <p>Total studies: {preview.total} · Included: <span className="text-emerald-400">{preview.includedCount}</span> · Excluded: <span className={preview.excluded.length > 0 ? "text-amber-400" : ""}>{preview.excluded.length}</span></p>
                      {preview.excluded.length > 0 && (
                        <ul className="list-disc list-inside mt-1 text-slate-500">
                          {preview.excluded.map((ex, i) => <li key={i}>{ex.study} — {ex.reason}</li>)}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={runAnalysis}
            disabled={multiRunning || rows.length === 0 || selectedOutcomeKeys.size === 0 || backendStatus === "unreachable"}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl shadow-lg transition"
          >
            {multiRunning ? "RUNNING META-REGRESSION..." : `RUN META-REGRESSION${selectedOutcomeKeys.size > 1 ? ` (${selectedOutcomeKeys.size} outcomes)` : ""}`}
          </button>

          {multiRunning && multiProgress && (
            <p className="text-xs text-indigo-300">Running outcome {multiProgress.index + 1} of {multiProgress.total}: {multiProgress.label}</p>
          )}

          {multiRunStates.length > 0 && (
            <div className="space-y-4">
              {isMultiOutcome && (
                <h3 className="text-white font-semibold text-sm">
                  Meta-Regression Results ({multiRunStates.filter(s => s.status === "success").length} of {multiRunStates.length} completed)
                </h3>
              )}
              {multiRunStates.map((s) => {
                const modLabel = moderators.map(m => sanitizeFilenamePart(m.name)).join("_") || "moderator";
                const prefix = `meta_regression_${sanitizeFilenamePart(s.outcomeLabel)}_${modLabel}`;
                const body = (
                  <>
                    {s.status === "failed" && <p className="text-xs text-red-400 p-2">{s.error}</p>}
                    {s.status === "success" && s.result && <ResultsDashboard data={s.result} filenamePrefix={prefix} />}
                  </>
                );
                if (!isMultiOutcome) return <div key={s.outcomeKey}>{body}</div>;
                return (
                  <LazyOutcomeCard
                    key={s.outcomeKey}
                    defaultOpen={s.status === "failed"}
                    summary={
                      <>
                        {s.status === "success" && <span className="text-emerald-400">✓</span>}
                        {s.status === "failed" && <span className="text-red-400">✗</span>}
                        {s.status === "running" && <span className="text-indigo-400">⏳</span>}
                        {s.status === "pending" && <span className="text-slate-500">○</span>}
                        {s.outcomeLabel}
                        <span className="text-xs text-slate-500 font-normal">({s.rowsTotal} rows)</span>
                      </>
                    }
                  >
                    {body}
                  </LazyOutcomeCard>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
