"use client";

import { useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import type { BiasResult } from '../../types/statistics';
import { META_API_URL } from '../../lib/apiConfig';
import { BACKEND_UNAVAILABLE_MESSAGE } from '../../lib/apiClient';
import MultiOutcomeWorkflow, { type BatchProgressInfo } from '@/app/components/multiOutcome/MultiOutcomeWorkflow';
import LazyOutcomeCard from '@/app/components/multiOutcome/LazyOutcomeCard';
import { runOutcomeBatch } from '@/app/lib/multiOutcome/batch';
import { downloadPlotsAsZip } from '@/app/lib/multiOutcome/zipDownload';
import { sanitizeFilenamePart } from '@/app/lib/multiOutcome/filenames';
import type { DetectedOutcome, OutcomeRunState } from '@/app/lib/multiOutcome/types';
import { deriveEffect, emptyHRRow, type HRStudyRow } from '@/app/lib/survivalHR/conversion';
import SurvivalHRTable from '@/app/components/survivalHR/SurvivalHRTable';

interface DichArm { study: string; event_e: number; n_e: number; event_c: number; n_c: number; }
interface ContArm { study: string; n_e: number; mean_e: number; sd_e: number; n_c: number; mean_c: number; sd_c: number; }
interface IvArm { study: string; te: number; se: number; }
type BiasArm = DichArm | ContArm | IvArm;
type BiasType = 'dich' | 'cont' | 'iv';

export default function BiasTool() {
  const [biasTab, setBiasTab] = useState("dichotomous");
  const [showModal, setShowModal] = useState(false);

  const safeNum = (val: unknown) => Number(Array.isArray(val) ? val[0] : val);
  const safeStr = (val: unknown) => (Array.isArray(val) ? val[0] : val) as string;

  const [biasDichStudies, setBiasDichStudies] = useState<DichArm[]>([{ study: "Study A 2021", event_e: 12, n_e: 100, event_c: 24, n_c: 100 }]);
  const [biasContStudies, setBiasContStudies] = useState<ContArm[]>([{ study: "Smith 2020", n_e: 60, mean_e: 12.4, sd_e: 3.2, n_c: 60, mean_c: 14.1, sd_c: 3.4 }]);
  const [biasIvStudies, setBiasIvStudies] = useState<IvArm[]>([{ study: "Author A 2022", te: 0.52, se: 0.15 }]);
  // Survival (HR) tab - front-end only, reuses the same /api/meta/bias-iv
  // endpoint the "iv" tab above already calls. See app/lib/survivalHR/conversion.ts.
  const [biasHrStudies, setBiasHrStudies] = useState<HRStudyRow[]>([emptyHRRow("bias-hr-init")]);

  const [biasDichRes, setBiasDichRes] = useState<BiasResult | null>(null);
  const [biasContRes, setBiasContRes] = useState<BiasResult | null>(null);
  const [biasIvRes, setBiasIvRes] = useState<BiasResult | null>(null);
  const [biasHrRes, setBiasHrRes] = useState<BiasResult | null>(null);

  const [biasLoading, setBiasLoading] = useState(false);
  const [biasPaste, setBiasPaste] = useState("");
  const [biasError, setBiasError] = useState<string | null>(null);

  // Multi-outcome group labels + batch state, mirroring the Forest Plot
  // tool's implementation exactly (same shared lib/components) - IV has no
  // multi-outcome mode, same reason as Forest Plot.
  const [multiExpLabel, setMultiExpLabel] = useState("Experimental");
  const [multiCtrlLabel, setMultiCtrlLabel] = useState("Control");
  const [multiRunStates, setMultiRunStates] = useState<OutcomeRunState<BiasResult>[]>([]);
  const [multiRunning, setMultiRunning] = useState(false);
  const [multiProgress, setMultiProgress] = useState<BatchProgressInfo | null>(null);

  const downloadPlot = (base64: string, filename: string) => {
    const link = document.createElement("a");
    link.href = base64;
    link.download = `${filename}-plot.png`;
    link.click();
  };

  function importPasteToState<T extends BiasArm>(text: string, setter: (v: T[]) => void, type: BiasType) {
    if (!text.trim()) return;
    const rows = text.trim().split("\n");
    let parsed: BiasArm[] = [];
    if (type === 'dich') {
      parsed = rows.map(r => { const c = r.split("\t"); return { study: c[0] || "Study", event_e: Number(c[1]) || 0, n_e: Number(c[2]) || 0, event_c: Number(c[3]) || 0, n_c: Number(c[4]) || 0 }; }).filter(x => (x as DichArm).n_e > 0);
    } else if (type === 'cont') {
      parsed = rows.map(r => { const c = r.split("\t"); return { study: c[0] || "Trial", n_e: Number(c[1]) || 0, mean_e: Number(c[2]) || 0, sd_e: Number(c[3]) || 0, n_c: Number(c[4]) || 0, mean_c: Number(c[5]) || 0, sd_c: Number(c[6]) || 0 }; }).filter(x => (x as ContArm).n_e > 0);
    } else if (type === 'iv') {
      parsed = rows.map(r => { const c = r.split("\t"); return { study: c[0] || "Author", te: Number(c[1]) || 0, se: Number(c[2]) || 0 }; }).filter(x => (x as IvArm).se > 0);
    }
    if (parsed.length > 0) { setter(parsed as T[]); setBiasPaste(""); alert(`Successfully imported ${parsed.length} studies!`); }
  }

  // Accepts CSV or genuine XLSX (SheetJS binary parse) - same isXlsx/
  // XLSX.read()/sheet_to_json convention already proven in TSA and the NMA
  // data input, applied here so this tool actually supports the .xlsx/.xls
  // extensions its file picker advertises. Once we have `dataRows` as plain
  // string[][] (one array of cell values per row, header row excluded),
  // the per-outcome-type column mapping below is identical regardless of
  // source format.
  function handleFileUpload<T extends BiasArm>(e: ChangeEvent<HTMLInputElement>, type: BiasType, setter: (v: T[]) => void) {
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
      let parsed: (BiasArm | null)[] = [];
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

  const runBias = async (endpoint: string, studies: BiasArm[], setter: (v: BiasResult) => void, config?: { effect_measure: string }) => {
    setBiasLoading(true);
    setBiasError(null);
    try {
      const res = await fetch(`${META_API_URL}/api/meta/${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config ? { studies, config } : { studies })
      });
      const data: BiasResult = await res.json();
      setter(data);
      if (data.n_studies < 10) {
        alert("Cochrane Advisory Notice: Funnel plots and Egger's regression tests are recommended only when there are 10 or more studies. Your results have been computed, but please interpret them cautiously.");
      }
    } catch {
      setBiasError(BACKEND_UNAVAILABLE_MESSAGE);
    } finally { setBiasLoading(false); }
  };

  // Survival (HR) tab: derives {te, se} from each row's HR+CI or direct
  // ln(HR)/SE, then calls the exact same bias-iv endpoint runBias already uses.
  const runBiasHR = () => {
    const unresolved = biasHrStudies.filter((r) => deriveEffect(r) === null);
    if (unresolved.length > 0) {
      alert(`Cannot run: ${unresolved.length} stud${unresolved.length === 1 ? "y has" : "ies have"} incomplete or invalid HR data. Fix the rows marked "Unresolved" before running.`);
      return;
    }
    const derived: IvArm[] = biasHrStudies.map((r) => { const d = deriveEffect(r)!; return { study: r.study, te: d.te, se: d.se }; });
    runBias("bias-iv", derived, setBiasHrRes, { effect_measure: "HR" });
  };

  // Reuses the exact same bias-dich/bias-cont R endpoints as the
  // single-outcome workflow above, called once per selected outcome.
  async function runMultiOutcomeBatch(outcomes: DetectedOutcome[], type: 'dich' | 'cont') {
    setMultiRunning(true);
    setMultiRunStates(outcomes.map((outcome) => ({ outcome, status: "pending" as const })));
    const endpoint = type === 'cont' ? "bias-cont" : "bias-dich";

    await runOutcomeBatch<BiasResult>(
      outcomes,
      async (outcome) => {
        const res = await fetch(`${META_API_URL}/api/meta/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studies: outcome.eligibleStudies }),
        });
        const data = await res.json();
        if ((data as { status?: string }).status === "error") throw new Error((data as { message?: string }).message || "The statistical backend reported an error for this outcome.");
        return data as BiasResult;
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
            <h2 className="text-2xl font-bold text-white mb-4">Publication Bias & Funnel Plot</h2>
            <p className="text-slate-300 text-sm leading-relaxed">Egger&apos;s linear regression test and contour-enhanced funnel plots detect publication bias and small-study effects across 10 or more studies.</p>
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
          {biasError && <div className="bg-red-950/80 border border-red-500/80 text-red-200 p-5 rounded-xl text-sm font-mono shadow-lg">{biasError}</div>}

          <div className="flex gap-3 mb-6 border-b border-slate-800 pb-4 overflow-x-auto">
            <button onClick={() => setBiasTab("dichotomous")} className={`px-5 py-2.5 rounded-xl font-medium transition ${biasTab === "dichotomous" ? "bg-indigo-600 text-white" : "text-slate-400 bg-[#151722]"}`}>Dichotomous Data</button>
            <button onClick={() => setBiasTab("continuous")} className={`px-5 py-2.5 rounded-xl font-medium transition ${biasTab === "continuous" ? "bg-indigo-600 text-white" : "text-slate-400 bg-[#151722]"}`}>Continuous Data</button>
            <button onClick={() => setBiasTab("iv")} className={`px-5 py-2.5 rounded-xl font-medium transition ${biasTab === "iv" ? "bg-indigo-600 text-white" : "text-slate-400 bg-[#151722]"}`}>Generic Inverse Variance</button>
            <button onClick={() => setBiasTab("hr")} className={`px-5 py-2.5 rounded-xl font-medium transition ${biasTab === "hr" ? "bg-indigo-600 text-white" : "text-slate-400 bg-[#151722]"}`}>Survival (HR)</button>
          </div>

          {biasTab === "dichotomous" && (
            <div className="space-y-6">
              <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6">
                <h3 className="text-white font-semibold text-sm mb-3">Quick Import (Excel / Google Sheets)</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <textarea rows={2} value={biasPaste} onChange={e => setBiasPaste(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2 text-xs text-slate-200 mb-2" placeholder="Study | Tx Events | Tx Total | Ctrl Events | Ctrl Total" />
                    <button onClick={() => importPasteToState(biasPaste, setBiasDichStudies, 'dich')} className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg">Import Pasted Data</button>
                  </div>
                  <div>
                    <input type="file" accept=".csv,.xlsx,.xls" onChange={e => handleFileUpload(e, 'dich', setBiasDichStudies)} className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-900/40 file:text-indigo-300 cursor-pointer" />
                  </div>
                </div>
              </div>

              <MultiOutcomeWorkflow
                type="dichotomous"
                expLabel={multiExpLabel}
                ctrlLabel={multiCtrlLabel}
                onExpLabelChange={setMultiExpLabel}
                onCtrlLabelChange={setMultiCtrlLabel}
                onRunSelected={(outcomes) => runMultiOutcomeBatch(outcomes, 'dich')}
                running={multiRunning}
                progress={multiProgress}
                runLabel="Run Funnel Plots"
              />
              {multiRunStates.length > 0 && <MultiOutcomeBiasResults states={multiRunStates} />}

              <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 shadow-xl">
                <h2 className="text-xl font-semibold text-white mb-2">Dichotomous Funnel Plot & Egger&apos;s Test</h2>
                <table className="w-full text-left text-sm text-slate-300 mb-6">
                  <thead className="text-slate-500 uppercase text-xs"><tr><th className="pb-3">Study ID</th><th className="pb-3">Tx Events</th><th className="pb-3">Tx Total</th><th className="pb-3">Ctrl Events</th><th className="pb-3">Ctrl Total</th></tr></thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {biasDichStudies.map((row, idx) => (
                      <tr key={idx}>
                        <td className="py-2 pr-2"><input type="text" value={row.study} onChange={e => { const next = [...biasDichStudies]; next[idx].study = e.target.value; setBiasDichStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-3 py-1.5 w-full text-white" /></td>
                        <td className="py-2 px-2"><input type="number" value={row.event_e} onChange={e => { const next = [...biasDichStudies]; next[idx].event_e = Number(e.target.value); setBiasDichStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-3 py-1.5 w-24 text-white" /></td>
                        <td className="py-2 px-2"><input type="number" value={row.n_e} onChange={e => { const next = [...biasDichStudies]; next[idx].n_e = Number(e.target.value); setBiasDichStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-3 py-1.5 w-24 text-white" /></td>
                        <td className="py-2 px-2"><input type="number" value={row.event_c} onChange={e => { const next = [...biasDichStudies]; next[idx].event_c = Number(e.target.value); setBiasDichStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-3 py-1.5 w-24 text-white" /></td>
                        <td className="py-2 px-2"><input type="number" value={row.n_c} onChange={e => { const next = [...biasDichStudies]; next[idx].n_c = Number(e.target.value); setBiasDichStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-3 py-1.5 w-24 text-white" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={() => runBias("bias-dich", biasDichStudies, setBiasDichRes)} disabled={biasLoading} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg transition">{biasLoading ? "Running..." : "Run Egger&apos;s Test & Generate Funnel Plot"}</button>
              </div>

              {biasDichRes && (
                <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl space-y-6">
                  {biasDichRes.n_studies < 10 && (
                    <div className="bg-amber-950/40 border border-amber-600/50 rounded-xl p-4 text-amber-300 text-sm flex items-start gap-3">
                      <span className="text-xl">⚠️</span>
                      <div><strong>Cochrane Advisory Notice:</strong> Funnel plots and Egger&apos;s tests are recommended only when there are 10 or more studies. You are analyzing {biasDichRes.n_studies} studies — please interpret these findings cautiously.</div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-[#0b0c10] p-4 rounded-xl border border-slate-800"><span className="text-xs text-slate-500 block mb-1">Intercept (Bias)</span><span className="text-2xl font-bold text-indigo-400">{safeNum(biasDichRes.bias_intercept)}</span></div>
                    <div className="bg-[#0b0c10] p-4 rounded-xl border border-slate-800"><span className="text-xs text-slate-500 block mb-1">Egger&apos;s P-Value</span><span className="text-2xl font-bold text-emerald-400">{safeNum(biasDichRes.eggers_p_value)}</span></div>
                    <div className="bg-[#0b0c10] p-4 rounded-xl border border-slate-800"><span className="text-xs text-slate-500 block mb-1">t Statistic</span><span className="text-2xl font-bold text-white">{safeNum(biasDichRes.t_val)}</span></div>
                    <div className="bg-[#0b0c10] p-4 rounded-xl border border-slate-800"><span className="text-xs text-slate-500 block mb-1">Studies Analyzed</span><span className="text-2xl font-bold text-white">{biasDichRes.n_studies}</span></div>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-inner flex flex-col items-center">
                    <h4 className="text-slate-900 font-bold mb-4">Dichotomous Funnel Plot</h4>
                    <img src={safeStr(biasDichRes.funnel_plot_base64)} className="w-full max-w-4xl mb-4" />
                    <button onClick={() => downloadPlot(biasDichRes.funnel_plot_base64, "dichotomous-funnel")} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow">Download High Res PNG</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {biasTab === "continuous" && (
            <div className="space-y-6">
              <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6">
                <h3 className="text-white font-semibold text-sm mb-3">Quick Import (Excel / Google Sheets)</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <textarea rows={2} value={biasPaste} onChange={e => setBiasPaste(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2 text-xs text-slate-200 mb-2" placeholder="Study | Tx N | Tx Mean | Tx SD | Ctrl N | Ctrl Mean | Ctrl SD" />
                    <button onClick={() => importPasteToState(biasPaste, setBiasContStudies, 'cont')} className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg">Import Pasted Data</button>
                  </div>
                  <div>
                    <input type="file" accept=".csv,.xlsx,.xls" onChange={e => handleFileUpload(e, 'cont', setBiasContStudies)} className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-900/40 file:text-indigo-300 cursor-pointer" />
                  </div>
                </div>
              </div>

              <MultiOutcomeWorkflow
                type="continuous"
                expLabel={multiExpLabel}
                ctrlLabel={multiCtrlLabel}
                onExpLabelChange={setMultiExpLabel}
                onCtrlLabelChange={setMultiCtrlLabel}
                onRunSelected={(outcomes) => runMultiOutcomeBatch(outcomes, 'cont')}
                running={multiRunning}
                progress={multiProgress}
                runLabel="Run Funnel Plots"
              />
              {multiRunStates.length > 0 && <MultiOutcomeBiasResults states={multiRunStates} />}

              <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 shadow-xl">
                <h2 className="text-xl font-semibold text-white mb-2">Continuous Funnel Plot & Egger&apos;s Test</h2>
                <table className="w-full text-left text-sm text-slate-300 mb-6">
                  <thead className="text-slate-500 uppercase text-xs"><tr><th className="pb-3">Study ID</th><th className="pb-3">Tx (N)</th><th className="pb-3">Tx Mean</th><th className="pb-3">Tx SD</th><th className="pb-3">Ctrl (N)</th><th className="pb-3">Ctrl Mean</th><th className="pb-3">Ctrl SD</th></tr></thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {biasContStudies.map((row, idx) => (
                      <tr key={idx}>
                        <td className="py-2 pr-2"><input type="text" value={row.study} onChange={e => { const next = [...biasContStudies]; next[idx].study = e.target.value; setBiasContStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1.5 w-full text-white text-xs" /></td>
                        <td className="py-2 px-1"><input type="number" value={row.n_e} onChange={e => { const next = [...biasContStudies]; next[idx].n_e = Number(e.target.value); setBiasContStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1.5 w-20 text-white text-xs" /></td>
                        <td className="py-2 px-1"><input type="number" step="0.1" value={row.mean_e} onChange={e => { const next = [...biasContStudies]; next[idx].mean_e = Number(e.target.value); setBiasContStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1.5 w-20 text-white text-xs" /></td>
                        <td className="py-2 px-1"><input type="number" step="0.1" value={row.sd_e} onChange={e => { const next = [...biasContStudies]; next[idx].sd_e = Number(e.target.value); setBiasContStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1.5 w-20 text-white text-xs" /></td>
                        <td className="py-2 px-1"><input type="number" value={row.n_c} onChange={e => { const next = [...biasContStudies]; next[idx].n_c = Number(e.target.value); setBiasContStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1.5 w-20 text-white text-xs" /></td>
                        <td className="py-2 px-1"><input type="number" step="0.1" value={row.mean_c} onChange={e => { const next = [...biasContStudies]; next[idx].mean_c = Number(e.target.value); setBiasContStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1.5 w-20 text-white text-xs" /></td>
                        <td className="py-2 px-1"><input type="number" step="0.1" value={row.sd_c} onChange={e => { const next = [...biasContStudies]; next[idx].sd_c = Number(e.target.value); setBiasContStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1.5 w-20 text-white text-xs" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={() => runBias("bias-cont", biasContStudies, setBiasContRes)} disabled={biasLoading} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg transition">{biasLoading ? "Running..." : "Run Egger&apos;s Test & Generate Funnel Plot"}</button>
              </div>

              {biasContRes && (
                <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl space-y-6">
                  {biasContRes.n_studies < 10 && (
                    <div className="bg-amber-950/40 border border-amber-600/50 rounded-xl p-4 text-amber-300 text-sm flex items-start gap-3">
                      <span className="text-xl">⚠️</span>
                      <div><strong>Cochrane Advisory Notice:</strong> Funnel plots and Egger&apos;s tests are recommended only when there are 10 or more studies. You are analyzing {biasContRes.n_studies} studies — please interpret these findings cautiously.</div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-[#0b0c10] p-4 rounded-xl border border-slate-800"><span className="text-xs text-slate-500 block mb-1">Intercept (Bias)</span><span className="text-2xl font-bold text-indigo-400">{safeNum(biasContRes.bias_intercept)}</span></div>
                    <div className="bg-[#0b0c10] p-4 rounded-xl border border-slate-800"><span className="text-xs text-slate-500 block mb-1">Egger&apos;s P-Value</span><span className="text-2xl font-bold text-emerald-400">{safeNum(biasContRes.eggers_p_value)}</span></div>
                    <div className="bg-[#0b0c10] p-4 rounded-xl border border-slate-800"><span className="text-xs text-slate-500 block mb-1">t Statistic</span><span className="text-2xl font-bold text-white">{safeNum(biasContRes.t_val)}</span></div>
                    <div className="bg-[#0b0c10] border border-slate-800"><span className="text-xs text-slate-500 block mb-1">Studies Analyzed</span><span className="text-2xl font-bold text-white">{biasContRes.n_studies}</span></div>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-inner flex flex-col items-center">
                    <h4 className="text-slate-900 font-bold mb-4">Continuous Funnel Plot</h4>
                    <img src={safeStr(biasContRes.funnel_plot_base64)} className="w-full max-w-4xl mb-4" />
                    <button onClick={() => downloadPlot(biasContRes.funnel_plot_base64, "continuous-funnel")} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow">Download High Res PNG</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {biasTab === "iv" && (
            <div className="space-y-6">
              <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6">
                <h3 className="text-white font-semibold text-sm mb-3">Quick Import (Excel / Google Sheets)</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <textarea rows={2} value={biasPaste} onChange={e => setBiasPaste(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2 text-xs text-slate-200 mb-2" placeholder="Study | Log Effect Size | SE" />
                    <button onClick={() => importPasteToState(biasPaste, setBiasIvStudies, 'iv')} className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg">Import Pasted Data</button>
                  </div>
                  <div>
                    <input type="file" accept=".csv,.xlsx,.xls" onChange={e => handleFileUpload(e, 'iv', setBiasIvStudies)} className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-900/40 file:text-indigo-300 cursor-pointer" />
                  </div>
                </div>
              </div>
              <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 shadow-xl">
                <h2 className="text-xl font-semibold text-white mb-2">Inverse Variance Funnel Plot & Egger&apos;s Test</h2>
                <table className="w-full text-left text-sm text-slate-300 mb-6">
                  <thead className="text-slate-500 uppercase text-xs"><tr><th className="pb-3">Study ID</th><th className="pb-3">Log Effect Size (TE)</th><th className="pb-3">Standard Error (SE)</th></tr></thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {biasIvStudies.map((row, idx) => (
                      <tr key={idx}>
                        <td className="py-2 pr-2"><input type="text" value={row.study} onChange={e => { const next = [...biasIvStudies]; next[idx].study = e.target.value; setBiasIvStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-3 py-1.5 w-full text-white" /></td>
                        <td className="py-2 px-2"><input type="number" step="0.01" value={row.te} onChange={e => { const next = [...biasIvStudies]; next[idx].te = Number(e.target.value); setBiasIvStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-3 py-1.5 w-36 text-white" /></td>
                        <td className="py-2 px-2"><input type="number" step="0.01" value={row.se} onChange={e => { const next = [...biasIvStudies]; next[idx].se = Number(e.target.value); setBiasIvStudies(next); }} className="bg-[#0b0c10] border border-slate-800 rounded px-3 py-1.5 w-36 text-white" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={() => runBias("bias-iv", biasIvStudies, setBiasIvRes)} disabled={biasLoading} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg transition">{biasLoading ? "Running..." : "Run Egger&apos;s Test & Generate Funnel Plot"}</button>
              </div>

              {biasIvRes && (
                <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl space-y-6">
                  {biasIvRes.n_studies < 10 && (
                    <div className="bg-amber-950/40 border border-amber-600/50 rounded-xl p-4 text-amber-300 text-sm flex items-start gap-3">
                      <span className="text-xl">⚠️</span>
                      <div><strong>Cochrane Advisory Notice:</strong> Funnel plots and Egger&apos;s tests are recommended only when there are 10 or more studies. You are analyzing {biasIvRes.n_studies} studies — please interpret these findings cautiously.</div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-[#0b0c10] p-4 rounded-xl border border-slate-800"><span className="text-xs text-slate-500 block mb-1">Intercept (Bias)</span><span className="text-2xl font-bold text-indigo-400">{safeNum(biasIvRes.bias_intercept)}</span></div>
                    <div className="bg-[#0b0c10] p-4 rounded-xl border border-slate-800"><span className="text-xs text-slate-500 block mb-1">Egger&apos;s P-Value</span><span className="text-2xl font-bold text-emerald-400">{safeNum(biasIvRes.eggers_p_value)}</span></div>
                    <div className="bg-[#0b0c10] p-4 rounded-xl border border-slate-800"><span className="text-xs text-slate-500 block mb-1">t Statistic</span><span className="text-2xl font-bold text-white">{safeNum(biasIvRes.t_val)}</span></div>
                    <div className="bg-[#0b0c10] p-4 rounded-xl border border-slate-800"><span className="text-xs text-slate-500 block mb-1">Studies Analyzed</span><span className="text-2xl font-bold text-white">{biasIvRes.n_studies}</span></div>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-inner flex flex-col items-center">
                    <h4 className="text-slate-900 font-bold mb-4">Inverse Variance Funnel Plot</h4>
                    <img src={safeStr(biasIvRes.funnel_plot_base64)} className="w-full max-w-4xl mb-4" />
                    <button onClick={() => downloadPlot(biasIvRes.funnel_plot_base64, "iv-funnel")} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow">Download High Res PNG</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {biasTab === "hr" && (
            <div className="space-y-6">
              <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 shadow-xl">
                <h2 className="text-xl font-semibold text-white mb-2">Survival (Hazard Ratio) Funnel Plot & Egger&apos;s Test</h2>
                <SurvivalHRTable rows={biasHrStudies} onChange={setBiasHrStudies} />
                <button onClick={runBiasHR} disabled={biasLoading} className="mt-4 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg transition">{biasLoading ? "Running..." : "Run Egger's Test & Generate Funnel Plot"}</button>
              </div>

              {biasHrRes && (
                <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl space-y-6">
                  {biasHrRes.n_studies < 10 && (
                    <div className="bg-amber-950/40 border border-amber-600/50 rounded-xl p-4 text-amber-300 text-sm flex items-start gap-3">
                      <span className="text-xl">⚠️</span>
                      <div><strong>Cochrane Advisory Notice:</strong> Funnel plots and Egger&apos;s tests are recommended only when there are 10 or more studies. You are analyzing {biasHrRes.n_studies} studies — please interpret these findings cautiously.</div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-[#0b0c10] p-4 rounded-xl border border-slate-800"><span className="text-xs text-slate-500 block mb-1">Intercept (Bias)</span><span className="text-2xl font-bold text-indigo-400">{safeNum(biasHrRes.bias_intercept)}</span></div>
                    <div className="bg-[#0b0c10] p-4 rounded-xl border border-slate-800"><span className="text-xs text-slate-500 block mb-1">Egger&apos;s P-Value</span><span className="text-2xl font-bold text-emerald-400">{safeNum(biasHrRes.eggers_p_value)}</span></div>
                    <div className="bg-[#0b0c10] p-4 rounded-xl border border-slate-800"><span className="text-xs text-slate-500 block mb-1">t Statistic</span><span className="text-2xl font-bold text-white">{safeNum(biasHrRes.t_val)}</span></div>
                    <div className="bg-[#0b0c10] p-4 rounded-xl border border-slate-800"><span className="text-xs text-slate-500 block mb-1">Studies Analyzed</span><span className="text-2xl font-bold text-white">{biasHrRes.n_studies}</span></div>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-inner flex flex-col items-center">
                    <h4 className="text-slate-900 font-bold mb-4">Survival (HR) Funnel Plot</h4>
                    <img src={safeStr(biasHrRes.funnel_plot_base64)} className="w-full max-w-4xl mb-4" />
                    <button onClick={() => downloadPlot(biasHrRes.funnel_plot_base64, "survival-hr-funnel")} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow">Download High Res PNG</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Shared results dashboard for the multi-outcome funnel-plot batch, used
// by both the dichotomous and continuous tabs above (identical rendering,
// just fed a different OutcomeRunState<BiasResult>[]).
function MultiOutcomeBiasResults({ states }: { states: OutcomeRunState<BiasResult>[] }) {
  return (
    <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm">
          Multi-Outcome Results ({states.filter((s) => s.status === "success").length} of {states.length} completed)
        </h3>
        {states.some((s) => s.status === "success") && (
          <button
            type="button"
            onClick={() =>
              downloadPlotsAsZip(
                states.filter((s): s is OutcomeRunState<BiasResult> & { result: BiasResult } => s.status === "success" && !!s.result).map((s) => ({ outcomeName: s.outcome.name, base64Png: s.result.funnel_plot_base64 })),
                "funnel_plots.zip",
                "funnel_plot"
              )
            }
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg"
          >
            Download all funnel plots (ZIP)
          </button>
        )}
      </div>
      {states.map((state) => (
        <LazyOutcomeCard
          key={state.outcome.name}
          defaultOpen={state.status === "failed"}
          summary={
            <>
              {state.status === "success" && <span className="text-emerald-400">✓</span>}
              {state.status === "failed" && <span className="text-red-400">✗</span>}
              {state.status === "running" && <span className="text-indigo-400">⏳</span>}
              {state.status === "pending" && <span className="text-slate-500">○</span>}
              {state.outcome.name}
              <span className="text-xs text-slate-500 font-normal">({state.outcome.eligibleStudies.length} studies)</span>
            </>
          }
        >
          {state.status === "failed" && <p className="text-xs text-red-400">{state.error}</p>}
          {state.status === "success" && state.result && (
            <div className="space-y-4">
              {state.result.n_studies < 10 && (
                <div className="bg-amber-950/40 border border-amber-600/50 rounded-lg p-3 text-amber-300 text-xs flex items-start gap-2">
                  <span>⚠️</span>
                  <div>Cochrane Advisory Notice: funnel plots/Egger&apos;s tests are recommended only with 10+ studies ({state.result.n_studies} analyzed here) - interpret cautiously.</div>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#151722] p-3 rounded-lg border border-slate-800"><span className="text-[10px] text-slate-500 block">Intercept (Bias)</span><span className="text-lg font-bold text-indigo-400">{state.result.bias_intercept}</span></div>
                <div className="bg-[#151722] p-3 rounded-lg border border-slate-800"><span className="text-[10px] text-slate-500 block">Egger&apos;s P-Value</span><span className="text-lg font-bold text-emerald-400">{state.result.eggers_p_value}</span></div>
                <div className="bg-[#151722] p-3 rounded-lg border border-slate-800"><span className="text-[10px] text-slate-500 block">t Statistic</span><span className="text-lg font-bold text-white">{state.result.t_val}</span></div>
                <div className="bg-[#151722] p-3 rounded-lg border border-slate-800"><span className="text-[10px] text-slate-500 block">Studies</span><span className="text-lg font-bold text-white">{state.result.n_studies}</span></div>
              </div>
              <div className="bg-white p-4 rounded-xl flex flex-col items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={state.result.funnel_plot_base64} alt={`Funnel plot: ${state.outcome.name}`} className="w-full max-w-3xl mb-3" />
                <button
                  type="button"
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = state.result!.funnel_plot_base64;
                    link.download = `funnel_plot_${sanitizeFilenamePart(state.outcome.name)}.png`;
                    link.click();
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg"
                >
                  Download PNG
                </button>
              </div>
            </div>
          )}
        </LazyOutcomeCard>
      ))}
    </div>
  );
}