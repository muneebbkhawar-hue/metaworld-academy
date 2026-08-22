"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import NMADataInput from './components/NMADataInput';
import NMASettings from './components/NMASettings';
import NetworkValidation from './components/NetworkValidation';
import NMAResults from './components/NMAResults';
import NMADiagnostics from './components/NMADiagnostics';
import ComparisonAdjustedFunnelPlot from './components/publication-bias/ComparisonAdjustedFunnelPlot';
import NMASensitivity from './components/extensions/NMASensitivity';
import NMASubgroup from './components/extensions/NMASubgroup';
import NMAMetaRegression from './components/extensions/NMAMetaRegression';
import TransitivityAssessment from './components/evidence/TransitivityAssessment';
import CertaintyAssessment from './components/evidence/CertaintyAssessment';
import FinalEvidenceReport from './components/evidence/FinalEvidenceReport';
import type { TransitivityRow, CertaintyRow, ConcernLevel } from './components/evidence/evidenceTypes';
import type {
  NMAArm, NMAValidation, NMAAnalyzeResult, NMADiagnosticsResult,
  NMAFunnelResult, NMASensitivityResult, NMASubgroupResult, NMAMetaRegressionResult,
} from '../../types/statistics';
import { NMA_API_URL } from '../../lib/apiConfig';
import { BACKEND_UNAVAILABLE_MESSAGE } from '../../lib/apiClient';

interface SensitivityPayload {
  method: string;
  alt_model?: string;
  alt_tau_method?: string;
  excluded_studies?: string[];
  criterion?: { type: string; min_year?: number; max_year?: number; exclude_value?: string };
}

// Network Meta-Analysis module (CORE + DIAGNOSTICS + PUBLICATION BIAS).
// Talks to a DEDICATED R Plumber process (nma-api.R) on its own port
// (8002) - entirely separate from Forest/Funnel/Sensitivity (api.R, port
// 8000) and TSA (tsa-api.R, port 8001), so this module cannot interfere
// with any of those, and they cannot interfere with it. Future NMA
// extensions (sensitivity/subgroup/meta-regression, CINeMA) should live as
// additional components in ./components/extensions and additional routes
// in nma-api.R, without touching this page's core/diagnostics/publication-
// bias flow. The base URL is centralized in app/lib/apiConfig.ts (env-var
// overridable) rather than hardcoded here.
const NMA_API = `${NMA_API_URL}/api/nma`;
const HEALTH_POLL_MS = 15000;

