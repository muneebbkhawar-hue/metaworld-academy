"use client";

import { useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import type { SynthesisResult } from '../../types/statistics';
import { META_API_URL } from '../../lib/apiConfig';
import { BACKEND_UNAVAILABLE_MESSAGE } from '../../lib/apiClient';
import MultiOutcomeWorkflow, { type BatchProgressInfo } from '@/app/components/multiOutcome/MultiOutcomeWorkflow';
import { runOutcomeBatch } from '@/app/lib/multiOutcome/batch';
import { downloadPlotsAsZip } from '@/app/lib/multiOutcome/zipDownload';
import { sanitizeFilenamePart } from '@/app/lib/multiOutcome/filenames';
import type { DetectedOutcome, OutcomeRunState } from '@/app/lib/multiOutcome/types';

interface DichRow { study: string; event_e: number; n_e: number; event_c: number; n_c: number; }
interface ContRow { study: string; n_e: number; mean_e: number; sd_e: number; n_c: number; mean_c: number; sd_c: number; }
interface IvRow { study: string; te: number; se: number; }
type SynthRow = DichRow | ContRow | IvRow;
type SynthType = 'dich' | 'cont' | 'iv';

export default function SynthesisTool() {
  const [activeTab, setActiveTab] = useState("dichotomous");
  const [showModal, setShowModal] = useState(false);
  
  // Custom Group Labels
  const [expGroupLabel, setExpGroupLabel] = useState("Experimental");
  const [ctrlGroupLabel, setCtrlGroupLabel] = useState("Control");

  // Advanced Statistical Configuration State
  const [effectMeasure, setEffectMeasure] = useState("RR"); // RR, OR, RD, MD, SMD, HR
  const [model, setModel] = useState("Random-effects"); // Common-effect, Random-effects
  const [tauEstimator, setTauEstimator] = useState("REML"); // REML, DL, PM, ML
  const [inference, setInference] = useState("Conventional"); // Conventional, Knapp-Hartung
  const [ciLevel, setCiLevel] = useState("95"); // 90, 95, 99
  const [predInterval, setPredInterval] = useState("OFF"); // ON, OFF

  // Data States
  const [dichStudies, setDichStudies] = useState<DichRow[]>([{ study: "Study A 2021", event_e: 12, n_e: 100, event_c: 24, n_c: 100 }]);
  const [contStudies, setContStudies] = useState<ContRow[]>([{ study: "Smith 2020", n_e: 60, mean_e: 12.4, sd_e: 3.2, n_c: 60, mean_c: 14.1, sd_c: 3.4 }]);
  const [ivStudies, setIvStudies] = useState<IvRow[]>([{ study: "Author A 2022", te: 0.52, se: 0.15 }]);

  const [results, setResults] = useState<SynthesisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [pasteData, setPasteData] = useState("");

  // Multi-outcome batch state - kept separate per data type (dichotomous vs
  // continuous both feed off the SAME uploaded sheet's group labels above,
  // but each tab's batch results are independent). IV/Generic Inverse
  // Variance intentionally has no multi-outcome mode - the wide-format
  // extraction sheet is only specified for dichotomous/continuous data.
  const [multiRunStates, setMultiRunStates] = useState<OutcomeRunState<SynthesisResult>[]>([]);
  const [multiRunning, setMultiRunning] = useState(false);
  const [multiProgress, setMultiProgress] = useState<BatchProgressInfo | null>(null);

  const safeStr = (val: unknown) => (Array.isArray(val) ? val[0] : val) as string;

  const downloadPlot = (base64: string, filename: string) => {
    const link = document.createElement("a");
    link.href = base64;
    link.download = `${filename}-forest-plot.png`;
    link.click();
  };

  function importPasteToState<T extends SynthRow>(text: string, setter: (v: T[]) => void, type: SynthType) {
    if (!text.trim()) return;
    const rows = text.trim().split("\n");
    let parsed: SynthRow[] = [];
    if (type === 'dich') {
      parsed = rows.map(r => { const c = r.split("\t"); return { study: c[0] || "Study", event_e: Number(c[1]) || 0, n_e: Number(c[2]) || 0, event_c: Number(c[3]) || 0, n_c: Number(c[4]) || 0 }; }).filter(x => (x as DichRow).n_e > 0);
    } else if (type === 'cont') {
      parsed = rows.map(r => { const c = r.split("\t"); return { study: c[0] || "Trial", n_e: Number(c[1]) || 0, mean_e: Number(c[2]) || 0, sd_e: Number(c[3]) || 0, n_c: Number(c[4]) || 0, mean_c: Number(c[5]) || 0, sd_c: Number(c[6]) || 0 }; }).filter(x => (x as ContRow).n_e > 0);
    } else if (type === 'iv') {
      parsed = rows.map(r => { const c = r.split("\t"); return { study: c[0] || "Author", te: Number(c[1]) || 0, se: Number(c[2]) || 0 }; }).filter(x => (x as IvRow).se > 0);
    }
    if (parsed.length > 0) { setter(parsed as T[]); setPasteData(""); alert(`Successfully imported ${parsed.length} studies!`); }
  }

  // Accepts CSV or genuine XLSX (SheetJS binary parse) - same isXlsx/
  // XLSX.read()/sheet_to_json convention already proven in TSA and the NMA
  // data input, applied here so this tool actually supports the .xlsx/.xls
  // extensions its file picker advertises. Once we have `dataRows` as plain
  // string[][] (one array of cell values per row, header row excluded),
  // the per-outcome-type column mapping below is identical regardless of
  // source format.
  function handleFileUpload<T extends SynthRow>(e: ChangeEvent<HTMLInputElement>, type: SynthType, setter: (v: T[]) => void) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isXlsx = /\.xlsx?$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      let dataRows: string[][];
      if (isXlsx) {
        const wb = XLSX.read(event.target?.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
        dataRows = rows.slice(1).filter((r) => r.some((c) => c !== "")) as string[][];
      } else {
        const text = String(event.target?.result ?? "");
        dataRows = text.split("\n").slice(1).map(r => r.split(","));
      }
      let parsed: (SynthRow | null)[] = [];
      if (type === 'dich') {
        parsed = dataRows.map(c => { return c.length < 5 ? null : { study: String(c[0] ?? "").replace(/['"]+/g, '').trim(), event_e: Number(c[1]), n_e: Number(c[2]), event_c: Number(c[3]), n_c: Number(c[4]) }; }).filter(Boolean);
      } else if (type === 'cont') {
        parsed = dataRows.map(c => { return c.length < 7 ? null : { study: String(c[0] ?? "").replace(/['"]+/g, '').trim(), n_e: Number(c[1]), mean_e: Number(c[2]), sd_e: Number(c[3]), n_c: Number(c[4]), mean_c: Number(c[5]), sd_c: Number(c[6]) }; }).filter(Boolean);
      } else if (type === 'iv') {
        parsed = dataRows.map(c => { return c.length < 3 ? null : { study: String(c[0] ?? "").replace(/['"]+/g, '').trim(), te: Number(c[1]), se: Number(c[2]) }; }).filter(Boolean);
      }
      if (parsed.length) { setter(parsed as T[]); alert(`Loaded ${parsed.length} studies from ${isXlsx ? "XLSX" : "CSV"}!`); }
    };
    if (isXlsx) reader.readAsArrayBuffer(file); else reader.readAsText(file);
  }

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === "continuous" ? "/api/meta/continuous" : activeTab === "iv" ? "/api/meta/iv" : "/api/meta/dichotomous";
      const studiesPayload: SynthRow[] = activeTab === "continuous" ? contStudies : activeTab === "iv" ? ivStudies : dichStudies;
      const currentMeasure = effectMeasure;

      const configPayload = {
        effect_measure: currentMeasure,
        model,
        tau_estimator: tauEstimator,
        inference,
        ci_level: ciLevel,
        prediction_interval: predInterval
      };

      const res = await fetch(`${META_API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studies: studiesPayload,
          config: configPayload,
          exp_lab: expGroupLabel,
          ctrl_lab: ctrlGroupLabel
        })
      });

      const data = await res.json();
      setResults(data);
    } catch {
      alert(BACKEND_UNAVAILABLE_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  // Runs the SAME validated R endpoint (/api/meta/dichotomous or
  // /api/meta/continuous) once per selected outcome, sequentially -
  // reusing the exact statistical pipeline the single-outcome workflow
  // above already uses, just called once per outcome's own eligible-study
  // dataset. No new R code, no JS-side statistics.
  async function runMultiOutcomeBatch(outcomes: DetectedOutcome[]) {
    setMultiRunning(true);
    setMultiRunStates(outcomes.map((outcome) => ({ outcome, status: "pending" as const })));
    const endpoint = activeTab === "continuous" ? "/api/meta/continuous" : "/api/meta/dichotomous";
    const configPayload = { effect_measure: effectMeasure, model, tau_estimator: tauEstimator, inference, ci_level: ciLevel, prediction_interval: predInterval };

    await runOutcomeBatch<SynthesisResult>(
      outcomes,
      async (outcome) => {
        const res = await fetch(`${META_API_URL}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studies: outcome.eligibleStudies, config: configPayload, exp_lab: expGroupLabel, ctrl_lab: ctrlGroupLabel }),
        });
        const data = await res.json();
        if (data.status === "error") throw new Error(data.message || "The statistical backend reported an error for this outcome.");
        return data as SynthesisResult;
      },
      (index, state) => setMultiRunStates((prev) => prev.map((s, i) => (i === index ? state : s))),
      (progress) => setMultiProgress(progress)
    );
    setMultiRunning(false);
    setMultiProgress(null);
  }

  return (
    <div className="min-h-screen bg-[#0b0c10] text-slate-200 font-sans pb-24 relative">
      <nav className="border-b border-indigo-900/30 bg-[#0f111a]/90 backdrop-blur px-8 py-4 flex justify-between items-center sticky top-0 z-50">
        <div><Link href="/" className="text-xl font-bold text-white">MetaWorld <span className="text-indigo-400 font-normal">Research Academy</span></Link></div>
        <div className="flex gap-6 text-sm font-medium">
          <Link href="/" className="hover:text-indigo-400 text-slate-400">Home</Link>
          <Link href="/tools" className="text-indigo-400">Tools</Link>
        </div>
      </nav>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#151722] border border-indigo-500/40 rounded-3xl max-w-2xl w-full p-8 shadow-2xl relative">
            <button onClick={() => setShowModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-white bg-slate-800 w-8 h-8 rounded-full flex items-center justify-center font-bold">✕</button>
            <span className="text-xs text-indigo-400 font-mono font-bold tracking-widest uppercase mb-2 block">ABOUT THIS TOOL</span>
            <h2 className="text-2xl font-bold text-white mb-4">Advanced Forest Plots & Statistical Engine</h2>
            <p className="text-slate-300 text-sm leading-relaxed">Configure exact analytical parameters including models, Tau-squared estimators, Knapp-Hartung adjustments, confidence levels, and prediction intervals backed by direct R computation.</p>
            <div className="mt-8 pt-4 border-t border-slate-800 flex justify-end">
              <button onClick={() => setShowModal(false)} className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl">Got it</button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-8">
          <Link href="/tools" className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium">← Back to Tools Dashboard</Link>
          <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 rounded-lg text-sm font-medium">📖 READ ME</button>
        </div>

        <div className="space-y-8">
          {/* Data Type Tabs */}
          <div className="flex gap-3 border-b border-slate-800 pb-4 overflow-x-auto">
            <button onClick={() => { setActiveTab("dichotomous"); setEffectMeasure("RR"); }} className={`px-5 py-2.5 rounded-xl font-medium transition ${activeTab === "dichotomous" ? "bg-indigo-600 text-white" : "text-slate-400 bg-[#151722]"}`}>Dichotomous Data</button>
            <button onClick={() => { setActiveTab("continuous"); setEffectMeasure("MD"); }} className={`px-5 py-2.5 rounded-xl font-medium transition ${activeTab === "continuous" ? "bg-indigo-600 text-white" : "text-slate-400 bg-[#151722]"}`}>Continuous Data</button>
            <button onClick={() => { setActiveTab("iv"); setEffectMeasure("HR"); }} className={`px-5 py-2.5 rounded-xl font-medium transition ${activeTab === "iv" ? "bg-indigo-600 text-white" : "text-slate-400 bg-[#151722]"}`}>Generic Inverse Variance</button>
          </div>

          {/* ADVANCED STATISTICAL CONTROLS PANEL */}
          <div className="bg-[#151722] border border-indigo-900/30 rounded-2xl p-6 shadow-xl space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> Statistical Model & Controls
            </h3>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Effect Measure */}
              {activeTab === "dichotomous" && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Effect Measure:</label>
                  <select value={effectMeasure} onChange={e => setEffectMeasure(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                    <option value="RR">Risk Ratio (RR)</option>
                    <option value="OR">Odds Ratio (OR)</option>
                    <option value="RD">Risk Difference (RD)</option>
                  </select>
                </div>
              )}
              {activeTab === "continuous" && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Effect Measure:</label>
                  <select value={effectMeasure} onChange={e => setEffectMeasure(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                    <option value="MD">Mean Difference (MD)</option>
                    <option value="SMD">Standardized Mean Difference (SMD)</option>
                  </select>
                </div>
              )}
              {activeTab === "iv" && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Generic Effect Type:</label>
                  <select value={effectMeasure} onChange={e => setEffectMeasure(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                    <option value="HR">Log Hazard Ratio (log[HR])</option>
                    <option value="RR">Log Risk Ratio (log[RR])</option>
                    <option value="OR">Log Odds Ratio (log[OR])</option>
                    <option value="GEN">Generic Log Effect Estimate (TE)</option>
                  </select>
                </div>
              )}

              {/* Model */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Meta-Analysis Model:</label>
                <select value={model} onChange={e => setModel(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                  <option value="Random-effects">Random-effects</option>
                  <option value="Common-effect">Common-effect</option>
                </select>
              </div>

              {/* Tau2 Estimator (Only if Random-effects) */}
              {model === "Random-effects" && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tau² Estimator:</label>
                  <select value={tauEstimator} onChange={e => setTauEstimator(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                    <option value="REML">REML (Restricted Maximum Likelihood)</option>
                    <option value="DL">DerSimonian-Laird (DL)</option>
                    <option value="PM">Paule-Mandel (PM)</option>
                    <option value="ML">Maximum Likelihood (ML)</option>
                  </select>
                </div>
              )}

              {/* Inference Method */}
              {model === "Random-effects" && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Inference Method:</label>
                  <select value={inference} onChange={e => setInference(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                    <option value="Conventional">Conventional (Wald-type)</option>
                    <option value="Knapp-Hartung">Knapp-Hartung Adjustment</option>
                  </select>
                </div>
              )}

              {/* Confidence Level */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Confidence Level:</label>
                <select value={ciLevel} onChange={e => setCiLevel(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                  <option value="90">90% Confidence Interval</option>
                  <option value="95">95% Confidence Interval</option>
                  <option value="99">99% Confidence Interval</option>
                </select>
              </div>

              {/* Prediction Interval */}
              {model === "Random-effects" && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Prediction Interval:</label>
                  <select value={predInterval} onChange={e => setPredInterval(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                    <option value="OFF">OFF (Do not calculate)</option>
                    <option value="ON">ON (Calculate & Display)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Custom Group Labels for Dich/Cont */}
            {activeTab !== "iv" && (
              <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Experimental Group Label:</label>
                  <input type="text" value={expGroupLabel} onChange={e => setExpGroupLabel(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Control Group Label:</label>
                  <input type="text" value={ctrlGroupLabel} onChange={e => setCtrlGroupLabel(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white" />
                </div>
              </div>
            )}
          </div>

          {/* LIVE ANALYSIS PREVIEW PANEL */}
          <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-2xl p-6 text-sm">
            <h4 className="text-indigo-300 font-bold uppercase tracking-wider text-xs mb-3">Selected Analysis Preview</h4>
            <div className="grid md:grid-cols-3 gap-4 text-slate-300">
              <div><span className="text-slate-500 block text-xs">Effect Measure:</span> <strong className="text-white">{effectMeasure}</strong></div>
              <div><span className="text-slate-500 block text-xs">Model:</span> <strong className="text-white">{model}</strong></div>
              {model === "Random-effects" && <div><span className="text-slate-500 block text-xs">Tau² Estimator:</span> <strong className="text-white">{tauEstimator}</strong></div>}
              {model === "Random-effects" && <div><span className="text-slate-500 block text-xs">Inference:</span> <strong className="text-white">{inference}</strong></div>}
              <div><span className="text-slate-500 block text-xs">Confidence Level:</span> <strong className="text-white">{ciLevel}%</strong></div>
              {model === "Random-effects" && <div><span className="text-slate-500 block text-xs">Prediction Interval:</span> <strong className="text-white">{predInterval}</strong></div>}
            </div>
          </div>

          {/* Quick Import & File Upload Section */}
          <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6">
            <h3 className="text-white font-semibold text-sm mb-3">Quick Import & File Upload (CSV / Excel)</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <textarea rows={2} value={pasteData} onChange={e => setPasteData(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2 text-xs text-slate-200 mb-2" placeholder="Paste TSV rows here..." />
                <button onClick={() => importPasteToState(pasteData, (activeTab === 'dichotomous' ? setDichStudies : activeTab === 'continuous' ? setContStudies : setIvStudies) as (v: SynthRow[]) => void, activeTab === 'dichotomous' ? 'dich' : activeTab === 'continuous' ? 'cont' : 'iv')} className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg">Import Pasted Data</button>
              </div>
              <div>
                <input type="file" accept=".csv,.xlsx,.xls" onChange={e => handleFileUpload(e, activeTab === 'dichotomous' ? 'dich' : activeTab === 'continuous' ? 'cont' : 'iv', (activeTab === 'dichotomous' ? setDichStudies : activeTab === 'continuous' ? setContStudies : setIvStudies) as (v: SynthRow[]) => void)} className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-900/40 file:text-indigo-300 cursor-pointer" />
              </div>
            </div>
          </div>

          {/* Multi-Outcome Batch Workflow - additive, does not replace the single-outcome table workflow below */}
          {(activeTab === "dichotomous" || activeTab === "continuous") && (
            <MultiOutcomeWorkflow
              type={activeTab === "continuous" ? "continuous" : "dichotomous"}
              expLabel={expGroupLabel}
              ctrlLabel={ctrlGroupLabel}
              onExpLabelChange={setExpGroupLabel}
              onCtrlLabelChange={setCtrlGroupLabel}
              onRunSelected={runMultiOutcomeBatch}
              running={multiRunning}
              progress={multiProgress}
              runLabel="Run Forest Plots"
            />
          )}

          {multiRunStates.length > 0 && (
            <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">
                  Multi-Outcome Results ({multiRunStates.filter((s) => s.status === "success").length} of {multiRunStates.length} completed)
                </h3>
                {multiRunStates.some((s) => s.status === "success") && (
                  <button
                    type="button"
                    onClick={() =>
                      downloadPlotsAsZip(
                        multiRunStates.filter((s): s is OutcomeRunState<SynthesisResult> & { result: SynthesisResult } => s.status === "success" && !!s.result).map((s) => ({ outcomeName: s.outcome.name, base64Png: s.result.forest_plot_base64 })),
                        "forest_plots.zip",
                        "forest_plot"
                      )
                    }
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg"
                  >
                    Download all forest plots (ZIP)
                  </button>
                )}
              </div>
              {multiRunStates.map((state) => (
                <details key={state.outcome.name} className="bg-[#0b0c10] border border-slate-800 rounded-xl p-4" open={state.status === "failed"}>
                  <summary className="cursor-pointer text-sm font-medium text-white flex items-center gap-2">
                    {state.status === "success" && <span className="text-emerald-400">✓</span>}
                    {state.status === "failed" && <span className="text-red-400">✗</span>}
                    {state.status === "running" && <span className="text-indigo-400">⏳</span>}
                    {state.status === "pending" && <span className="text-slate-500">○</span>}
                    {state.outcome.name}
                    <span className="text-xs text-slate-500 font-normal">({state.outcome.eligibleStudies.length} studies)</span>
                  </summary>
                  {state.status === "failed" && <p className="text-xs text-red-400 mt-3">{state.error}</p>}
                  {state.status === "success" && state.result && (
                    <div className="mt-4 space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-[#151722] p-3 rounded-lg border border-slate-800"><span className="text-[10px] text-slate-500 block">Studies (k)</span><span className="text-lg font-bold text-white">{state.result.stats.k}</span></div>
                        <div className="bg-[#151722] p-3 rounded-lg border border-slate-800"><span className="text-[10px] text-slate-500 block">I²</span><span className="text-lg font-bold text-indigo-400">{state.result.stats.i2}%</span></div>
                        <div className="bg-[#151722] p-3 rounded-lg border border-slate-800"><span className="text-[10px] text-slate-500 block">Tau²</span><span className="text-lg font-bold text-white">{state.result.stats.tau2}</span></div>
                        <div className="bg-[#151722] p-3 rounded-lg border border-slate-800"><span className="text-[10px] text-slate-500 block">Q (p)</span><span className="text-lg font-bold text-emerald-400">{state.result.stats.q} ({state.result.stats.q_pval})</span></div>
                      </div>
                      <div className="bg-white p-4 rounded-xl flex flex-col items-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={state.result.forest_plot_base64} alt={`Forest plot: ${state.outcome.name}`} className="w-full max-w-3xl mb-3" />
                        <button
                          type="button"
                          onClick={() => {
                            const link = document.createElement("a");
                            link.href = state.result!.forest_plot_base64;
                            link.download = `forest_plot_${sanitizeFilenamePart(state.outcome.name)}.png`;
                            link.click();
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg"
                        >
                          Download PNG
                        </button>
                      </div>
                    </div>
                  )}
                </details>
              ))}
            </div>
          )}

          {/* Study Data Entry Tables */}
          {activeTab === "dichotomous" && (
            <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 shadow-xl space-y-6">
              <h3 className="text-white font-semibold text-sm">Dichotomous Data Input</h3>
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="text-slate-500 uppercase text-xs"><tr><th className="pb-3">Study ID</th><th className="pb-3">{expGroupLabel} Events</th><th className="pb-3">{expGroupLabel} Total</th><th className="pb-3">{ctrlGroupLabel} Events</th><th className="pb-3">{ctrlGroupLabel} Total</th></tr></thead>
                <tbody className="divide-y divide-slate-800/60">
                  {dichStudies.map((row, idx) => (
                    <tr key={idx}>
                      <td className="py-2 pr-2"><input type="text" value={row.study} onChange={e => { const next = [...dichStudies]; next[idx].study = e.target.value; setDichStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-3 py-1.5 w-full text-white" /></td>
                      <td className="py-2 px-2"><input type="number" value={row.event_e} onChange={e => { const next = [...dichStudies]; next[idx].event_e = Number(e.target.value); setDichStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-3 py-1.5 w-24 text-white" /></td>
                      <td className="py-2 px-2"><input type="number" value={row.n_e} onChange={e => { const next = [...dichStudies]; next[idx].n_e = Number(e.target.value); setDichStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-3 py-1.5 w-24 text-white" /></td>
                      <td className="py-2 px-2"><input type="number" value={row.event_c} onChange={e => { const next = [...dichStudies]; next[idx].event_c = Number(e.target.value); setDichStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-3 py-1.5 w-24 text-white" /></td>
                      <td className="py-2 px-2"><input type="number" value={row.n_c} onChange={e => { const next = [...dichStudies]; next[idx].n_c = Number(e.target.value); setDichStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-3 py-1.5 w-24 text-white" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={runAnalysis} disabled={loading} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg transition">{loading ? "Computing R Analysis..." : "Run Analysis & Generate Forest Plot"}</button>
            </div>
          )}

          {activeTab === "continuous" && (
            <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 shadow-xl space-y-6">
              <h3 className="text-white font-semibold text-sm">Continuous Data Input</h3>
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="text-slate-500 uppercase text-xs"><tr><th className="pb-3">Study ID</th><th className="pb-3">{expGroupLabel} (N)</th><th className="pb-3">{expGroupLabel} Mean</th><th className="pb-3">{expGroupLabel} SD</th><th className="pb-3">{ctrlGroupLabel} (N)</th><th className="pb-3">{ctrlGroupLabel} Mean</th><th className="pb-3">{ctrlGroupLabel} SD</th></tr></thead>
                <tbody className="divide-y divide-slate-800/60">
                  {contStudies.map((row, idx) => (
                    <tr key={idx}>
                      <td className="py-2 pr-2"><input type="text" value={row.study} onChange={e => { const next = [...contStudies]; next[idx].study = e.target.value; setContStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1.5 w-full text-white text-xs" /></td>
                      <td className="py-2 px-1"><input type="number" value={row.n_e} onChange={e => { const next = [...contStudies]; next[idx].n_e = Number(e.target.value); setContStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1.5 w-20 text-white text-xs" /></td>
                      <td className="py-2 px-1"><input type="number" step="0.1" value={row.mean_e} onChange={e => { const next = [...contStudies]; next[idx].mean_e = Number(e.target.value); setContStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1.5 w-20 text-white text-xs" /></td>
                      <td className="py-2 px-1"><input type="number" step="0.1" value={row.sd_e} onChange={e => { const next = [...contStudies]; next[idx].sd_e = Number(e.target.value); setContStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1.5 w-20 text-white text-xs" /></td>
                      <td className="py-2 px-1"><input type="number" value={row.n_c} onChange={e => { const next = [...contStudies]; next[idx].n_c = Number(e.target.value); setContStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1.5 w-20 text-white text-xs" /></td>
                      <td className="py-2 px-1"><input type="number" step="0.1" value={row.mean_c} onChange={e => { const next = [...contStudies]; next[idx].mean_c = Number(e.target.value); setContStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1.5 w-20 text-white text-xs" /></td>
                      <td className="py-2 px-1"><input type="number" step="0.1" value={row.sd_c} onChange={e => { const next = [...contStudies]; next[idx].sd_c = Number(e.target.value); setContStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1.5 w-20 text-white text-xs" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={runAnalysis} disabled={loading} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg transition">{loading ? "Computing R Analysis..." : "Run Analysis & Generate Forest Plot"}</button>
            </div>
          )}

          {activeTab === "iv" && (
            <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 shadow-xl space-y-6">
              <h3 className="text-white font-semibold text-sm">Generic Inverse Variance Data Input ({effectMeasure})</h3>
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="text-slate-500 uppercase text-xs"><tr><th className="pb-3">Study ID</th><th className="pb-3">Log Effect Size (TE)</th><th className="pb-3">Standard Error (SE)</th></tr></thead>
                <tbody className="divide-y divide-slate-800/60">
                  {ivStudies.map((row, idx) => (
                    <tr key={idx}>
                      <td className="py-2 pr-2"><input type="text" value={row.study} onChange={e => { const next = [...ivStudies]; next[idx].study = e.target.value; setIvStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-3 py-1.5 w-full text-white" /></td>
                      <td className="py-2 px-2"><input type="number" step="0.01" value={row.te} onChange={e => { const next = [...ivStudies]; next[idx].te = Number(e.target.value); setIvStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-3 py-1.5 w-36 text-white" /></td>
                      <td className="py-2 px-2"><input type="number" step="0.01" value={row.se} onChange={e => { const next = [...ivStudies]; next[idx].se = Number(e.target.value); setIvStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-3 py-1.5 w-36 text-white" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={runAnalysis} disabled={loading} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg transition">{loading ? "Computing R Analysis..." : "Run Analysis & Generate Forest Plot"}</button>
            </div>
          )}

          {/* RESULTS OUTPUT SECTION */}
          {results && (
            <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl space-y-6">
              <h3 className="text-xl font-bold text-white">Statistical Synthesis Output</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#0b0c10] p-4 rounded-xl border border-slate-800"><span className="text-xs text-slate-500 block mb-1">Studies (k)</span><span className="text-2xl font-bold text-white">{results.stats.k}</span></div>
                <div className="bg-[#0b0c10] p-4 rounded-xl border border-slate-800"><span className="text-xs text-slate-500 block mb-1">Heterogeneity (I²)</span><span className="text-2xl font-bold text-indigo-400">{results.stats.i2}%</span></div>
                <div className="bg-[#0b0c10] p-4 rounded-xl border border-slate-800"><span className="text-xs text-slate-500 block mb-1">Between-Study Variance (Tau²)</span><span className="text-2xl font-bold text-white">{results.stats.tau2}</span></div>
                <div className="bg-[#0b0c10] p-4 rounded-xl border border-slate-800"><span className="text-xs text-slate-500 block mb-1">Cochran&apos;s Q (p-val)</span><span className="text-2xl font-bold text-emerald-400">{results.stats.q} ({results.stats.q_pval})</span></div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-inner flex flex-col items-center">
                <img src={safeStr(results.forest_plot_base64)} className="w-full max-w-4xl mb-4" />
                <button onClick={() => downloadPlot(results.forest_plot_base64, "upgraded-forest")} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow">Download High Res PNG</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}