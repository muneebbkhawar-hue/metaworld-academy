"use client";

import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import type { DTAResult } from '../../types/statistics';
import { DTA_API_URL } from '../../lib/apiConfig';
import { BACKEND_UNAVAILABLE_MESSAGE } from '../../lib/apiClient';
import { downloadCSVFile, downloadXLSXFile } from '../../lib/exportUtils';
import { parseDTARows, validateDTARows } from './lib/validation';
import { downloadDTASampleCSV, downloadDTASampleXLSX } from './lib/sampleTemplate';
import type { DTARawRow } from './lib/types';

// Diagnostic Test Accuracy Meta-Analysis. Talks to a DEDICATED R Plumber
// process (dta-api.R) on its own port (8006) - entirely separate from every
// other backend in this app, same one-script-per-tool convention as
// tsa-api.R / metareg-api.R. Statistical calculations (bivariate model via
// mada::reitsma(), univariate DOR/LR pooling via metafor::rma()) happen
// ENTIRELY in R - this file only uploads, validates formatting, displays,
// and exports. See dta-api.R's header comment for the full methodology.
const DTA_API = `${DTA_API_URL}/api/dta/analyze`;

type TabKey = "overview" | "study" | "sensitivity" | "specificity" | "bivariate" | "sroc" | "dor" | "lr" | "plots" | "export";

function pct(v: number | null | undefined, digits = 1): string {
  return v === null || v === undefined || Number.isNaN(v) ? "n/a" : `${(v * 100).toFixed(digits)}%`;
}
function num(v: number | null | undefined, digits = 2): string {
  return v === null || v === undefined || Number.isNaN(v) ? "n/a" : v.toFixed(digits);
}
function ci(lo: number | null | undefined, hi: number | null | undefined, fmt: (v: number | null | undefined) => string): string {
  return lo === null || lo === undefined || Number.isNaN(lo) ? "n/a" : `${fmt(lo)} – ${fmt(hi)}`;
}