export default function NetworkMetaAnalysisTool() {
  const [outcomeType, setOutcomeType] = useState("dichotomous");
  const [effectMeasure, setEffectMeasure] = useState("OR");
  const [model, setModel] = useState("Random-effects");
  const [tauMethod, setTauMethod] = useState("REML");
  const [referenceTreatment, setReferenceTreatment] = useState("");

  const [arms, setArms] = useState<NMAArm[]>([]);
  const [validation, setValidation] = useState<NMAValidation | null>(null);
  const [validating, setValidating] = useState(false);

  const [results, setResults] = useState<NMAAnalyzeResult | null>(null);
  const [running, setRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [diagnostics, setDiagnostics] = useState<NMADiagnosticsResult | null>(null);
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagError, setDiagError] = useState("");

  const [funnelData, setFunnelData] = useState<NMAFunnelResult | null>(null);
  const [funnelRunning, setFunnelRunning] = useState(false);
  const [funnelError, setFunnelError] = useState("");

  const [sensData, setSensData] = useState<NMASensitivityResult | null>(null);
  const [sensRunning, setSensRunning] = useState(false);
  const [sensError, setSensError] = useState("");

  const [subgroupData, setSubgroupData] = useState<NMASubgroupResult | null>(null);
  const [subgroupRunning, setSubgroupRunning] = useState(false);
  const [subgroupError, setSubgroupError] = useState("");

  const [metaregData, setMetaregData] = useState<NMAMetaRegressionResult | null>(null);
  const [metaregRunning, setMetaregRunning] = useState(false);
  const [metaregError, setMetaregError] = useState("");

  // Evidence & Certainty section state. Lifted up here (rather than kept
  // local to each sub-component) so the Final NMA Evidence Report can
  // assemble everything without re-fetching or re-deriving it, and so the
  // assessments survive switching between the Transitivity/Certainty/Report
  // sub-tabs. `sessionId` is a lightweight, client-only identifier for the
  // audit trail (not tied to any account/personal data) generated once per
  // page load.
  const [sessionId] = useState<string>(() => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`));
  const [evidenceTab, setEvidenceTab] = useState<"transitivity" | "certainty" | "report">("transitivity");
  const [transitivityRows, setTransitivityRows] = useState<TransitivityRow[]>([]);
  const [transitivityOverall, setTransitivityOverall] = useState<ConcernLevel>("Not assessed");
  const [transitivityNotes, setTransitivityNotes] = useState("");
  const [certaintyRows, setCertaintyRows] = useState<CertaintyRow[]>([]);

  // Backend health: polled independently of any user action so a dead/slow
  // R process shows a clear status instead of the page looking broken.
  const [backendStatus, setBackendStatus] = useState("checking"); // "ok" | "unreachable" | "checking"

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${NMA_API}/health`, { signal: AbortSignal.timeout(5000) });
        if (!cancelled) setBackendStatus(res.ok ? "ok" : "unreachable");
      } catch {
        if (!cancelled) setBackendStatus("unreachable");
      }
    };
    check();
    const interval = setInterval(check, HEALTH_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const treatments = useMemo(() => {
    const set = new Set(arms.map(a => a.treatment).filter(Boolean));
    return Array.from(set).sort();
  }, [arms]);

  // react-hooks/set-state-in-effect: intentional exception. This effect
  // resets a derived selection (referenceTreatment) whenever the treatment
  // list itself changes (new data uploaded) - it does not run on every
  // render, only when `treatments` changes, so it does not cascade. This is
  // the standard React "adjust state when a prop/derived value changes"
  // pattern, not a case the rule's cascading-render concern applies to.
  useEffect(() => {
    if (treatments.length > 0 && !treatments.includes(referenceTreatment)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReferenceTreatment(treatments[0]);
    }
  }, [treatments]);

  // Re-validate the network whenever the data or outcome type changes.
  // react-hooks/set-state-in-effect: intentional exception, same rationale
  // as above - these calls clear a previous validation result before the
  // debounced fetch below computes a new one; they don't cascade further
  // renders beyond the one state reset that legitimately belongs here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (arms.length === 0) { setValidation(null); return; }
    const cleanArms = arms.filter(a => a.study && a.treatment);
    if (cleanArms.length === 0) { setValidation(null); return; }
    setValidating(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${NMA_API}/validate`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studies: cleanArms, outcome_type: outcomeType })
        });
        const data = await res.json();
        setValidation(data);
      } catch {
        setValidation({ status: "error", message: BACKEND_UNAVAILABLE_MESSAGE });
      } finally {
        setValidating(false);
      }
    }, 500); // debounce so every keystroke in the editable table doesn't trigger a request
    return () => clearTimeout(t);
  }, [arms, outcomeType]);

  // Guard explicitly on treatments.length >= 3 client-side, in addition to
  // whatever the backend's /validate endpoint reports. A 2-treatment
  // network is trivially "connected" (a single direct comparison), so
  // validation.connected alone does not catch this case - and fitting an
  // NMA model with fewer than 3 distinct treatment nodes crashes the R
  // backend with a raw, user-hostile error ("dim(X) must have a positive
  // length"). This check stops that request from ever being sent.
  const canRun = validation && validation.status === "success" && validation.connected && treatments.length >= 3 && !running && backendStatus !== "unreachable";

  const currentPayload = () => ({
    studies: arms.filter(a => a.study && a.treatment),
    config: {
      outcome_type: outcomeType, effect_measure: effectMeasure, model,
      tau_method: tauMethod, reference_treatment: referenceTreatment,
      small_values: "undesirable",
    }
  });

  const runNMA = async () => {
    if (treatments.length < 3) {
      setErrorMessage("This network contains only " + treatments.length + " distinct treatment" + (treatments.length === 1 ? "" : "s") + ". Network meta-analysis requires a connected network with at least three distinct treatment nodes for this analysis.");
      return;
    }
    if (!canRun) return;
    setRunning(true);
    setResults(null);
    setErrorMessage("");
    setDiagnostics(null); // diagnostics/funnel belong to the run that produced them; a new Core run invalidates them
    setDiagError("");
    setFunnelData(null);
    setFunnelError("");
    setSensData(null); setSensError("");
    setSubgroupData(null); setSubgroupError("");
    setMetaregData(null); setMetaregError("");
    // Certainty rows embed NMA estimates/CIs computed under the previous
    // model/settings - a new Core run invalidates them (Part 5: the
    // Evidence/Certainty layer must reflect the actual model used, never
    // silently keep stale numbers from a different run). Transitivity rows
    // are pure descriptive statistics of the uploaded study-level data, not
    // model-dependent, so they intentionally persist across re-runs.
    setCertaintyRows([]);
    try {
      const res = await fetch(`${NMA_API}/analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(currentPayload()),
        signal: AbortSignal.timeout(120000)
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { setErrorMessage("Fatal Error: NMA R Plumber returned an invalid response. Check the R console for crashes."); setRunning(false); return; }
      if (data.status === "success") setResults(data);
      else setErrorMessage(`R Execution Error: ${data.message || "Unknown error occurred inside R."}`);
    } catch {
      setErrorMessage(BACKEND_UNAVAILABLE_MESSAGE);
    } finally {
      setRunning(false);
    }
  };

  const runDiagnostics = async () => {
    if (!results) return;
    setDiagRunning(true);
    setDiagError("");
    try {
      const res = await fetch(`${NMA_API}/diagnostics`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(currentPayload()),
        signal: AbortSignal.timeout(120000)
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { setDiagError("Fatal Error: NMA R Plumber returned an invalid response for diagnostics."); setDiagRunning(false); return; }
      if (data.status === "success") setDiagnostics(data);
      else setDiagError(`R Execution Error: ${data.message || "Unknown error occurred inside R."}`);
    } catch {
      setDiagError(BACKEND_UNAVAILABLE_MESSAGE);
    } finally {
      setDiagRunning(false);
    }
  };

  const runFunnel = async () => {
    if (!results) return;
    setFunnelRunning(true);
    setFunnelError("");
    try {
      const res = await fetch(`${NMA_API}/funnel`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(currentPayload()),
        signal: AbortSignal.timeout(120000)
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { setFunnelError("Fatal Error: NMA R Plumber returned an invalid response for the funnel plot."); setFunnelRunning(false); return; }
      if (data.status === "success") setFunnelData(data);
      else setFunnelError(`R Execution Error: ${data.message || "Unknown error occurred inside R."}`);
    } catch {
      setFunnelError(BACKEND_UNAVAILABLE_MESSAGE);
    } finally {
      setFunnelRunning(false);
    }
  };

  const runSensitivity = async (sensitivityConfig: SensitivityPayload) => {
    if (!results) return;
    setSensRunning(true); setSensError("");
    try {
      const res = await fetch(`${NMA_API}/sensitivity`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...currentPayload(), sensitivity: sensitivityConfig }),
        signal: AbortSignal.timeout(120000)
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { setSensError("Fatal Error: NMA R Plumber returned an invalid response."); setSensRunning(false); return; }
      if (data.status === "success") setSensData(data);
      else setSensError(`R Execution Error: ${data.message || "Unknown error occurred inside R."}`);
    } catch {
      setSensError(BACKEND_UNAVAILABLE_MESSAGE);
    } finally {
      setSensRunning(false);
    }
  };

  const runSubgroup = async (selectedGroups: string[]) => {
    if (!results) return;
    setSubgroupRunning(true); setSubgroupError("");
    try {
      const res = await fetch(`${NMA_API}/subgroup`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...currentPayload(), selected_groups: selectedGroups }),
        signal: AbortSignal.timeout(120000)
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { setSubgroupError("Fatal Error: NMA R Plumber returned an invalid response."); setSubgroupRunning(false); return; }
      if (data.status === "success") setSubgroupData(data);
      else setSubgroupError(`R Execution Error: ${data.message || "Unknown error occurred inside R."}`);
    } catch {
      setSubgroupError(BACKEND_UNAVAILABLE_MESSAGE);
    } finally {
      setSubgroupRunning(false);
    }
  };

  const runMetaRegression = async () => {
    if (!results) return;
    setMetaregRunning(true); setMetaregError("");
    try {
      const res = await fetch(`${NMA_API}/metaregression`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(currentPayload()),
        signal: AbortSignal.timeout(120000)
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { setMetaregError("Fatal Error: NMA R Plumber returned an invalid response."); setMetaregRunning(false); return; }
      if (data.status === "success") setMetaregData(data);
      else setMetaregError(`R Execution Error: ${data.message || "Unknown error occurred inside R."}`);
    } catch {
      setMetaregError(BACKEND_UNAVAILABLE_MESSAGE);
    } finally {
      setMetaregRunning(false);
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
            <h1 className="text-3xl font-bold text-white mb-2">Network Meta-Analysis</h1>
            <p className="text-slate-400 text-sm">Frequentist network meta-analysis via the graph-theoretical / weighted-least-squares approach, computed by the R <code>netmeta</code> package.</p>
          </div>

          {backendStatus === "unreachable" && (
            <div className="bg-red-950/80 border border-red-500/80 text-red-200 p-4 rounded-xl text-sm shadow-lg flex items-center gap-2">
              <span className="animate-pulse">●</span> Statistical analysis backend unavailable. Attempting to reconnect…
            </div>
          )}

          {errorMessage && <div className="bg-red-950/80 border border-red-500/80 text-red-200 p-5 rounded-xl text-sm font-mono shadow-lg">{errorMessage}</div>}

          <NMADataInput outcomeType={outcomeType} arms={arms} setArms={setArms} />

          {arms.length > 0 && (
            <div className={`rounded-xl p-4 text-sm border ${treatments.length < 3 ? "bg-amber-950/40 border-amber-600/50 text-amber-200" : "bg-indigo-950/30 border-indigo-500/30 text-slate-300"}`}>
              <strong>Distinct treatments detected: {treatments.length}</strong> ({treatments.join(", ") || "none"})
              {treatments.length < 3 && (
                <p className="mt-1">
                  {treatments.length === 0 && "No valid treatment identifiers were detected yet. Check the Treatment column above."}
                  {treatments.length === 1 && "Network meta-analysis cannot be performed with only one distinct treatment."}
                  {treatments.length === 2 && (
                    <>
                      Network meta-analysis requires at least three distinct treatments. This dataset contains only two -
                      use the <Link href="/tools/synthesis" className="underline text-amber-100 hover:text-white">Pairwise Meta-analysis</Link> tool instead for a direct two-treatment comparison.
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          <NMASettings
            outcomeType={outcomeType} setOutcomeType={setOutcomeType}
            effectMeasure={effectMeasure} setEffectMeasure={setEffectMeasure}
            model={model} setModel={setModel}
            tauMethod={tauMethod} setTauMethod={setTauMethod}
            referenceTreatment={referenceTreatment} setReferenceTreatment={setReferenceTreatment}
            treatments={treatments}
          />

          {(validation || validating) && <NetworkValidation validation={validation} validating={validating} />}

          <button
            onClick={runNMA}
            disabled={!canRun}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl shadow-lg transition"
          >
            {running ? "RUNNING NETWORK META-ANALYSIS..." : "RUN NETWORK META-ANALYSIS"}
          </button>

          <NMAResults results={results} />

          {results && (
            <NMADiagnostics diagnostics={diagnostics} loading={diagRunning} error={diagError} onRun={runDiagnostics} />
          )}

          {results && (
            <ComparisonAdjustedFunnelPlot data={funnelData} loading={funnelRunning} error={funnelError} onRun={runFunnel} />
          )}

          {results && (
            <>
              <h2 className="text-2xl font-bold text-white pt-4">Analysis Extensions</h2>
              <NMASensitivity studies={arms} tauMethod={tauMethod} isCommon={model === "Common-effect"} onRun={runSensitivity} data={sensData} loading={sensRunning} error={sensError} />
              <NMASubgroup studies={arms} onRun={runSubgroup} data={subgroupData} loading={subgroupRunning} error={subgroupError} />
              <NMAMetaRegression studies={arms} onRun={runMetaRegression} data={metaregData} loading={metaregRunning} error={metaregError} />
            </>
          )}

          {results && (
            <div>
              <h2 className="text-2xl font-bold text-white pt-4 mb-1 print:hidden">Evidence &amp; Certainty</h2>
              <p className="text-slate-500 text-sm mb-4 max-w-3xl print:hidden">
                Transitivity assessment, a CINeMA-compatible certainty/confidence workflow, and a final assembled
                evidence report - all built from this network&apos;s existing results, without re-fitting the model.
              </p>
              <div className="flex gap-2 border-b border-slate-800 pb-3 mb-4 overflow-x-auto print:hidden">
                {([
                  ["transitivity", "Transitivity Assessment"],
                  ["certainty", "Certainty / Confidence"],
                  ["report", "Final NMA Evidence Report"],
                ] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setEvidenceTab(key)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${evidenceTab === key ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200 bg-[#151722]"}`}>{label}</button>
                ))}
              </div>

              {evidenceTab === "transitivity" && (
                <TransitivityAssessment
                  arms={arms}
                  rows={transitivityRows} setRows={setTransitivityRows}
                  overallConcern={transitivityOverall} setOverallConcern={setTransitivityOverall}
                  overallNotes={transitivityNotes} setOverallNotes={setTransitivityNotes}
                />
              )}
              {evidenceTab === "certainty" && (
                <CertaintyAssessment results={results} diagnostics={diagnostics} rows={certaintyRows} setRows={setCertaintyRows} />
              )}
              {evidenceTab === "report" && (
                <FinalEvidenceReport
                  sessionId={sessionId} arms={arms}
                  outcomeType={outcomeType} effectMeasure={effectMeasure} model={model} tauMethod={tauMethod} referenceTreatment={referenceTreatment}
                  results={results} diagnostics={diagnostics} funnelData={funnelData} sensData={sensData} subgroupData={subgroupData} metaregData={metaregData}
                  transitivityRows={transitivityRows} transitivityOverall={transitivityOverall} transitivityNotes={transitivityNotes}
                  certaintyRows={certaintyRows}
                />
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
