"use client";

import { useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import type { SensitivityLOOResult } from '../../types/statistics';
import { META_API_URL } from '../../lib/apiConfig';
import { BACKEND_UNAVAILABLE_MESSAGE } from '../../lib/apiClient';
import MultiOutcomeWorkflow, { type BatchProgressInfo } from '@/app/components/multiOutcome/MultiOutcomeWorkflow';
import { runOutcomeBatch } from '@/app/lib/multiOutcome/batch';
import { downloadPlotsAsZip } from '@/app/lib/multiOutcome/zipDownload';
import { sanitizeFilenamePart } from '@/app/lib/multiOutcome/filenames';
import type { DetectedOutcome, OutcomeRunState } from '@/app/lib/multiOutcome/types';

// LOO removes one study at a time and re-pools the rest - a 2-study
// outcome would leave only 1 study after removal, which can't be pooled.
// Matches this tool's own existing single-outcome minimum (runAnalysis
// below already requires >= 3 studies).
const LOO_MIN_STUDIES = 3;

interface DichRow { study: string; event_e: number; n_e: number; event_c: number; n_c: number; }
interface ContRow { study: string; mean_e: number; sd_e: number; n_e: number; mean_c: number; sd_c: number; n_c: number; }
interface IvRow { study: string; te: number; se: number; }
type SensRow = DichRow | ContRow | IvRow;

export default function SensitivityTool() {
  const [activeTab, setActiveTab] = useState("dichotomous"); 
  const [errorMessage, setErrorMessage] = useState("");

  const [expGroupLabel, setExpGroupLabel] = useState("DCB");
  const [ctrlGroupLabel, setCtrlGroupLabel] = useState("DES");

  const [effectMeasure, setEffectMeasure] = useState("RR");
  const [model, setModel] = useState("Random-effects");
  const [tauEstimator, setTauEstimator] = useState("REML");
  const [inference, setInference] = useState("Conventional");
  const [ciLevel, setCiLevel] = useState("95");

  const [dichStudies, setDichStudies] = useState<DichRow[]>([
    { study: "Bausback 2019", event_e: 40, n_e: 75, event_c: 39, n_c: 75 },
    { study: "Haraguchi 2026", event_e: 120, n_e: 400, event_c: 35, n_c: 107 },
    { study: "Hayakawa 2022", event_e: 33, n_e: 43, event_c: 27, n_c: 37 }
  ]);
  const [contStudies, setContStudies] = useState<ContRow[]>([
    { study: "Trial 1", mean_e: 10.2, sd_e: 2.1, n_e: 50, mean_c: 12.5, sd_c: 2.4, n_c: 50 },
    { study: "Trial 2", mean_e: 8.5, sd_e: 1.8, n_e: 60, mean_c: 9.1, sd_c: 1.9, n_c: 60 },
    { study: "Trial 3", mean_e: 9.0, sd_e: 2.0, n_e: 55, mean_c: 10.0, sd_c: 2.2, n_c: 55 }
  ]);
  const [ivStudies, setIvStudies] = useState<IvRow[]>([
    { study: "Author A", te: 0.45, se: 0.12 },
    { study: "Author B", te: 0.65, se: 0.18 },
    { study: "Author C", te: 0.50, se: 0.15 }
  ]);

  const [pasteData, setPasteData] = useState("");
  const [results, setResults] = useState<SensitivityLOOResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [multiRunStates, setMultiRunStates] = useState<OutcomeRunState<SensitivityLOOResult>[]>([]);
  const [multiRunning, setMultiRunning] = useState(false);
  const [multiProgress, setMultiProgress] = useState<BatchProgressInfo | null>(null);

  const downloadPlot = (base64: string, filename = "leave-one-out") => {
    const link = document.createElement("a");
    link.href = base64;
    link.download = `${filename}-plot.png`;
    link.click();
  };

  // Accepts CSV or genuine XLSX (SheetJS binary parse) - same isXlsx/
  // XLSX.read()/sheet_to_json convention already proven in TSA and the NMA
  // data input, applied here so this tool actually supports the .xlsx/.xls
  // extensions its file picker advertises. Once we have `dataRows` as plain
  // string[][] (one array of cell values per row, header row excluded),
  // the per-outcome-type column mapping below is identical regardless of
  // source format.
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
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
      const parsed = dataRows.map(c => {
        if (c.length < 3) return null;
        if (activeTab === 'dichotomous') {
          return { study: String(c[0] ?? "").replace(/['"]+/g, '').trim(), event_e: Number(c[1]) || 0, n_e: Number(c[2]) || 0, event_c: Number(c[3]) || 0, n_c: Number(c[4]) || 0 } as DichRow;
        } else if (activeTab === 'continuous') {
          return { study: String(c[0] ?? "").replace(/['"]+/g, '').trim(), mean_e: Number(c[1]) || 0, sd_e: Number(c[2]) || 0, n_e: Number(c[3]) || 0, mean_c: Number(c[4]) || 0, sd_c: Number(c[5]) || 0, n_c: Number(c[6]) || 0 } as ContRow;
        } else {
          return { study: String(c[0] ?? "").replace(/['"]+/g, '').trim(), te: Number(c[1]) || 0, se: Number(c[2]) || 0 } as IvRow;
        }
      }).filter((x): x is SensRow => !!x && !!x.study && x.study !== "");

      if (parsed.length) {
        if (activeTab === 'dichotomous') setDichStudies(parsed as DichRow[]);
        else if (activeTab === 'continuous') setContStudies(parsed as ContRow[]);
        else setIvStudies(parsed as IvRow[]);
        alert(`Loaded ${parsed.length} studies from ${isXlsx ? "XLSX" : "CSV"}!`);
      }
    };
    if (isXlsx) reader.readAsArrayBuffer(file); else reader.readAsText(file);
  };

  const importPasteToState = (text: string) => {
    if (!text.trim()) return;
    const rows = text.trim().split("\n");
    const parsed = rows.map(r => {
      const c = r.split("\t");
      if (activeTab === 'dichotomous') {
        return { study: c[0] || "Study", event_e: Number(c[1]) || 0, n_e: Number(c[2]) || 0, event_c: Number(c[3]) || 0, n_c: Number(c[4]) || 0 } as DichRow;
      } else if (activeTab === 'continuous') {
        return { study: c[0] || "Trial", mean_e: Number(c[1]) || 0, sd_e: Number(c[2]) || 0, n_e: Number(c[3]) || 0, mean_c: Number(c[4]) || 0, sd_c: Number(c[5]) || 0, n_c: Number(c[6]) || 0 } as ContRow;
      } else {
        return { study: c[0] || "Author", te: Number(c[1]) || 0, se: Number(c[2]) || 0 } as IvRow;
      }
    }).filter((x): x is SensRow => !!x && !!x.study && x.study !== "");

    if (parsed.length > 0) {
      if (activeTab === 'dichotomous') setDichStudies(parsed as DichRow[]);
      else if (activeTab === 'continuous') setContStudies(parsed as ContRow[]);
      else setIvStudies(parsed as IvRow[]);
      setPasteData("");
      alert(`Successfully imported ${parsed.length} studies!`);
    }
  };

  const runAnalysis = async () => {
    const currentStudies = activeTab === 'dichotomous' ? dichStudies : activeTab === 'continuous' ? contStudies : ivStudies;
    
    if (currentStudies.length < 3) {
      setErrorMessage("Error: At least 3 studies are required for Leave-One-Out analysis.");
      return;
    }
    
    setLoading(true);
    setResults(null);
    setErrorMessage("");

    try {
      const payload = {
        studies: currentStudies,
        config: { effect_measure: effectMeasure, model, tau_estimator: tauEstimator, inference, ci_level: ciLevel }
      };
      
      const res = await fetch(`${META_API_URL}/api/meta/sensitivity-loo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const textResponse = await res.text();
      let data;
      try {
        data = JSON.parse(textResponse);
      } catch (e) {
        setErrorMessage("Fatal Error: R Plumber returned an invalid response. Check the R Console for crashes.");
        setLoading(false);
        return;
      }

      if (data.status === "success") {
        setResults(data);
      } else {
        setErrorMessage(`R Execution Error: ${data.message || "Unknown error occurred inside R."}`);
      }
    } catch {
      setErrorMessage(BACKEND_UNAVAILABLE_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  // Reuses the exact same /api/meta/sensitivity-loo R endpoint as the
  // single-outcome workflow above, called once per selected outcome.
  async function runMultiOutcomeBatch(outcomes: DetectedOutcome[]) {
    setMultiRunning(true);
    setMultiRunStates(outcomes.map((outcome) => ({ outcome, status: "pending" as const })));
    const configPayload = { effect_measure: effectMeasure, model, tau_estimator: tauEstimator, inference, ci_level: ciLevel };

    await runOutcomeBatch<SensitivityLOOResult>(
      outcomes,
      async (outcome) => {
        const res = await fetch(`${META_API_URL}/api/meta/sensitivity-loo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studies: outcome.eligibleStudies, config: configPayload }),
        });
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("The statistical backend returned an invalid response for this outcome.");
        }
        if (data.status !== "success") throw new Error(data.message || "The statistical backend reported an error for this outcome.");
        return data as SensitivityLOOResult;
      },
      (index, state) => setMultiRunStates((prev) => prev.map((s, i) => (i === index ? state : s))),
      (progress) => setMultiProgress(progress)
    );
    setMultiRunning(false);
    setMultiProgress(null);
  }

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
            <h1 className="text-3xl font-bold text-white mb-2">Leave-One-Out Sensitivity Analysis</h1>
            <p className="text-slate-400 text-sm">Perform leave-one-out influence diagnostics via R precision modeling.</p>
          </div>

          {errorMessage && <div className="bg-red-950/80 border border-red-500/80 text-red-200 p-5 rounded-xl text-sm font-mono shadow-lg">{errorMessage}</div>}

          <div className="flex gap-3 border-b border-slate-800 pb-4 overflow-x-auto">
            <button onClick={() => { setActiveTab("dichotomous"); setEffectMeasure("RR"); }} className={`px-5 py-2.5 rounded-xl font-medium transition ${activeTab === "dichotomous" ? "bg-indigo-600 text-white" : "text-slate-400 bg-[#151722]"}`}>Dichotomous Data</button>
            <button onClick={() => { setActiveTab("continuous"); setEffectMeasure("MD"); }} className={`px-5 py-2.5 rounded-xl font-medium transition ${activeTab === "continuous" ? "bg-indigo-600 text-white" : "text-slate-400 bg-[#151722]"}`}>Continuous Data</button>
            <button onClick={() => { setActiveTab("iv"); setEffectMeasure("HR"); }} className={`px-5 py-2.5 rounded-xl font-medium transition ${activeTab === "iv" ? "bg-indigo-600 text-white" : "text-slate-400 bg-[#151722]"}`}>Generic Inverse Variance</button>
          </div>

          <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6">
            <h3 className="text-white font-semibold text-sm mb-3">Quick Import & File Upload (CSV / TSV)</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <textarea rows={2} value={pasteData} onChange={e => setPasteData(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2 text-xs text-slate-200 mb-2" placeholder="Paste TSV rows here..." />
                <button onClick={() => importPasteToState(pasteData)} className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg">Import Pasted Data</button>
              </div>
              <div>
                <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-900/40 file:text-indigo-300 cursor-pointer" />
              </div>
            </div>
          </div>

          <div className="bg-[#151722] border border-indigo-900/30 rounded-2xl p-6 shadow-xl space-y-6">
            <h3 className="text-lg font-bold text-white">Primary Analysis Settings</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Effect Measure:</label>
                <select value={effectMeasure} onChange={e => setEffectMeasure(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                  {activeTab === "dichotomous" && <><option value="RR">Risk Ratio (RR)</option><option value="OR">Odds Ratio (OR)</option><option value="RD">Risk Difference (RD)</option></>}
                  {activeTab === "continuous" && <><option value="MD">Mean Difference (MD)</option><option value="SMD">SMD</option></>}
                  {activeTab === "iv" && <><option value="HR">Log Hazard Ratio (HR)</option><option value="RR">Log Risk Ratio (RR)</option><option value="OR">Log Odds Ratio (OR)</option></>}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Meta-Analysis Model:</label>
                <select value={model} onChange={e => setModel(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                  <option value="Random-effects">Random-effects</option>
                  <option value="Common-effect">Common-effect</option>
                </select>
              </div>
              {model === "Random-effects" && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tau² Estimator:</label>
                  <select value={tauEstimator} onChange={e => setTauEstimator(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                    <option value="REML">REML</option>
                    <option value="DL">DerSimonian-Laird (DL)</option>
                    <option value="PM">Paule-Mandel (PM)</option>
                  </select>
                </div>
              )}
            </div>
            {activeTab !== "iv" && (
              <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                <div><label className="block text-xs text-slate-400 mb-1">Experimental Group Label:</label><input type="text" value={expGroupLabel} onChange={e => setExpGroupLabel(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white" /></div>
                <div><label className="block text-xs text-slate-400 mb-1">Control Group Label:</label><input type="text" value={ctrlGroupLabel} onChange={e => setCtrlGroupLabel(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white" /></div>
              </div>
            )}
          </div>

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
              runLabel="Run Leave-One-Out"
              minStudies={LOO_MIN_STUDIES}
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
                        multiRunStates.filter((s): s is OutcomeRunState<SensitivityLOOResult> & { result: SensitivityLOOResult } => s.status === "success" && !!s.result).map((s) => ({ outcomeName: s.outcome.name, base64Png: s.result.plot_base64 })),
                        "leave_one_out_plots.zip",
                        "leave_one_out"
                      )
                    }
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg"
                  >
                    Download all LOO plots (ZIP)
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
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300 border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-500 uppercase bg-black/40">
                              <th className="p-2">Study Omitted</th><th className="p-2">k</th><th className="p-2">Pooled Effect</th><th className="p-2">95% CI</th><th className="p-2">p</th><th className="p-2">Tau²</th><th className="p-2">I²</th>
                            </tr>
                          </thead>
                          <tbody>
                            {state.result.table.omitted_study.map((study, idx) => (
                              <tr key={idx} className={`border-b border-slate-800 ${idx === 0 ? "bg-indigo-950/40 font-bold text-white" : "bg-[#151722]"}`}>
                                <td className="p-2">{study}</td>
                                <td className="p-2">{state.result!.table.k[idx]}</td>
                                <td className="p-2 text-indigo-400">{state.result!.table.pooled_effect[idx]}</td>
                                <td className="p-2">[{state.result!.table.lower_ci[idx]} – {state.result!.table.upper_ci[idx]}]</td>
                                <td className="p-2">{state.result!.table.pval[idx]}</td>
                                <td className="p-2">{state.result!.table.tau2[idx]}</td>
                                <td className="p-2">{state.result!.table.i2[idx]}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="bg-white p-4 rounded-xl flex flex-col items-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={state.result.plot_base64} alt={`Leave-one-out plot: ${state.outcome.name}`} className="w-full max-w-3xl mb-3" />
                        <button
                          type="button"
                          onClick={() => {
                            const link = document.createElement("a");
                            link.href = state.result!.plot_base64;
                            link.download = `leave_one_out_${sanitizeFilenamePart(state.outcome.name)}.png`;
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

          {activeTab === "dichotomous" && (
            <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-white font-semibold text-sm">Dichotomous Data Input</h3>
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="text-slate-500 uppercase text-xs">
                  <tr><th className="pb-3">Study ID</th><th className="pb-3">{expGroupLabel} Events</th><th className="pb-3">{expGroupLabel} Total</th><th className="pb-3">{ctrlGroupLabel} Events</th><th className="pb-3">{ctrlGroupLabel} Total</th></tr>
                </thead>
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
              <button onClick={runAnalysis} disabled={loading} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg transition">{loading ? "Running Analysis..." : "Run Leave-One-Out Analysis"}</button>
            </div>
          )}

          {activeTab === "continuous" && (
            <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-white font-semibold text-sm">Continuous Data Input</h3>
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="text-slate-500 uppercase text-xs">
                  <tr><th className="pb-3">Study ID</th><th className="pb-3">{expGroupLabel} Mean</th><th className="pb-3">{expGroupLabel} SD</th><th className="pb-3">{expGroupLabel} N</th><th className="pb-3">{ctrlGroupLabel} Mean</th><th className="pb-3">{ctrlGroupLabel} SD</th><th className="pb-3">{ctrlGroupLabel} N</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {contStudies.map((row, idx) => (
                    <tr key={idx}>
                      <td className="py-2 pr-2"><input type="text" value={row.study} onChange={e => { const next = [...contStudies]; next[idx].study = e.target.value; setContStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1.5 w-full text-white text-xs" /></td>
                      <td className="py-2 px-1"><input type="number" step="0.1" value={row.mean_e} onChange={e => { const next = [...contStudies]; next[idx].mean_e = Number(e.target.value); setContStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1.5 w-16 text-white text-xs" /></td>
                      <td className="py-2 px-1"><input type="number" step="0.1" value={row.sd_e} onChange={e => { const next = [...contStudies]; next[idx].sd_e = Number(e.target.value); setContStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1.5 w-16 text-white text-xs" /></td>
                      <td className="py-2 px-1"><input type="number" value={row.n_e} onChange={e => { const next = [...contStudies]; next[idx].n_e = Number(e.target.value); setContStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1.5 w-16 text-white text-xs" /></td>
                      <td className="py-2 px-1"><input type="number" step="0.1" value={row.mean_c} onChange={e => { const next = [...contStudies]; next[idx].mean_c = Number(e.target.value); setContStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1.5 w-16 text-white text-xs" /></td>
                      <td className="py-2 px-1"><input type="number" step="0.1" value={row.sd_c} onChange={e => { const next = [...contStudies]; next[idx].sd_c = Number(e.target.value); setContStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1.5 w-16 text-white text-xs" /></td>
                      <td className="py-2 px-1"><input type="number" value={row.n_c} onChange={e => { const next = [...contStudies]; next[idx].n_c = Number(e.target.value); setContStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1.5 w-16 text-white text-xs" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={runAnalysis} disabled={loading} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg transition">{loading ? "Running Analysis..." : "Run Leave-One-Out Analysis"}</button>
            </div>
          )}

          {activeTab === "iv" && (
            <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-white font-semibold text-sm">Generic Inverse Variance Data Input</h3>
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="text-slate-500 uppercase text-xs">
                  <tr><th className="pb-3">Study ID</th><th className="pb-3">Log Effect (TE)</th><th className="pb-3">Standard Error (SE)</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {ivStudies.map((row, idx) => (
                    <tr key={idx}>
                      <td className="py-2 pr-2"><input type="text" value={row.study} onChange={e => { const next = [...ivStudies]; next[idx].study = e.target.value; setIvStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-3 py-1.5 w-full text-white" /></td>
                      <td className="py-2 px-2"><input type="number" step="0.01" value={row.te} onChange={e => { const next = [...ivStudies]; next[idx].te = Number(e.target.value); setIvStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-3 py-1.5 w-32 text-white" /></td>
                      <td className="py-2 px-2"><input type="number" step="0.01" value={row.se} onChange={e => { const next = [...ivStudies]; next[idx].se = Number(e.target.value); setIvStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-3 py-1.5 w-32 text-white" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={runAnalysis} disabled={loading} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg transition">{loading ? "Running Analysis..." : "Run Leave-One-Out Analysis"}</button>
            </div>
          )}

          {results && results.table && (
            <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">Leave-One-Out Influence Results</h3>
                <button onClick={() => downloadPlot(results.plot_base64, "loo")} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg shadow">Download Plot</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 uppercase text-xs bg-black/40">
                      <th className="p-3">Study Omitted</th><th className="p-3">k</th><th className="p-3">Pooled Effect</th><th className="p-3">95% CI</th><th className="p-3">p-value</th><th className="p-3">Tau²</th><th className="p-3">I² (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.table.omitted_study.map((study: string, idx: number) => (
                      <tr key={idx} className={`border-b border-slate-800 ${idx === 0 ? "bg-indigo-950/40 font-bold text-white" : "bg-[#0b0c10]"}`}>
                        <td className="p-3">{study}</td>
                        <td className="p-3">{results.table.k[idx]}</td>
                        <td className="p-3 text-indigo-400">{results.table.pooled_effect[idx]}</td>
                        <td className="p-3">[{results.table.lower_ci[idx]} – {results.table.upper_ci[idx]}]</td>
                        <td className="p-3">{results.table.pval[idx]}</td>
                        <td className="p-3">{results.table.tau2[idx]}</td>
                        <td className="p-3">{results.table.i2[idx]}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-inner flex flex-col items-center">
                <img src={results.plot_base64} className="w-full max-w-4xl" />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}