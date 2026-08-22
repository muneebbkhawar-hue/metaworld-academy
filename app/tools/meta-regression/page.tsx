"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DataInput from './components/DataInput';
import ModelSettings from './components/ModelSettings';
import ModeratorSelection from './components/ModeratorSelection';
import ResultsDashboard from './components/ResultsDashboard';
import { validateRows, validateModerators } from './lib/validation';
import type { MetaRegDataRow, SelectedModerator, OutcomeType, EffectMeasure } from './lib/types';
import type { MetaRegResult } from '../../types/statistics';
import { META_REGRESSION_API_URL } from '../../lib/apiConfig';
import { BACKEND_UNAVAILABLE_MESSAGE } from '../../lib/apiClient';

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

  const [results, setResults] = useState<MetaRegResult | null>(null);
  const [running, setRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const [backendStatus, setBackendStatus] = useState("checking");

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

  const runAnalysis = async () => {
    const dataErrors = validateRows(rows, outcomeType);
    const modErrors = moderators.length > 0 || rows.length === 0 ? validateModerators(rows, moderators) : ["Select at least one moderator - this tool is for meta-regression, not an ordinary pooled estimate."];
    const allErrors = [...dataErrors, ...modErrors];
    setValidationErrors(allErrors);
    if (allErrors.length > 0 || backendStatus === "unreachable") return;

    setRunning(true);
    setResults(null);
    setErrorMessage("");
    try {
      const payload = {
        studies: rows.map(r => ({ ...r, ...r.moderators })),
        outcome_type: outcomeType,
        effect_measure: effectMeasure,
        model,
        tau_method: tauMethod,
        ci_level: ciLevel,
        knha,
        moderators: moderators.map(m => ({ name: m.name, type: m.type, reference: m.reference })),
      };
      const res = await fetch(`${METAREG_API}/analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        signal: AbortSignal.timeout(120000),
      });
      const text = await res.text();
      let data: MetaRegResult | { status: "error"; message: string };
      try { data = JSON.parse(text); } catch { setErrorMessage("Fatal Error: Meta-regression R Plumber returned an invalid response. Check the R console for crashes."); setRunning(false); return; }
      if (data.status === "success") setResults(data);
      else setErrorMessage(`R Execution Error: ${data.message || "Unknown error occurred inside R."}`);
    } catch {
      setErrorMessage(BACKEND_UNAVAILABLE_MESSAGE);
    } finally {
      setRunning(false);
    }
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

          <ModeratorSelection rows={rows} selected={moderators} setSelected={setModerators} />

          <button
            onClick={runAnalysis}
            disabled={running || rows.length === 0 || backendStatus === "unreachable"}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl shadow-lg transition"
          >
            {running ? "RUNNING META-REGRESSION..." : "RUN META-REGRESSION"}
          </button>

          {results && <ResultsDashboard data={results} />}
        </div>
      </main>
    </div>
  );
}