export default function DiagnosticAccuracyTool() {
  const [rawRows, setRawRows] = useState<DTARawRow[]>([]);
  const [pasteData, setPasteData] = useState("");
  const [parseError, setParseError] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [ciLevel, setCiLevel] = useState("95");

  const [results, setResults] = useState<DTAResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const { eligible, excluded } = useMemo(() => validateDTARows(rawRows), [rawRows]);

  function loadRows(headerRow: unknown[], dataRows: unknown[][]) {
    const parsed = parseDTARows(headerRow, dataRows);
    if (parsed.length === 0) { setParseError("No studies could be read from this file. Check that the first row is a header row and data starts on row 2, with columns Study_ID, TP, FP, FN, TN in that order."); return; }
    setParseError("");
    setRawRows(parsed);
    setResults(null);
  }

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isXlsx = /\.xlsx?$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let headerRow: unknown[], dataRows: unknown[][];
        if (isXlsx) {
          const wb = XLSX.read(event.target?.result, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
          headerRow = rows[0] || [];
          dataRows = rows.slice(1).filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
        } else {
          const text = String(event.target?.result ?? "");
          const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
          headerRow = (lines[0] ?? "").split(",");
          dataRows = lines.slice(1).map((l) => l.split(",").map((c) => c.replace(/['"]+/g, "").trim()));
        }
        loadRows(headerRow, dataRows);
        setFileName(file.name);
      } catch (err) {
        setParseError("Could not parse this file: " + (err instanceof Error ? err.message : String(err)) + ". If this is a genuine Excel/CSV export, check it isn't corrupted or password-protected.");
      }
    };
    if (isXlsx) reader.readAsArrayBuffer(file); else reader.readAsText(file);
    e.target.value = "";
  };

  const importPaste = () => {
    if (!pasteData.trim()) return;
    const lines = pasteData.trim().split(/\r?\n/);
    const headerRow = (lines[0] ?? "").split("\t");
    const dataRows = lines.slice(1).map((l) => l.split("\t"));
    loadRows(headerRow, dataRows);
    setPasteData("");
  };

  const runAnalysis = async () => {
    if (eligible.length < 2) return;
    setLoading(true);
    setResults(null);
    setErrorMessage("");
    setActiveTab("overview");
    try {
      const payload = {
        studies: eligible.map((r) => ({ study: r.study, tp: r.tp, fp: r.fp, fn: r.fn, tn: r.tn })),
        config: { ci_level: parseFloat(ciLevel) },
      };
      const res = await fetch(DTA_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { setErrorMessage("Fatal Error: the diagnostic meta-analysis R Plumber service returned an invalid response. Check the R console for crashes."); setLoading(false); return; }
      if (data.status === "success") setResults(data);
      else setErrorMessage(`R Execution Error: ${data.message || "Unknown error occurred inside R."}`);
    } catch {
      setErrorMessage(BACKEND_UNAVAILABLE_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  const downloadPNG = (base64: string, filename: string) => {
    const link = document.createElement("a");
    link.href = base64;
    link.download = filename;
    link.click();
  };

  const availableTabs: { key: TabKey; label: string }[] = results ? [
    { key: "overview", label: "Overview" },
    { key: "study", label: "Study-Level Data" },
    { key: "sensitivity", label: "Sensitivity" },
    { key: "specificity", label: "Specificity" },
    { key: "bivariate", label: "Bivariate Model" },
    ...(results.sroc.available ? [{ key: "sroc" as TabKey, label: "SROC" }] : []),
    { key: "dor", label: "Diagnostic Odds Ratio" },
    { key: "lr", label: "Likelihood Ratios" },
    { key: "plots", label: "Forest Plots" },
    { key: "export", label: "Export" },
  ] : [];

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
            <h1 className="text-3xl font-bold text-white mb-2">Diagnostic Test Accuracy Meta-Analysis</h1>
            <p className="text-slate-400 text-sm max-w-3xl">
              Bivariate random-effects meta-analysis of sensitivity and specificity (Reitsma et al., 2005), an SROC curve, and pooled
              diagnostic odds ratio / likelihood ratios, computed via the R <code>mada</code> and <code>metafor</code> packages from
              study-level 2×2 diagnostic tables (TP, FP, FN, TN).
            </p>
          </div>

          <div className="bg-sky-950/30 border border-sky-600/40 rounded-xl p-4 text-xs text-sky-200">
            ℹ️ Diagnostic meta-analysis results should be interpreted in the context of study design, reference standards, thresholds, spectrum of disease, and risk of bias.
          </div>

          <MethodologyPanel />

          {errorMessage && <div className="bg-red-950/80 border border-red-500/80 text-red-200 p-5 rounded-xl text-sm font-mono shadow-lg">{errorMessage}</div>}

          {/* Upload */}
          <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-start flex-wrap gap-3">
              <h3 className="text-white font-semibold text-sm">Upload diagnostic accuracy data (CSV / XLSX)</h3>
              <div className="flex gap-2 flex-wrap">
                <button onClick={downloadDTASampleCSV} className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded-lg whitespace-nowrap">Download Sample CSV</button>
                <button onClick={downloadDTASampleXLSX} className="px-4 py-1.5 bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 text-xs font-medium rounded-lg whitespace-nowrap">Download Sample XLSX</button>
              </div>
            </div>
            <p className="text-slate-500 text-xs">
              Columns (by position): <strong className="text-slate-400">Study_ID, TP, FP, FN, TN</strong> - one row per study, one 2×2 table per row.
              Optional columns (Author, Year, Reference_Standard, Population, Setting, etc.) may follow and are not required.
              Recognized missing-data tokens: NA, N/A, NR, &quot;not reported&quot;, &quot;not available&quot;, blank, &quot;-&quot; - a study missing
              a required value is excluded from the analysis with the reason shown, never treated as zero.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-900/40 file:text-indigo-300 cursor-pointer" />
              <div>
                <textarea rows={2} value={pasteData} onChange={(e) => setPasteData(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2 text-xs text-slate-200 mb-2" placeholder="Paste tab-separated rows, first row = header" />
                <button onClick={importPaste} className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg">Import Pasted Data</button>
              </div>
            </div>
            {fileName && <p className="text-xs text-slate-500">{fileName}</p>}
            {parseError && <div className="text-red-400 text-xs">{parseError}</div>}
          </div>

          {/* Validation preview */}
          {rawRows.length > 0 && (
            <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 space-y-4">
              <h3 className="text-white font-semibold text-sm">Data Validation</h3>
              <p className="text-xs text-slate-400">
                {rawRows.length} study(ies) detected · <span className="text-emerald-400">{eligible.length} eligible</span>
                {excluded.length > 0 && <> · <span className="text-amber-400">{excluded.length} excluded</span></>}
              </p>
              {excluded.length > 0 && (
                <div className="bg-amber-950/40 border border-amber-600/50 rounded-xl p-4 text-xs text-amber-300 space-y-1">
                  {excluded.map((ex, i) => <p key={i}>⚠ Study &quot;{ex.study}&quot; excluded: {ex.reason}</p>)}
                </div>
              )}
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="text-slate-500 uppercase sticky top-0 bg-[#151722]">
                    <tr><th className="pb-2 pr-3">Study ID</th><th className="pb-2 pr-3">TP</th><th className="pb-2 pr-3">FP</th><th className="pb-2 pr-3">FN</th><th className="pb-2 pr-3">TN</th><th className="pb-2 pr-3">Total</th><th className="pb-2 pr-3">Sensitivity</th><th className="pb-2 pr-3">Specificity</th><th className="pb-2 pr-3">PPV</th><th className="pb-2 pr-3">NPV</th><th className="pb-2 pr-3">DOR</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {eligible.map((r) => {
                      const total = r.tp + r.fp + r.fn + r.tn;
                      const sens = r.tp / (r.tp + r.fn); const spec = r.tn / (r.tn + r.fp);
                      const ppv = r.tp / (r.tp + r.fp); const npv = r.tn / (r.tn + r.fn);
                      const dor = r.fp > 0 && r.fn > 0 && r.tp > 0 && r.tn > 0 ? (r.tp * r.tn) / (r.fp * r.fn) : NaN;
                      return (
                        <tr key={r._rowIndex}>
                          <td className="py-1.5 pr-3 text-white">{r.study}</td>
                          <td className="py-1.5 pr-3">{r.tp}</td><td className="py-1.5 pr-3">{r.fp}</td><td className="py-1.5 pr-3">{r.fn}</td><td className="py-1.5 pr-3">{r.tn}</td>
                          <td className="py-1.5 pr-3">{total}</td>
                          <td className="py-1.5 pr-3">{pct(sens)}</td><td className="py-1.5 pr-3">{pct(spec)}</td>
                          <td className="py-1.5 pr-3">{pct(ppv)}</td><td className="py-1.5 pr-3">{pct(npv)}</td>
                          <td className="py-1.5 pr-3">{Number.isNaN(dor) ? "n/a (zero cell)" : dor.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Settings */}
          {rawRows.length > 0 && (
            <div className="bg-[#151722] border border-indigo-900/30 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-lg font-bold text-white">Analysis Settings</h3>
              <div className="max-w-xs">
                <label className="block text-xs text-slate-400 mb-1">Confidence level:</label>
                <select value={ciLevel} onChange={(e) => setCiLevel(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                  <option value="90">90%</option><option value="95">95%</option><option value="99">99%</option>
                </select>
              </div>
            </div>
          )}

          {rawRows.length > 0 && (
            <button
              onClick={runAnalysis}
              disabled={loading || eligible.length < 2}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl shadow-lg transition"
            >
              {loading ? "RUNNING DIAGNOSTIC META-ANALYSIS..." : "RUN DIAGNOSTIC META-ANALYSIS"}
            </button>
          )}
          {rawRows.length > 0 && eligible.length < 2 && (
            <p className="text-xs text-amber-400">At least 2 eligible studies with complete TP/FP/FN/TN data are required to run the analysis.</p>
          )}

          {/* Results */}
          {results && (
            <div className="space-y-6">
              <div className="flex gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
                {availableTabs.map((t) => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)} className={`px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition ${activeTab === t.key ? "bg-indigo-600 text-white" : "text-slate-400 bg-[#151722] hover:text-slate-200"}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              {activeTab === "overview" && <OverviewTab results={results} />}
              {activeTab === "study" && <StudyLevelTab results={results} />}
              {activeTab === "sensitivity" && <SensSpecTab results={results} which="sensitivity" />}
              {activeTab === "specificity" && <SensSpecTab results={results} which="specificity" />}
              {activeTab === "bivariate" && <BivariateTab results={results} />}
              {activeTab === "sroc" && results.sroc.available && <SrocTab results={results} downloadPNG={downloadPNG} />}
              {activeTab === "dor" && <DorTab results={results} downloadPNG={downloadPNG} />}
              {activeTab === "lr" && <LrTab results={results} />}
              {activeTab === "plots" && <PlotsTab results={results} downloadPNG={downloadPNG} />}
              {activeTab === "export" && <ExportTab results={results} downloadPNG={downloadPNG} />}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="bg-[#0b0c10] p-4 rounded-xl border border-slate-800">
      <span className="text-xs text-slate-500 block mb-1">{label}</span>
      <span className="text-lg font-bold text-white">{value}</span>
    </div>
  );
}

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl space-y-4">
      {title && <h3 className="text-xl font-bold text-white">{title}</h3>}
      {children}
    </div>
  );
}

function MethodologyPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full text-left px-6 py-4 text-sm font-semibold text-white flex items-center justify-between">
        Methodology &amp; Interpretation <span className="text-slate-500 text-xs">{open ? "▾ Hide" : "▸ Show"}</span>
      </button>
      {open && (
        <div className="px-6 pb-6 text-xs text-slate-400 space-y-2 leading-relaxed">
          <p><strong className="text-slate-300">Sensitivity</strong> is the proportion of people WITH the target condition who test positive (TP / (TP+FN)).</p>
          <p><strong className="text-slate-300">Specificity</strong> is the proportion of people WITHOUT the condition who test negative (TN / (TN+FP)).</p>
          <p><strong className="text-slate-300">Positive Likelihood Ratio (LR+)</strong> = sensitivity / (1 − specificity) - how much a positive result increases the odds of disease.</p>
          <p><strong className="text-slate-300">Negative Likelihood Ratio (LR−)</strong> = (1 − sensitivity) / specificity - how much a negative result decreases the odds of disease.</p>
          <p><strong className="text-slate-300">Diagnostic Odds Ratio (DOR)</strong> = (TP×TN) / (FP×FN) - a single summary of overall discriminative ability; not sensitive/specific to threshold like sensitivity or specificity alone.</p>
          <p><strong className="text-slate-300">Bivariate model</strong> (Reitsma et al. 2005) jointly models the logit-transformed sensitivity and false positive rate across studies, explicitly accounting for their typical negative correlation - the statistically correct way to pool sensitivity and specificity together, unlike pooling each independently.</p>
          <p><strong className="text-slate-300">SROC curve</strong> is the Summary Receiver Operating Characteristic curve implied by the fitted bivariate model, showing the sensitivity/specificity trade-off across studies/thresholds.</p>
          <p><strong className="text-slate-300">Confidence region</strong> reflects uncertainty in the pooled summary point. A <strong className="text-slate-300">prediction region</strong>, where available, reflects the expected range for a single NEW study - always wider than the confidence region.</p>
          <p className="pt-2 border-t border-slate-800 text-slate-300">Diagnostic meta-analysis results should be interpreted in the context of study design, reference standards, thresholds, spectrum of disease, and risk of bias.</p>
        </div>
      )}
    </div>
  );
}

function OverviewTab({ results }: { results: DTAResult }) {
  const b = results.bivariate;
  return (
    <Card title="Overview">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Studies Included" value={results.data_summary.n_studies_included} />
        <Stat label="Studies Excluded" value={results.data_summary.n_studies_excluded} />
        <Stat label="Total Participants" value={results.data_summary.total_participants} />
        <Stat label="Confidence Level" value={`${results.settings_used.ci_level}%`} />
        {b.available && <Stat label="Pooled Sensitivity" value={pct(b.pooled_sensitivity)} />}
        {b.available && <Stat label="Pooled Specificity" value={pct(b.pooled_specificity)} />}
        {results.univariate_pooled.dor.available && <Stat label="Pooled DOR" value={num(results.univariate_pooled.dor.estimate)} />}
      </div>
      {results.data_summary.excluded_studies.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-600/50 rounded-lg p-4 text-xs text-amber-300 space-y-1">
          {results.data_summary.excluded_studies.map((ex, i) => <p key={i}>⚠ {ex.study}: {ex.reason}</p>)}
        </div>
      )}
      {results.warnings.length > 0 && (
        <div className="bg-amber-950/20 border border-amber-600/30 rounded-lg p-4 text-xs text-amber-200 space-y-1">
          {results.warnings.map((w, i) => <p key={i}>ℹ️ {w}</p>)}
        </div>
      )}
      <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-4 text-sm text-slate-200">{results.interpretation}</div>
      <div className="bg-[#0b0c10] border border-slate-800 rounded-lg p-4 text-xs text-slate-400 space-y-1">
        <p className="text-slate-300 font-semibold mb-1">Analysis Settings (reproducibility)</p>
        <p>Bivariate model: {results.settings_used.bivariate_model} — {results.settings_used.bivariate_package} {results.settings_used.bivariate_package_version}, <code>{results.settings_used.bivariate_r_function}</code></p>
        <p>DOR/LR pooling: {results.settings_used.univariate_pooling_package} {results.settings_used.univariate_pooling_package_version}, <code>{results.settings_used.univariate_pooling_r_function}</code></p>
        <p>Continuity correction: {results.settings_used.continuity_correction.value} — {results.settings_used.continuity_correction.scope}
          {results.settings_used.continuity_correction.studies_affected.length > 0 && ` (studies: ${results.settings_used.continuity_correction.studies_affected.join(", ")})`}
        </p>
      </div>
    </Card>
  );
}

function StudyLevelTab({ results }: { results: DTAResult }) {
  return (
    <Card title="Study-Level Data">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300 border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500 uppercase bg-black/40">
              <th className="p-2">Study</th><th className="p-2">TP</th><th className="p-2">FP</th><th className="p-2">FN</th><th className="p-2">TN</th>
              <th className="p-2">Sensitivity (CI)</th><th className="p-2">Specificity (CI)</th><th className="p-2">PPV</th><th className="p-2">NPV</th>
              <th className="p-2">LR+</th><th className="p-2">LR−</th><th className="p-2">DOR</th>
            </tr>
          </thead>
          <tbody>
            {results.study_results.map((s, i) => (
              <tr key={i} className="border-b border-slate-800 bg-[#0b0c10]">
                <td className="p-2 font-semibold text-white">{s.study}{s.has_zero_cell && <span className="text-amber-400 ml-1" title="Contains a zero cell">⚠</span>}</td>
                <td className="p-2">{s.tp}</td><td className="p-2">{s.fp}</td><td className="p-2">{s.fn}</td><td className="p-2">{s.tn}</td>
                <td className="p-2">{pct(s.sensitivity)} <span className="text-slate-500">({ci(s.sensitivity_ci_lower, s.sensitivity_ci_upper, pct)})</span></td>
                <td className="p-2">{pct(s.specificity)} <span className="text-slate-500">({ci(s.specificity_ci_lower, s.specificity_ci_upper, pct)})</span></td>
                <td className="p-2">{pct(s.ppv)}</td><td className="p-2">{pct(s.npv)}</td>
                <td className="p-2">{num(s.lr_pos)}</td><td className="p-2">{num(s.lr_neg)}</td>
                <td className="p-2">{num(s.dor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-500">⚠ = study contains at least one zero cell; DOR/LR are not computable on the log scale for that study and shown as n/a.</p>
    </Card>
  );
}

function SensSpecTab({ results, which }: { results: DTAResult; which: "sensitivity" | "specificity" }) {
  const b = results.bivariate;
  const pooled = which === "sensitivity" ? b.pooled_sensitivity : b.pooled_specificity;
  const lo = which === "sensitivity" ? b.pooled_sensitivity_ci_lower : b.pooled_specificity_ci_lower;
  const hi = which === "sensitivity" ? b.pooled_sensitivity_ci_upper : b.pooled_specificity_ci_upper;
  const plot = which === "sensitivity" ? results.forest_plots.sensitivity_base64 : results.forest_plots.specificity_base64;
  return (
    <Card title={which === "sensitivity" ? "Sensitivity" : "Specificity"}>
      {b.available ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Stat label={`Pooled ${which === "sensitivity" ? "Sensitivity" : "Specificity"}`} value={pct(pooled)} />
          <Stat label="95% CI" value={ci(lo, hi, pct)} />
          <Stat label="Source" value="Bivariate model" />
        </div>
      ) : (
        <p className="text-xs text-amber-400">Pooled {which} not available: {b.note}</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300 border-collapse">
          <thead><tr className="border-b border-slate-800 text-slate-500 uppercase bg-black/40"><th className="p-2">Study</th><th className="p-2">{which === "sensitivity" ? "Sensitivity" : "Specificity"}</th><th className="p-2">95% CI</th></tr></thead>
          <tbody>
            {results.study_results.map((s, i) => (
              <tr key={i} className="border-b border-slate-800 bg-[#0b0c10]">
                <td className="p-2 text-white">{s.study}</td>
                <td className="p-2">{pct(which === "sensitivity" ? s.sensitivity : s.specificity)}</td>
                <td className="p-2">{ci(which === "sensitivity" ? s.sensitivity_ci_lower : s.specificity_ci_lower, which === "sensitivity" ? s.sensitivity_ci_upper : s.specificity_ci_upper, pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-white p-4 rounded-xl flex flex-col items-center overflow-x-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={plot} alt={`${which} forest plot`} className="max-w-none" style={{ height: "480px" }} />
      </div>
    </Card>
  );
}

function BivariateTab({ results }: { results: DTAResult }) {
  const b = results.bivariate;
  if (!b.available) {
    return <Card title="Bivariate Model"><p className="text-sm text-amber-400">{b.note}</p></Card>;
  }
  return (
    <Card title="Bivariate Model (Reitsma et al. 2005)">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Studies" value={b.n_studies ?? null} />
        <Stat label="Participants" value={b.n_participants ?? null} />
        <Stat label="Pooled Sensitivity" value={pct(b.pooled_sensitivity)} />
        <Stat label="Sensitivity 95% CI" value={ci(b.pooled_sensitivity_ci_lower, b.pooled_sensitivity_ci_upper, pct)} />
        <Stat label="Pooled Specificity" value={pct(b.pooled_specificity)} />
        <Stat label="Specificity 95% CI" value={ci(b.pooled_specificity_ci_lower, b.pooled_specificity_ci_upper, pct)} />
        <Stat label="Sens/Spec Correlation (logit scale)" value={b.correlation != null ? b.correlation.toFixed(3) : "n/a"} />
      </div>
      <p className="text-xs text-slate-500">
        The correlation reflects the estimated between-study association of logit-sensitivity and logit-false-positive-rate - typically
        negative (higher sensitivity thresholds tend to come with lower specificity), a key reason sensitivity and specificity cannot be
        pooled independently.
      </p>
    </Card>
  );
}

function SrocTab({ results, downloadPNG }: { results: DTAResult; downloadPNG: (b64: string, name: string) => void }) {
  const s = results.sroc;
  if (!s.available || !s.plot_base64) return null;
  return (
    <Card title="SROC Curve">
      <p className="text-xs text-slate-400">{s.note}</p>
      <div className="flex gap-2 text-xs">
        <span className={`px-2 py-1 rounded-md border ${s.confidence_region_available ? "border-emerald-600/50 text-emerald-400" : "border-slate-700 text-slate-500"}`}>
          {s.confidence_region_available ? "✓ 95% confidence region shown" : "Confidence region not available"}
        </span>
        <span className={`px-2 py-1 rounded-md border ${s.prediction_region_available ? "border-emerald-600/50 text-emerald-400" : "border-slate-700 text-slate-500"}`}>
          {s.prediction_region_available ? "✓ 95% prediction region shown" : "Prediction region not available"}
        </span>
      </div>
      <div className="bg-white p-4 rounded-xl flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={s.plot_base64} alt="SROC curve" className="w-full max-w-xl" />
        <button onClick={() => downloadPNG(s.plot_base64!, "sroc_curve.png")} className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg">Download PNG</button>
      </div>
    </Card>
  );
}

function DorTab({ results, downloadPNG }: { results: DTAResult; downloadPNG: (b64: string, name: string) => void }) {
  const p = results.univariate_pooled.dor;
  return (
    <Card title="Diagnostic Odds Ratio">
      {p.available ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Pooled DOR" value={num(p.estimate)} />
          <Stat label="95% CI" value={ci(p.ci_lower, p.ci_upper, (v) => num(v))} />
          <Stat label="Tau²" value={p.tau2 != null ? p.tau2.toFixed(4) : "n/a"} />
          <Stat label="I²" value={p.i2 != null ? `${p.i2}%` : "n/a"} />
        </div>
      ) : <p className="text-xs text-amber-400">{p.note}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300 border-collapse">
          <thead><tr className="border-b border-slate-800 text-slate-500 uppercase bg-black/40"><th className="p-2">Study</th><th className="p-2">DOR</th><th className="p-2">95% CI</th></tr></thead>
          <tbody>
            {results.study_results.map((s, i) => (
              <tr key={i} className="border-b border-slate-800 bg-[#0b0c10]">
                <td className="p-2 text-white">{s.study}</td><td className="p-2">{num(s.dor)}</td><td className="p-2">{ci(s.dor_ci_lower, s.dor_ci_upper, (v) => num(v))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-white p-4 rounded-xl flex flex-col items-center overflow-x-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={results.forest_plots.dor_base64} alt="DOR forest plot" className="max-w-none" style={{ height: "480px" }} />
        <button onClick={() => downloadPNG(results.forest_plots.dor_base64, "dor_forest_plot.png")} className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg">Download PNG</button>
      </div>
    </Card>
  );
}

function LrTab({ results }: { results: DTAResult }) {
  const pp = results.univariate_pooled.lr_pos; const pn = results.univariate_pooled.lr_neg;
  return (
    <Card title="Likelihood Ratios">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-[#0b0c10] border border-slate-800 rounded-xl p-4">
          <h4 className="text-white font-semibold text-xs mb-2">Positive Likelihood Ratio (LR+)</h4>
          {pp.available ? <p className="text-sm text-slate-300">Pooled: {num(pp.estimate)} ({ci(pp.ci_lower, pp.ci_upper, (v) => num(v))})</p> : <p className="text-xs text-amber-400">{pp.note}</p>}
        </div>
        <div className="bg-[#0b0c10] border border-slate-800 rounded-xl p-4">
          <h4 className="text-white font-semibold text-xs mb-2">Negative Likelihood Ratio (LR−)</h4>
          {pn.available ? <p className="text-sm text-slate-300">Pooled: {num(pn.estimate)} ({ci(pn.ci_lower, pn.ci_upper, (v) => num(v))})</p> : <p className="text-xs text-amber-400">{pn.note}</p>}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300 border-collapse">
          <thead><tr className="border-b border-slate-800 text-slate-500 uppercase bg-black/40"><th className="p-2">Study</th><th className="p-2">LR+</th><th className="p-2">95% CI</th><th className="p-2">LR−</th><th className="p-2">95% CI</th></tr></thead>
          <tbody>
            {results.study_results.map((s, i) => (
              <tr key={i} className="border-b border-slate-800 bg-[#0b0c10]">
                <td className="p-2 text-white">{s.study}</td>
                <td className="p-2">{num(s.lr_pos)}</td><td className="p-2">{ci(s.lr_pos_ci_lower, s.lr_pos_ci_upper, (v) => num(v))}</td>
                <td className="p-2">{num(s.lr_neg)}</td><td className="p-2">{ci(s.lr_neg_ci_lower, s.lr_neg_ci_upper, (v) => num(v))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PlotsTab({ results, downloadPNG }: { results: DTAResult; downloadPNG: (b64: string, name: string) => void }) {
  const plots: { key: string; label: string; base64: string }[] = [
    { key: "sens", label: "Sensitivity Forest Plot", base64: results.forest_plots.sensitivity_base64 },
    { key: "spec", label: "Specificity Forest Plot", base64: results.forest_plots.specificity_base64 },
    { key: "dor", label: "Diagnostic Odds Ratio Forest Plot", base64: results.forest_plots.dor_base64 },
    ...(results.sroc.available && results.sroc.plot_base64 ? [{ key: "sroc", label: "SROC Curve", base64: results.sroc.plot_base64 }] : []),
  ];
  return (
    <Card title="Forest Plots">
      <div className="grid md:grid-cols-2 gap-6">
        {plots.map((p) => (
          <div key={p.key} className="bg-white p-4 rounded-xl flex flex-col items-center">
            <p className="text-slate-700 text-xs font-semibold mb-2 self-start">{p.label}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.base64} alt={p.label} className="w-full" />
            <button onClick={() => downloadPNG(p.base64, `${p.key}_plot.png`)} className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg">Download PNG</button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ExportTab({ results, downloadPNG }: { results: DTAResult; downloadPNG: (b64: string, name: string) => void }) {
  const studyHeader = ["Study", "TP", "FP", "FN", "TN", "Total", "Sensitivity", "Sensitivity_CI_Lower", "Sensitivity_CI_Upper", "Specificity", "Specificity_CI_Lower", "Specificity_CI_Upper", "PPV", "NPV", "LR+", "LR+_CI_Lower", "LR+_CI_Upper", "LR-", "LR-_CI_Lower", "LR-_CI_Upper", "DOR", "DOR_CI_Lower", "DOR_CI_Upper"];
  const studyRows = results.study_results.map((s) => [s.study, s.tp, s.fp, s.fn, s.tn, s.total, s.sensitivity ?? "", s.sensitivity_ci_lower ?? "", s.sensitivity_ci_upper ?? "", s.specificity ?? "", s.specificity_ci_lower ?? "", s.specificity_ci_upper ?? "", s.ppv ?? "", s.npv ?? "", s.lr_pos ?? "", s.lr_pos_ci_lower ?? "", s.lr_pos_ci_upper ?? "", s.lr_neg ?? "", s.lr_neg_ci_lower ?? "", s.lr_neg_ci_upper ?? "", s.dor ?? "", s.dor_ci_lower ?? "", s.dor_ci_upper ?? ""]);

  const summaryHeader = ["Metric", "Value"];
  const b = results.bivariate; const dor = results.univariate_pooled.dor; const lrp = results.univariate_pooled.lr_pos; const lrn = results.univariate_pooled.lr_neg;
  const summaryRows: (string | number)[][] = [
    ["Number of studies", results.data_summary.n_studies_included],
    ["Total participants", results.data_summary.total_participants],
    ["Pooled sensitivity", b.available ? pct(b.pooled_sensitivity) : "n/a"],
    ["Sensitivity 95% CI", b.available ? ci(b.pooled_sensitivity_ci_lower, b.pooled_sensitivity_ci_upper, pct) : "n/a"],
    ["Pooled specificity", b.available ? pct(b.pooled_specificity) : "n/a"],
    ["Specificity 95% CI", b.available ? ci(b.pooled_specificity_ci_lower, b.pooled_specificity_ci_upper, pct) : "n/a"],
    ["Pooled DOR", dor.available ? num(dor.estimate) : "n/a"],
    ["DOR 95% CI", dor.available ? ci(dor.ci_lower, dor.ci_upper, (v) => num(v)) : "n/a"],
    ["Pooled LR+", lrp.available ? num(lrp.estimate) : "n/a"],
    ["LR+ 95% CI", lrp.available ? ci(lrp.ci_lower, lrp.ci_upper, (v) => num(v)) : "n/a"],
    ["Pooled LR-", lrn.available ? num(lrn.estimate) : "n/a"],
    ["LR- 95% CI", lrn.available ? ci(lrn.ci_lower, lrn.ci_upper, (v) => num(v)) : "n/a"],
  ];

  return (
    <Card title="Export">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-[#0b0c10] border border-slate-800 rounded-xl p-4 space-y-2">
          <p className="text-white text-sm font-semibold">Study-Level Results</p>
          <div className="flex gap-2">
            <button onClick={() => downloadCSVFile("diagnostic_accuracy_study_level.csv", studyHeader, studyRows)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg">CSV</button>
            <button onClick={() => downloadXLSXFile("diagnostic_accuracy_study_level.xlsx", "Study-Level", studyHeader, studyRows)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg">XLSX</button>
          </div>
        </div>
        <div className="bg-[#0b0c10] border border-slate-800 rounded-xl p-4 space-y-2">
          <p className="text-white text-sm font-semibold">Summary (Meta-Analysis) Results</p>
          <div className="flex gap-2">
            <button onClick={() => downloadCSVFile("diagnostic_accuracy_summary.csv", summaryHeader, summaryRows)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg">CSV</button>
            <button onClick={() => downloadXLSXFile("diagnostic_accuracy_summary.xlsx", "Summary", summaryHeader, summaryRows)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg">XLSX</button>
          </div>
        </div>
      </div>
      <div className="bg-[#0b0c10] border border-slate-800 rounded-xl p-4 space-y-2">
        <p className="text-white text-sm font-semibold">Plots (PNG)</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => downloadPNG(results.forest_plots.sensitivity_base64, "sensitivity_forest_plot.png")} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg">Sensitivity Forest Plot</button>
          <button onClick={() => downloadPNG(results.forest_plots.specificity_base64, "specificity_forest_plot.png")} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg">Specificity Forest Plot</button>
          <button onClick={() => downloadPNG(results.forest_plots.dor_base64, "dor_forest_plot.png")} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg">DOR Forest Plot</button>
          {results.sroc.available && results.sroc.plot_base64 && (
            <button onClick={() => downloadPNG(results.sroc.plot_base64!, "sroc_curve.png")} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg">SROC Curve</button>
          )}
        </div>
        <p className="text-[10px] text-slate-500">PDF/SVG export is not yet implemented for this tool - PNG only, matching what dta-api.R currently generates.</p>
      </div>
    </Card>
  );
}
