"use client";

import { useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { META_API_URL } from '../../lib/apiConfig';
import { BACKEND_UNAVAILABLE_MESSAGE } from '../../lib/apiClient';
import { downloadCSVFile, downloadXLSXFile } from '../../lib/exportUtils';
import { runSequentialBatch, type BatchProgress } from '../../lib/multiOutcome/batch';
import { readWorkbookRows } from '../../lib/multiOutcome/readWorkbookRows';
import { parseGradeFlatSheet } from '../../lib/grade/flatSheetParser';
import { downloadGradeSample } from '../../lib/grade/sampleTemplate';
import {
  blankGradeRow,
  INDIRECTNESS_OPTIONS,
  PUBLICATION_BIAS_OPTIONS,
  RISK_OF_BIAS_OPTIONS,
  STUDY_DESIGN_OPTIONS,
  type GradeExcludedOutcome,
  type GradeOutcomeInput,
  type GradeResultRow,
  type GradeRunState,
} from '../../lib/grade/types';

interface GradeRow {
  outcome: string;
  effect_ci: string;
  k: number;
  risk_of_bias: string;
  inconsistency: string;
  indirectness: string;
  imprecision: string;
  publication_bias: string;
  certainty: string;
}

export default function GradeTool() {
  const [outcome, setOutcome] = useState("All-cause mortality");
  const [effect, setEffect] = useState("RR 0.82 (0.71 to 0.95)");
  const [k, setK] = useState(12);
  const [n, setN] = useState(3450);
  const [i2, setI2] = useState(25);
  const [rob, setRob] = useState("Not serious");
  const [pubBias, setPubBias] = useState("Undetected");
  const [design, setDesign] = useState("RCT");
  
  const [result, setResult] = useState<GradeRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // --- Multi-outcome batch state ---
  const [batchRows, setBatchRows] = useState<GradeOutcomeInput[]>([]);
  const [batchExcluded, setBatchExcluded] = useState<GradeExcludedOutcome[]>([]);
  const [batchFatalErrors, setBatchFatalErrors] = useState<string[]>([]);
  const [batchFileName, setBatchFileName] = useState<string | null>(null);
  const [batchParsing, setBatchParsing] = useState(false);
  const [batchRunStates, setBatchRunStates] = useState<GradeRunState[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);

  async function handleBatchFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBatchParsing(true);
    setBatchFatalErrors([]);
    setBatchExcluded([]);
    try {
      const rows = await readWorkbookRows(file);
      const parsed = parseGradeFlatSheet(rows);
      setBatchFatalErrors(parsed.fatalErrors);
      setBatchExcluded(parsed.excluded);
      setBatchRows(parsed.rows);
      setBatchFileName(file.name);
      setBatchRunStates([]);
    } catch (err) {
      setBatchFatalErrors([err instanceof Error ? err.message : "Could not read this file."]);
    } finally {
      setBatchParsing(false);
      e.target.value = "";
    }
  }

  function addBatchRow() {
    setBatchRows((prev) => [...prev, blankGradeRow()]);
  }

  function removeBatchRow(index: number) {
    setBatchRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateBatchRow(index: number, patch: Partial<GradeOutcomeInput>) {
    setBatchRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  // Calls the SAME /api/grade/evaluate endpoint as the single-outcome
  // workflow above, once per outcome row, sequentially - one outcome's
  // failure (a network hiccup, a malformed response) never stops the rest
  // of the batch from being evaluated.
  async function runBatchEvaluate() {
    if (batchRows.length === 0) return;
    setBatchRunning(true);
    setBatchRunStates(batchRows.map((input) => ({ input, status: "pending" as const })));
    await runSequentialBatch(
      batchRows,
      (input) => input.outcome,
      async (input) => {
        try {
          const res = await fetch(`${META_API_URL}/api/grade/evaluate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              outcome: input.outcome,
              effect: input.effect,
              k: input.k,
              n: input.n,
              i2: input.i2,
              risk_of_bias: input.riskOfBias,
              publication_bias: input.publicationBias,
              study_design: input.design,
              indirectness_override: input.indirectnessOverride || null,
            }),
          });
          const text = await res.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch {
            return { input, status: "failed" as const, error: "The GRADE backend returned an invalid response for this outcome." };
          }
          if (data.status !== "success") {
            return { input, status: "failed" as const, error: data.message || "R Execution Error for this outcome." };
          }
          return { input, status: "success" as const, result: data.row as GradeResultRow };
        } catch {
          return { input, status: "failed" as const, error: BACKEND_UNAVAILABLE_MESSAGE };
        }
      },
      (progress) => {
        setBatchProgress(progress);
        // Reflect "running" on the item currently in flight so the table shows live status.
        setBatchRunStates((prev) => prev.map((s, i) => (i === progress.index ? { ...s, status: "running" } : s)));
      }
    ).then((results) => {
      setBatchRunStates(results);
    });
    setBatchRunning(false);
    setBatchProgress(null);
  }

  function exportBatchCSV() {
    const successRows = batchRunStates.filter((s): s is GradeRunState & { result: GradeResultRow } => s.status === "success" && !!s.result);
    downloadCSVFile(
      "grade-summary-of-findings.csv",
      ["Outcome", "Effect (95% CI)", "Participants (n)", "Studies (k)", "Risk of Bias", "Inconsistency", "Indirectness", "Imprecision", "Publication Bias", "Certainty"],
      successRows.map((s) => [s.result.outcome, s.result.effect_ci, s.result.n, s.result.k, s.result.risk_of_bias, s.result.inconsistency, s.result.indirectness, s.result.imprecision, s.result.publication_bias, s.result.certainty])
    );
  }

  function exportBatchXLSX() {
    const successRows = batchRunStates.filter((s): s is GradeRunState & { result: GradeResultRow } => s.status === "success" && !!s.result);
    downloadXLSXFile(
      "grade-summary-of-findings.xlsx",
      "Summary of Findings",
      ["Outcome", "Effect (95% CI)", "Participants (n)", "Studies (k)", "Risk of Bias", "Inconsistency", "Indirectness", "Imprecision", "Publication Bias", "Certainty"],
      successRows.map((s) => [s.result.outcome, s.result.effect_ci, s.result.n, s.result.k, s.result.risk_of_bias, s.result.inconsistency, s.result.indirectness, s.result.imprecision, s.result.publication_bias, s.result.certainty])
    );
  }

  const evaluateGrade = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${META_API_URL}/api/grade/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, effect, k, n, i2, risk_of_bias: rob, publication_bias: pubBias, study_design: design })
      });
      const data = await res.json();
      setResult(data.row);
    } catch {
      alert(BACKEND_UNAVAILABLE_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

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
            <h2 className="text-2xl font-bold text-white mb-4">GRADE Evidence Profile Assessor</h2>
            <p className="text-slate-300 text-sm leading-relaxed">Following official GRADE guidelines (Brozek et al., 2021), this tool automatically evaluates Inconsistency via I-squared thresholds, Imprecision based on sample size thresholds, and computes final evidence certainty ratings.</p>
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

        {/* Multi-outcome batch workflow */}
        <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 shadow-xl space-y-5 mb-8">
          <div>
            <h3 className="text-white font-semibold text-sm">Multi-Outcome Batch Assessment</h3>
            <p className="text-xs text-slate-400 mt-1">
              Manage several outcomes (e.g. Mortality, Major bleeding, Stroke, MI, Reintervention) in one project instead of
              running GRADE separately for each. Add rows manually, or upload a summary sheet with one row per outcome.
              Each outcome keeps its own domain judgments and certainty rating - GRADE decisions are never guessed
              automatically, only the deterministic parts (inconsistency/imprecision thresholds, final certainty
              arithmetic) are calculated by the same R rules as the single-outcome tool above.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <button type="button" onClick={downloadGradeSample} className="px-4 py-2 bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 rounded-lg text-xs font-medium">
              Download Sample Template
            </button>
            <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg cursor-pointer">
              {batchParsing ? "Reading…" : "Upload Summary Sheet"}
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleBatchFile} className="hidden" disabled={batchParsing} />
            </label>
            <button type="button" onClick={addBatchRow} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded-lg">
              + Add Outcome Row
            </button>
            {batchFileName && <span className="text-xs text-slate-500">{batchFileName}</span>}
          </div>

          {batchFatalErrors.length > 0 && (
            <div className="bg-red-950/80 border border-red-500/80 text-red-200 p-4 rounded-xl text-xs space-y-1">
              {batchFatalErrors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}

          {batchExcluded.length > 0 && (
            <div className="bg-amber-950/40 border border-amber-600/50 text-amber-300 p-4 rounded-xl text-xs space-y-1">
              <p className="font-semibold">Excluded from this batch:</p>
              {batchExcluded.map((ex, i) => <p key={i}>⚠ {ex.outcome}: {ex.reason}</p>)}
            </div>
          )}

          {batchRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead>
                  <tr className="text-slate-500 uppercase bg-black/40">
                    <th className="p-2">Outcome</th>
                    <th className="p-2">Effect (95% CI)</th>
                    <th className="p-2">Design</th>
                    <th className="p-2">k</th>
                    <th className="p-2">n</th>
                    <th className="p-2">I² %</th>
                    <th className="p-2">Risk of Bias</th>
                    <th className="p-2">Indirectness</th>
                    <th className="p-2">Publication Bias</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {batchRows.map((row, i) => (
                    <tr key={i}>
                      <td className="p-1"><input type="text" value={row.outcome} onChange={(e) => updateBatchRow(i, { outcome: e.target.value })} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1 w-32 text-white" /></td>
                      <td className="p-1"><input type="text" value={row.effect} onChange={(e) => updateBatchRow(i, { effect: e.target.value })} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1 w-40 text-white" /></td>
                      <td className="p-1">
                        <select value={row.design} onChange={(e) => updateBatchRow(i, { design: e.target.value as GradeOutcomeInput["design"] })} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1 text-white">
                          {STUDY_DESIGN_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="p-1"><input type="number" value={row.k ?? ""} onChange={(e) => updateBatchRow(i, { k: e.target.value === "" ? null : Number(e.target.value) })} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1 w-16 text-white" /></td>
                      <td className="p-1"><input type="number" value={row.n ?? ""} onChange={(e) => updateBatchRow(i, { n: e.target.value === "" ? null : Number(e.target.value) })} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1 w-20 text-white" /></td>
                      <td className="p-1"><input type="number" value={row.i2 ?? ""} onChange={(e) => updateBatchRow(i, { i2: e.target.value === "" ? null : Number(e.target.value) })} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1 w-16 text-white" /></td>
                      <td className="p-1">
                        <select value={row.riskOfBias} onChange={(e) => updateBatchRow(i, { riskOfBias: e.target.value as GradeOutcomeInput["riskOfBias"] })} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1 text-white">
                          {RISK_OF_BIAS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="p-1">
                        <select value={row.indirectnessOverride} onChange={(e) => updateBatchRow(i, { indirectnessOverride: e.target.value as GradeOutcomeInput["indirectnessOverride"] })} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1 text-white">
                          <option value="">Auto (Not serious)</option>
                          {INDIRECTNESS_OPTIONS.filter((o) => o !== "").map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="p-1">
                        <select value={row.publicationBias} onChange={(e) => updateBatchRow(i, { publicationBias: e.target.value as GradeOutcomeInput["publicationBias"] })} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1 text-white">
                          {PUBLICATION_BIAS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="p-1"><button type="button" onClick={() => removeBatchRow(i)} className="text-red-400 hover:text-red-300 px-2">✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {batchRows.length > 0 && (
            <button
              type="button"
              onClick={runBatchEvaluate}
              disabled={batchRunning}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl shadow-lg transition"
            >
              {batchRunning ? "Evaluating…" : `Evaluate All Outcomes (${batchRows.length})`}
            </button>
          )}

          {batchRunning && batchProgress && (
            <p className="text-xs text-indigo-300">Evaluating outcome {batchProgress.index + 1} of {batchProgress.total}: {batchProgress.label}</p>
          )}

          {batchRunStates.length > 0 && (
            <div className="pt-4 border-t border-slate-800 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h4 className="text-white font-semibold text-sm">
                  Summary of Findings ({batchRunStates.filter((s) => s.status === "success").length} of {batchRunStates.length} completed)
                </h4>
                {batchRunStates.some((s) => s.status === "success") && (
                  <div className="flex gap-2">
                    <button type="button" onClick={exportBatchCSV} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg">Export CSV</button>
                    <button type="button" onClick={exportBatchXLSX} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg">Export XLSX</button>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 uppercase bg-black/40">
                      <th className="p-2">Outcome</th><th className="p-2">Effect (95% CI)</th><th className="p-2">n</th><th className="p-2">k</th>
                      <th className="p-2">Risk of Bias</th><th className="p-2">Inconsistency</th><th className="p-2">Indirectness</th><th className="p-2">Imprecision</th>
                      <th className="p-2">Publication Bias</th><th className="p-2">Certainty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchRunStates.map((s, i) => (
                      <tr key={i} className="border-b border-slate-800 bg-[#0b0c10]">
                        {s.status === "success" && s.result ? (
                          <>
                            <td className="p-2 font-semibold text-white">{s.result.outcome}</td>
                            <td className="p-2">{s.result.effect_ci}</td>
                            <td className="p-2">{s.result.n}</td>
                            <td className="p-2">{s.result.k}</td>
                            <td className="p-2">{s.result.risk_of_bias}</td>
                            <td className="p-2">{s.result.inconsistency}</td>
                            <td className="p-2">{s.result.indirectness}</td>
                            <td className="p-2">{s.result.imprecision}</td>
                            <td className="p-2">{s.result.publication_bias}</td>
                            <td className="p-2 font-bold text-emerald-400">{s.result.certainty}</td>
                          </>
                        ) : s.status === "failed" ? (
                          <td className="p-2 text-red-400" colSpan={10}>✗ {s.input.outcome}: {s.error}</td>
                        ) : (
                          <td className="p-2 text-slate-500" colSpan={10}>{s.status === "running" ? "⏳" : "○"} {s.input.outcome}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Single-Outcome Quick Assessment</h2>
            <p className="text-slate-400 text-sm">Automated certainty rating following Brozek et al., 2021 guidelines.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 bg-[#0b0c10] p-6 rounded-2xl border border-slate-800">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Outcome Name:</label>
              <input type="text" value={outcome} onChange={e => setOutcome(e.target.value)} className="w-full bg-[#151722] border border-slate-800 rounded-lg p-2.5 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Effect Estimate (95% CI):</label>
              <input type="text" value={effect} onChange={e => setEffect(e.target.value)} className="w-full bg-[#151722] border border-slate-800 rounded-lg p-2.5 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Study Design:</label>
              <select value={design} onChange={e => setDesign(e.target.value)} className="w-full bg-[#151722] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                <option value="RCT">RCT (Starts at High)</option>
                <option value="Observational">Observational (Starts at Low)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Number of Studies (k):</label>
              <input type="number" value={k} onChange={e => setK(Number(e.target.value))} className="w-full bg-[#151722] border border-slate-800 rounded-lg p-2.5 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Total Sample Size (n):</label>
              <input type="number" value={n} onChange={e => setN(Number(e.target.value))} className="w-full bg-[#151722] border border-slate-800 rounded-lg p-2.5 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Heterogeneity (I² %):</label>
              <input type="number" value={i2} onChange={e => setI2(Number(e.target.value))} className="w-full bg-[#151722] border border-slate-800 rounded-lg p-2.5 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Risk of Bias:</label>
              <select value={rob} onChange={e => setRob(e.target.value)} className="w-full bg-[#151722] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                <option value="Not serious">Not serious</option>
                <option value="Serious">Serious (-1)</option>
                <option value="Very serious">Very serious (-2)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Publication Bias:</label>
              <select value={pubBias} onChange={e => setPubBias(e.target.value)} className="w-full bg-[#151722] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                <option value="Undetected">Undetected</option>
                <option value="Suspected">Suspected (-1)</option>
              </select>
            </div>
          </div>

          <button onClick={evaluateGrade} disabled={loading} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg transition">
            {loading ? "Evaluating GRADE Rules..." : "Generate GRADE Evidence Profile"}
          </button>

          {result && (
            <div className="pt-6 border-t border-slate-800 space-y-6">
              <h3 className="text-xl font-bold text-white">GRADE Evidence Profile Table</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 uppercase text-xs bg-black/40">
                      <th className="p-3">Outcome</th>
                      <th className="p-3">Effect (95% CI)</th>
                      <th className="p-3">k</th>
                      <th className="p-3">Risk of Bias</th>
                      <th className="p-3">Inconsistency</th>
                      <th className="p-3">Indirectness</th>
                      <th className="p-3">Imprecision</th>
                      <th className="p-3">Publication Bias</th>
                      <th className="p-3">Certainty</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-800 bg-[#0b0c10]">
                      <td className="p-3 font-semibold text-white">{result.outcome}</td>
                      <td className="p-3">{result.effect_ci}</td>
                      <td className="p-3">{result.k}</td>
                      <td className="p-3">{result.risk_of_bias}</td>
                      <td className="p-3">{result.inconsistency}</td>
                      <td className="p-3">{result.indirectness}</td>
                      <td className="p-3">{result.imprecision}</td>
                      <td className="p-3">{result.publication_bias}</td>
                      <td className="p-3 font-bold text-emerald-400">{result.certainty}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}