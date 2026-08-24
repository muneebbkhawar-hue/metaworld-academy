"use client";

import { useState, useMemo, type ChangeEvent } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import type { TSAResult } from '../../types/statistics';
import { TSA_API_URL } from '../../lib/apiConfig';
import { BACKEND_UNAVAILABLE_MESSAGE } from '../../lib/apiClient';
import MultiOutcomeWorkflow, { type BatchProgressInfo } from '@/app/components/multiOutcome/MultiOutcomeWorkflow';
import LazyOutcomeCard from '@/app/components/multiOutcome/LazyOutcomeCard';
import { runOutcomeBatch } from '@/app/lib/multiOutcome/batch';
import { downloadPlotsAsZip } from '@/app/lib/multiOutcome/zipDownload';
import { sanitizeFilenamePart } from '@/app/lib/multiOutcome/filenames';
import type { DetectedOutcome, OutcomeRunState } from '@/app/lib/multiOutcome/types';

// Trial Sequential Analysis tool. Talks to a DEDICATED R Plumber process
// (tsa-api.R) on its own port (8001) - entirely separate from the
// Forest/Funnel/Sensitivity backend (api.R, port 8000), so this tool cannot
// interfere with those, and they cannot interfere with this one. The base
// URL is centralized in app/lib/apiConfig.ts (env-var overridable) rather
// than hardcoded here.
const TSA_API = `${TSA_API_URL}/api/tsa/analyze`;

// One row of parsed study input, before it's sent to the backend. Dichotomous
// and continuous rows share study/year/order and differ on the rest, so the
// numeric fields are optional here rather than modeled as a union - callers
// already branch on outcomeType to know which fields are populated.
// Numeric fields are always present (never omitted) once a row is
// constructed - an invalid/missing cell becomes NaN, not `undefined` - so
// these are typed as plain `number`, not optional, matching runtime shape.
interface TSAStudyRow {
  _rowIndex: number;
  study: string;
  year: number | null;
  order: number | null;
  event_e: number;
  n_e: number;
  event_c: number;
  n_c: number;
  mean_e: number;
  sd_e: number;
  mean_c: number;
  sd_c: number;
}

function normHeader(h: unknown) {
  return String(h || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// Dichotomous rows are mapped POSITIONALLY (Study, Exp Events, Exp Total,
// Ctrl Events, Ctrl Total = columns 1-5) regardless of what the header text
// says, since users rename the group columns to their own arm labels (e.g.
// "DCB Events") in exports from Google Sheets/Excel and header-name matching
// would then fail to find them. Year / Analysis Order are still picked up
// by header name if present as extra columns beyond the first 5, so the
// study-ordering feature keeps working when a user does include them.
function rowsToStudiesDichPositional(headerRow: string[], dataRows: string[][]): TSAStudyRow[] {
  let yearCol = -1, orderCol = -1;
  headerRow.forEach((h, i) => {
    if (i < 5) return;
    const n = normHeader(h);
    if (n === "year") yearCol = i;
    else if (n === "analysis order" || n === "order") orderCol = i;
  });
  return dataRows.map((row, idx) => {
    const study = String(row[0] ?? "").trim();
    const event_e = row[1] === undefined || row[1] === "" ? NaN : Number(row[1]);
    const n_e = row[2] === undefined || row[2] === "" ? NaN : Number(row[2]);
    const event_c = row[3] === undefined || row[3] === "" ? NaN : Number(row[3]);
    const n_c = row[4] === undefined || row[4] === "" ? NaN : Number(row[4]);
    const year = yearCol >= 0 && row[yearCol] !== undefined && row[yearCol] !== "" ? Number(row[yearCol]) : null;
    const order = orderCol >= 0 && row[orderCol] !== undefined && row[orderCol] !== "" ? Number(row[orderCol]) : null;
    return { _rowIndex: idx, study, event_e, n_e, event_c, n_c, mean_e: NaN, sd_e: NaN, mean_c: NaN, sd_c: NaN, year, order };
  }).filter(r => r.study);
}

// Same rationale as rowsToStudiesDichPositional: continuous columns are
// mapped positionally (Study, Exp Mean, Exp SD, Exp Total, Ctrl Mean, Ctrl
// SD, Ctrl Total = columns 1-7) so renamed group-label headers never break
// import or leave fields `undefined` (which crashed the editable table and
// silently dropped fields from the request body). Year / Analysis Order are
// still read by header name if present as extra columns beyond column 7.
function rowsToStudiesContPositional(headerRow: string[], dataRows: string[][]): TSAStudyRow[] {
  let yearCol = -1, orderCol = -1;
  headerRow.forEach((h, i) => {
    if (i < 7) return;
    const n = normHeader(h);
    if (n === "year") yearCol = i;
    else if (n === "analysis order" || n === "order") orderCol = i;
  });
  return dataRows.map((row, idx) => {
    const study = String(row[0] ?? "").trim();
    const num = (v: unknown) => (v === undefined || v === "" ? NaN : Number(v as string));
    const mean_e = num(row[1]), sd_e = num(row[2]), n_e = num(row[3]);
    const mean_c = num(row[4]), sd_c = num(row[5]), n_c = num(row[6]);
    const year = yearCol >= 0 && row[yearCol] !== undefined && row[yearCol] !== "" ? Number(row[yearCol]) : null;
    const order = orderCol >= 0 && row[orderCol] !== undefined && row[orderCol] !== "" ? Number(row[orderCol]) : null;
    return { _rowIndex: idx, study, mean_e, sd_e, n_e, mean_c, sd_c, n_c, event_e: NaN, event_c: NaN, year, order };
  }).filter(r => r.study);
}

function buildSampleCSV(outcomeType: string, expLabel: string, ctrlLabel: string) {
  if (outcomeType === "continuous") {
    // Column order matches rowsToStudiesContPositional: Study, Exp Mean, Exp
    // SD, Exp Total, Ctrl Mean, Ctrl SD, Ctrl Total (positions 1-7), then
    // Year as an optional 8th column.
    const header = ["Study", `${expLabel} Mean`, `${expLabel} SD`, `${expLabel} Total`, `${ctrlLabel} Mean`, `${ctrlLabel} SD`, `${ctrlLabel} Total`, "Year"];
    const rows = [
      ["Smith 2015", 10.2, 2.1, 50, 12.5, 2.4, 50, 2015],
      ["Jones 2018", 8.5, 1.8, 60, 9.1, 1.9, 60, 2018],
      ["Lee 2021", 9.0, 2.0, 55, 10.0, 2.2, 55, 2021],
    ];
    return [header, ...rows].map(r => r.join(",")).join("\n");
  }
  const header = ["Study", `${expLabel} Events`, `${expLabel} Total`, `${ctrlLabel} Events`, `${ctrlLabel} Total`];
  const rows = [
    ["Smith 2015", 12, 100, 24, 100],
    ["Jones 2018", 18, 120, 30, 118],
    ["Lee 2021", 9, 90, 20, 92],
  ];
  return [header, ...rows].map(r => r.join(",")).join("\n");
}

// Study order rule (must never silently reorder by name):
// 1. Explicit "order" column if present for ALL studies -> use it.
// 2. Else sort ascending by year; ties keep original spreadsheet order (stable sort).
// 3. Else (no order, no year) keep original spreadsheet order as-is.
function resolveStudyOrder(studies: TSAStudyRow[]) {
  const hasFullOrder = studies.length > 0 && studies.every(s => s.order !== null && s.order !== undefined && !Number.isNaN(s.order));
  const hasAnyYear = studies.some(s => s.year !== null && s.year !== undefined && !Number.isNaN(s.year));
  let ordered;
  let basis;
  if (hasFullOrder) {
    ordered = [...studies].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    basis = "Analysis Order column";
  } else if (hasAnyYear) {
    ordered = [...studies].sort((a, b) => {
      const ay = a.year ?? Infinity, by = b.year ?? Infinity;
      if (ay !== by) return ay - by;
      return a._rowIndex - b._rowIndex; // stable tie-break: original spreadsheet order
    });
    basis = "Year (ascending), ties kept in original spreadsheet order";
  } else {
    ordered = [...studies];
    basis = "Original spreadsheet order (no Analysis Order or Year column found)";
  }
  return { ordered, basis };
}

function validateStudies(studies: TSAStudyRow[], outcomeType: string) {
  const errors: string[] = [];
  const seen = new Map<string, number>();
  studies.forEach((s, i) => {
    const n = i + 1;
    if (!s.study) errors.push(`Row ${n}: missing study name.`);
    else {
      const key = s.study.toLowerCase();
      if (seen.has(key)) errors.push(`Row ${n}: duplicate study name "${s.study}" (also row ${(seen.get(key) ?? 0) + 1}).`);
      seen.set(key, i);
    }
    if (s.year !== null && s.year !== undefined && !Number.isNaN(s.year) && (s.year < 1800 || s.year > 2100)) {
      errors.push(`Row ${n} (${s.study}): year "${s.year}" looks invalid.`);
    }
    if (outcomeType === "dichotomous") {
      (["event_e", "n_e", "event_c", "n_c"] as const).forEach(k => { if (Number.isNaN(s[k])) errors.push(`Row ${n} (${s.study}): missing/invalid "${k}".`); });
      if (!Number.isNaN(s.n_e) && s.n_e <= 0) errors.push(`Row ${n} (${s.study}): experimental total must be > 0.`);
      if (!Number.isNaN(s.n_c) && s.n_c <= 0) errors.push(`Row ${n} (${s.study}): control total must be > 0.`);
      if (!Number.isNaN(s.event_e) && s.event_e < 0) errors.push(`Row ${n} (${s.study}): experimental events cannot be negative.`);
      if (!Number.isNaN(s.event_c) && s.event_c < 0) errors.push(`Row ${n} (${s.study}): control events cannot be negative.`);
      if (!Number.isNaN(s.event_e) && !Number.isNaN(s.n_e) && s.event_e > s.n_e) errors.push(`Row ${n} (${s.study}): experimental events exceed experimental total.`);
      if (!Number.isNaN(s.event_c) && !Number.isNaN(s.n_c) && s.event_c > s.n_c) errors.push(`Row ${n} (${s.study}): control events exceed control total.`);
    } else {
      (["mean_e", "sd_e", "n_e", "mean_c", "sd_c", "n_c"] as const).forEach(k => { if (Number.isNaN(s[k])) errors.push(`Row ${n} (${s.study}): missing/invalid "${k}".`); });
      if (!Number.isNaN(s.sd_e) && s.sd_e <= 0) errors.push(`Row ${n} (${s.study}): experimental SD must be > 0.`);
      if (!Number.isNaN(s.sd_c) && s.sd_c <= 0) errors.push(`Row ${n} (${s.study}): control SD must be > 0.`);
      if (!Number.isNaN(s.n_e) && s.n_e <= 0) errors.push(`Row ${n} (${s.study}): experimental total must be > 0.`);
      if (!Number.isNaN(s.n_c) && s.n_c <= 0) errors.push(`Row ${n} (${s.study}): control total must be > 0.`);
    }
  });
  if (studies.length < 2) errors.push("At least 2 studies are required for Trial Sequential Analysis.");
  return errors;
}

export default function TSATool() {
  const [outcomeType, setOutcomeType] = useState("dichotomous");
  const [effectMeasure, setEffectMeasure] = useState("RR");
  const [expGroupLabel, setExpGroupLabel] = useState("Experimental");
  const [ctrlGroupLabel, setCtrlGroupLabel] = useState("Control");
  const [rawStudies, setRawStudies] = useState<TSAStudyRow[]>([]);
  const [pasteData, setPasteData] = useState("");
  const [parseError, setParseError] = useState("");

  const [alpha, setAlpha] = useState("0.05");
  const [power, setPower] = useState("90");
  const [side, setSide] = useState("Two-sided");
  const [expectedEffectMode, setExpectedEffectMode] = useState("manual");
  const [expectedEffectValue, setExpectedEffectValue] = useState("0.8");
  const [controlRiskMode, setControlRiskMode] = useState("auto");
  const [controlRiskValue, setControlRiskValue] = useState("0.1");
  const [model, setModel] = useState("Random-effects");
  const [heterogeneityAdj, setHeterogeneityAdj] = useState("D2");
  const [boundaryType, setBoundaryType] = useState("OBrien-Fleming");
  const [futility, setFutility] = useState("none");

  const [results, setResults] = useState<TSAResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [multiRunStates, setMultiRunStates] = useState<OutcomeRunState<TSAResult>[]>([]);
  const [multiRunning, setMultiRunning] = useState(false);
  const [multiProgress, setMultiProgress] = useState<BatchProgressInfo | null>(null);

  // Reuses the exact same /api/tsa/analyze endpoint and TSA Settings (alpha,
  // power, boundary type, etc. - identical across every outcome in one
  // upload) as the single-outcome workflow below, called once per selected
  // outcome. NOTE: the multi-outcome extraction sheet format (shared with
  // Forest/Funnel/Sensitivity) has no per-study Year/Analysis Order columns,
  // so cumulative study order for each outcome falls back to the sheet's own
  // row order - the same "no Order/Year column found" behavior
  // resolveStudyOrder already uses for single-outcome uploads, not a new
  // rule invented for this mode.
  async function runMultiOutcomeBatch(outcomes: DetectedOutcome[]) {
    setMultiRunning(true);
    setMultiRunStates(outcomes.map((outcome) => ({ outcome, status: "pending" as const })));
    const configPayload = {
      outcome_type: outcomeType,
      effect_measure: effectMeasure,
      model,
      alpha: parseFloat(alpha),
      power: parseFloat(power),
      side,
      expected_effect_mode: expectedEffectMode,
      expected_effect_value: expectedEffectMode === "manual" ? parseFloat(expectedEffectValue) : null,
      control_risk_mode: controlRiskMode,
      control_risk_value: controlRiskMode === "manual" ? parseFloat(controlRiskValue) : null,
      heterogeneity_adjustment: model === "Fixed-effect" ? "none" : heterogeneityAdj,
      boundary_type: boundaryType,
      futility,
    };

    await runOutcomeBatch<TSAResult>(
      outcomes,
      async (outcome) => {
        const res = await fetch(TSA_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studies: outcome.eligibleStudies, config: configPayload }),
        });
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("The TSA R Plumber backend returned an invalid response for this outcome.");
        }
        if (data.status !== "success") throw new Error(data.message || "R Execution Error for this outcome.");
        return data as TSAResult;
      },
      (index, state) => setMultiRunStates((prev) => prev.map((s, i) => (i === index ? state : s))),
      (progress) => setMultiProgress(progress)
    );
    setMultiRunning(false);
    setMultiProgress(null);
  }

  function downloadMultiOutcomeSummaryCSV() {
    const successStates = multiRunStates.filter((s): s is OutcomeRunState<TSAResult> & { result: TSAResult } => s.status === "success" && !!s.result);
    const header = ["Outcome", "Studies", "Effect Measure", "Model", "Accrued Information Size", "Required Information Size", "Information Fraction (%)", "Interpretation"];
    const rows = successStates.map((s) => [
      s.outcome.name,
      s.outcome.eligibleStudies.length,
      s.result.settings.effect_measure,
      s.result.settings.model,
      s.result.information.accrued_information_size ?? "",
      s.result.information.required_information_size_unavailable ? "N/A" : s.result.information.required_information_size,
      s.result.information.information_fraction != null && !isNaN(s.result.information.information_fraction) ? (s.result.information.information_fraction * 100).toFixed(1) : "N/A",
      s.result.interpretation,
    ]);
    const csv = [header.join(","), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "tsa-multi-outcome-summary.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const { ordered, basis } = useMemo(() => resolveStudyOrder(rawStudies), [rawStudies]);
  const validationErrors = useMemo(() => validateStudies(ordered, outcomeType), [ordered, outcomeType]);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError("");
    const isXlsx = /\.xlsx?$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let headerRow: string[], dataRows: string[][];
        if (isXlsx) {
          const wb = XLSX.read(event.target?.result, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
          headerRow = rows[0] || [];
          dataRows = rows.slice(1).filter((r) => r.some((c) => c !== ""));
        } else {
          const text = String(event.target?.result ?? "");
          const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
          headerRow = lines[0].split(",").map((c) => c.replace(/['"]+/g, ''));
          dataRows = lines.slice(1).map((l) => l.split(",").map((c) => c.replace(/['"]+/g, '').trim()));
        }
        const studies = outcomeType === "dichotomous"
          ? rowsToStudiesDichPositional(headerRow, dataRows)
          : rowsToStudiesContPositional(headerRow, dataRows);
        if (studies.length === 0) { setParseError("No studies could be read from this file. Check that the first row is a header row and data starts on row 2."); return; }
        setRawStudies(studies);
      } catch (err) {
        setParseError("Could not parse this file: " + (err instanceof Error ? err.message : String(err)));
      }
    };
    if (isXlsx) reader.readAsArrayBuffer(file); else reader.readAsText(file);
  };

  const importPaste = () => {
    if (!pasteData.trim()) return;
    setParseError("");
    const lines = pasteData.trim().split(/\r?\n/);
    const headerRow = lines[0].split("\t");
    const dataRows = lines.slice(1).map(l => l.split("\t"));
    const studies = outcomeType === "dichotomous"
      ? rowsToStudiesDichPositional(headerRow, dataRows)
      : rowsToStudiesContPositional(headerRow, dataRows);
    if (studies.length === 0) { setParseError("No studies could be read from the pasted data. First row must be a header row and data starts on row 2."); return; }
    setRawStudies(studies);
    setPasteData("");
  };

  const downloadTemplate = () => {
    const csv = buildSampleCSV(outcomeType, expGroupLabel || "Experimental", ctrlGroupLabel || "Control");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "tsa-template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const runAnalysis = async () => {
    if (validationErrors.length > 0 || ordered.length < 2) return;
    setLoading(true);
    setResults(null);
    setErrorMessage("");
    try {
      const payload = {
        studies: ordered.map(s => outcomeType === "continuous"
          ? { study: s.study, mean_e: s.mean_e, sd_e: s.sd_e, n_e: s.n_e, mean_c: s.mean_c, sd_c: s.sd_c, n_c: s.n_c }
          : { study: s.study, event_e: s.event_e, n_e: s.n_e, event_c: s.event_c, n_c: s.n_c }),
        config: {
          outcome_type: outcomeType,
          effect_measure: effectMeasure,
          model,
          alpha: parseFloat(alpha),
          power: parseFloat(power),
          side,
          expected_effect_mode: expectedEffectMode,
          expected_effect_value: expectedEffectMode === "manual" ? parseFloat(expectedEffectValue) : null,
          control_risk_mode: controlRiskMode,
          control_risk_value: controlRiskMode === "manual" ? parseFloat(controlRiskValue) : null,
          heterogeneity_adjustment: model === "Fixed-effect" ? "none" : heterogeneityAdj,
          boundary_type: boundaryType,
          futility,
        }
      };
      const res = await fetch(TSA_API, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { setErrorMessage("Fatal Error: TSA R Plumber returned an invalid response. Check the R console for crashes."); setLoading(false); return; }
      if (data.status === "success") setResults(data);
      else setErrorMessage(`R Execution Error: ${data.message || "Unknown error occurred inside R."}`);
    } catch {
      setErrorMessage(BACKEND_UNAVAILABLE_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  const downloadPlot = () => {
    if (!results?.plot_base64) return;
    const link = document.createElement("a");
    link.href = results.plot_base64;
    link.download = "trial-sequential-analysis.png";
    link.click();
  };

  const downloadCSV = () => {
    if (!results?.table) return;
    const t = results.table;
    const headers = ["Analysis Order", "Study", "Cumulative Participants", "Cumulative Information Fraction", "Cumulative Z", "Monitoring Boundary (Upper)", "Monitoring Boundary (Lower)", "Futility Boundary (Upper)", "Futility Boundary (Lower)", "Crossed Benefit", "Crossed Harm", "Crossed Futility"];
    const rows = t.study.map((_, i) => [
      t.analysis_order[i], t.study[i], t.cumulative_participants[i], t.cumulative_information_fraction[i],
      t.cumulative_z[i], t.monitoring_boundary_upper[i], t.monitoring_boundary_lower[i],
      t.futility_boundary_upper?.[i], t.futility_boundary_lower?.[i],
      t.crossed_benefit[i], t.crossed_harm[i], t.crossed_futility[i]
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => v === null || v === undefined ? "" : v).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "tsa-results.csv";
    link.click();
  };

  const measureOptions = outcomeType === "dichotomous"
    ? [["RR", "Risk Ratio (RR)"], ["OR", "Odds Ratio (OR)"], ["RD", "Risk Difference (RD)"]]
    : [["MD", "Mean Difference (MD)"]];

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
            <h1 className="text-3xl font-bold text-white mb-2">Trial Sequential Analysis</h1>
            <p className="text-slate-400 text-sm">Cumulative meta-analysis with sequential monitoring boundaries and required information size, computed via the R <code>RTSA</code> package.</p>
          </div>

          {errorMessage && <div className="bg-red-950/80 border border-red-500/80 text-red-200 p-5 rounded-xl text-sm font-mono shadow-lg">{errorMessage}</div>}

          {/* Data type */}
          <div className="bg-[#151722] border border-indigo-900/30 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-white font-semibold text-sm">Data Type</h3>
            <div className="flex gap-3">
              <button onClick={() => { setOutcomeType("dichotomous"); setEffectMeasure("RR"); }} className={`px-5 py-2.5 rounded-xl font-medium transition ${outcomeType === "dichotomous" ? "bg-indigo-600 text-white" : "text-slate-400 bg-[#0b0c10]"}`}>Dichotomous</button>
              <button onClick={() => { setOutcomeType("continuous"); setEffectMeasure("MD"); }} className={`px-5 py-2.5 rounded-xl font-medium transition ${outcomeType === "continuous" ? "bg-indigo-600 text-white" : "text-slate-400 bg-[#0b0c10]"}`}>Continuous</button>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Outcome (Effect Measure):</label>
              <select value={effectMeasure} onChange={e => setEffectMeasure(e.target.value)} className="w-full md:w-64 bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                {measureOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
              <div><label className="block text-xs text-slate-400 mb-1">Experimental Group Label:</label><input type="text" value={expGroupLabel} onChange={e => setExpGroupLabel(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white" /></div>
              <div><label className="block text-xs text-slate-400 mb-1">Control Group Label:</label><input type="text" value={ctrlGroupLabel} onChange={e => setCtrlGroupLabel(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white" /></div>
            </div>
          </div>

          {/* Multi-outcome batch workflow */}
          <MultiOutcomeWorkflow
            type={outcomeType === "continuous" ? "continuous" : "dichotomous"}
            expLabel={expGroupLabel}
            ctrlLabel={ctrlGroupLabel}
            onExpLabelChange={setExpGroupLabel}
            onCtrlLabelChange={setCtrlGroupLabel}
            onRunSelected={runMultiOutcomeBatch}
            running={multiRunning}
            progress={multiProgress}
            runLabel="Run TSA"
          />

          {multiRunStates.length > 0 && (
            <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="text-white font-semibold text-sm">
                  TSA Multi-Outcome Results ({multiRunStates.filter((s) => s.status === "success").length} of {multiRunStates.length} completed)
                </h3>
                {multiRunStates.some((s) => s.status === "success") && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={downloadMultiOutcomeSummaryCSV}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg"
                    >
                      Download Summary (CSV — all outcomes)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        downloadPlotsAsZip(
                          multiRunStates.filter((s): s is OutcomeRunState<TSAResult> & { result: TSAResult } => s.status === "success" && !!s.result).map((s) => ({ outcomeName: s.outcome.name, base64Png: s.result.plot_base64 })),
                          "tsa_plots.zip",
                          "tsa"
                        )
                      }
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg"
                    >
                      Download all TSA plots (ZIP)
                    </button>
                  </div>
                )}
              </div>
              {multiRunStates.map((state) => (
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
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Stat label="Accrued Information Size" value={state.result.information.accrued_information_size} />
                        <Stat label={state.result.information.required_information_size_unavailable ? "Required Information Size" : state.result.information.required_information_size_label} value={state.result.information.required_information_size_unavailable ? "N/A" : state.result.information.required_information_size} />
                        <Stat label="Information Fraction" value={state.result.information.information_fraction != null && !isNaN(state.result.information.information_fraction) ? `${(state.result.information.information_fraction * 100).toFixed(1)}%` : "N/A"} />
                        <Stat label="Model" value={state.result.settings.model} />
                      </div>
                      <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-3 text-sm text-slate-200">{state.result.interpretation}</div>
                      <div className="bg-white p-4 rounded-xl flex flex-col items-center overflow-x-auto">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={state.result.plot_base64} alt={`TSA plot: ${state.outcome.name}`} className="max-w-none" style={{ height: "480px" }} />
                        <button
                          type="button"
                          onClick={() => {
                            const link = document.createElement("a");
                            link.href = state.result!.plot_base64;
                            link.download = `tsa_${sanitizeFilenamePart(state.outcome.name)}.png`;
                            link.click();
                          }}
                          className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg"
                        >
                          Download PNG
                        </button>
                      </div>
                    </div>
                  )}
                </LazyOutcomeCard>
              ))}
            </div>
          )}

          {/* Upload */}
          <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6">
            <div className="flex justify-between items-start flex-wrap gap-3 mb-3">
              <h3 className="text-white font-semibold text-sm">Single-Outcome Upload (CSV / XLSX)</h3>
              <button onClick={downloadTemplate} className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded-lg whitespace-nowrap">Download Sample CSV Template</button>
            </div>
            <p className="text-slate-500 text-xs mb-3">
              {outcomeType === "dichotomous"
                ? `Columns (in order): Study, ${expGroupLabel} Events, ${expGroupLabel} Total, ${ctrlGroupLabel} Events, ${ctrlGroupLabel} Total. The first 5 columns are read by position, so the group-name headers can say anything. Year and Analysis Order may be added as extra columns.`
                : "Columns: Study, Year, Analysis Order (optional), Experimental Mean, Experimental SD, Experimental Total, Control Mean, Control SD, Control Total"}
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-900/40 file:text-indigo-300 cursor-pointer" />
              </div>
              <div>
                <textarea rows={2} value={pasteData} onChange={e => setPasteData(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2 text-xs text-slate-200 mb-2" placeholder="Paste tab-separated rows, first row = header" />
                <button onClick={importPaste} className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg">Import Pasted Data</button>
              </div>
            </div>
            {parseError && <div className="mt-3 text-red-400 text-xs">{parseError}</div>}
          </div>

          {/* Study order preview + editable table */}
          {rawStudies.length > 0 && (
            <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-white font-semibold text-sm">Review &amp; Verify Study Order</h3>
              <p className="text-xs text-slate-500">Basis: {basis}. Studies are never reordered alphabetically or randomly. Edit any cell below before running the analysis.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="text-slate-500 uppercase text-xs">
                    <tr>
                      <th className="pb-2 pr-2">#</th>
                      <th className="pb-2 pr-2">Study</th>
                      <th className="pb-2 pr-2">Year</th>
                      {outcomeType === "dichotomous" ? (
                        <><th className="pb-2 pr-2">{expGroupLabel} Events</th><th className="pb-2 pr-2">{expGroupLabel} Total</th><th className="pb-2 pr-2">{ctrlGroupLabel} Events</th><th className="pb-2 pr-2">{ctrlGroupLabel} Total</th></>
                      ) : (
                        <><th className="pb-2 pr-2">{expGroupLabel} Mean</th><th className="pb-2 pr-2">{expGroupLabel} SD</th><th className="pb-2 pr-2">{expGroupLabel} Total</th><th className="pb-2 pr-2">{ctrlGroupLabel} Mean</th><th className="pb-2 pr-2">{ctrlGroupLabel} SD</th><th className="pb-2 pr-2">{ctrlGroupLabel} Total</th></>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {ordered.map((s, i) => {
                      const setField = (field: keyof TSAStudyRow, value: string | number | null) => {
                        const next = rawStudies.map(rs => rs._rowIndex === s._rowIndex ? { ...rs, [field]: value } : rs);
                        setRawStudies(next);
                      };
                      const numFields: (keyof TSAStudyRow)[] = outcomeType === "dichotomous"
                        ? ["event_e", "n_e", "event_c", "n_c"]
                        : ["mean_e", "sd_e", "n_e", "mean_c", "sd_c", "n_c"];
                      return (
                        <tr key={s._rowIndex}>
                          <td className="py-1.5 pr-2">{i + 1}</td>
                          <td className="py-1.5 pr-2"><input type="text" value={s.study} onChange={e => setField("study", e.target.value)} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1 w-32 text-white text-xs" /></td>
                          <td className="py-1.5 pr-2"><input type="number" value={s.year ?? ""} onChange={e => setField("year", e.target.value === "" ? null : Number(e.target.value))} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1 w-20 text-white text-xs" /></td>
                          {numFields.map(f => (
                            <td key={f} className="py-1.5 pr-2"><input type="number" step="0.1" value={Number.isNaN(s[f] as number) ? "" : (s[f] as number)} onChange={e => setField(f, e.target.value === "" ? NaN : Number(e.target.value))} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1 w-20 text-white text-xs" /></td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {validationErrors.length > 0 && (
                <div className="bg-amber-950/40 border border-amber-600/50 rounded-xl p-4 text-amber-300 text-xs space-y-1">
                  <strong>Fix before running:</strong>
                  {validationErrors.map((e, i) => <div key={i}>• {e}</div>)}
                </div>
              )}
            </div>
          )}

          {/* TSA settings */}
          <div className="bg-[#151722] border border-indigo-900/30 rounded-2xl p-6 shadow-xl space-y-6">
            <h3 className="text-lg font-bold text-white">TSA Settings</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Alpha (Type I error):</label>
                <select value={alpha} onChange={e => setAlpha(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                  <option value="0.01">0.01</option><option value="0.025">0.025</option><option value="0.05">0.05</option><option value="0.10">0.10</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Power:</label>
                <select value={power} onChange={e => setPower(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                  <option value="80">80%</option><option value="90">90%</option><option value="95">95%</option><option value="99">99%</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Sides:</label>
                <select value={side} onChange={e => setSide(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                  <option value="Two-sided">Two-sided</option><option value="One-sided">One-sided</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-3">
              <label className="block text-xs text-slate-400">Expected / anticipated intervention effect (natural scale — e.g. RR/OR/RD as entered, or MD directly; never log-scale):</label>
              <div className="flex flex-wrap gap-4 items-center text-sm">
                <label className="flex items-center gap-2"><input type="radio" checked={expectedEffectMode === "observed"} onChange={() => setExpectedEffectMode("observed")} /> Use observed pooled effect</label>
                <label className="flex items-center gap-2"><input type="radio" checked={expectedEffectMode === "manual"} onChange={() => setExpectedEffectMode("manual")} /> Specify manually</label>
                {expectedEffectMode === "manual" && (
                  <input type="number" step="0.01" value={expectedEffectValue} onChange={e => setExpectedEffectValue(e.target.value)} className="bg-[#0b0c10] border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white w-32" />
                )}
              </div>
              {expectedEffectMode === "observed" && (
                <div className="bg-amber-950/40 border border-amber-600/50 rounded-lg p-3 text-amber-300 text-xs">
                  ⚠️ Using the observed pooled effect as the anticipated effect is a post-hoc assumption and may be optimistic — it can underestimate the required information size.
                </div>
              )}
            </div>
          </div>

          {/* Information size */}
          <div className="bg-[#151722] border border-indigo-900/30 rounded-2xl p-6 shadow-xl space-y-6">
            <h3 className="text-lg font-bold text-white">Required Information Size</h3>
            {outcomeType === "dichotomous" && (
              <div className="space-y-2">
                <label className="block text-xs text-slate-400">Control event risk (used for RIS calculation):</label>
                <div className="flex flex-wrap gap-4 items-center text-sm">
                  <label className="flex items-center gap-2"><input type="radio" checked={controlRiskMode === "auto"} onChange={() => setControlRiskMode("auto")} /> Calculate from included studies</label>
                  <label className="flex items-center gap-2"><input type="radio" checked={controlRiskMode === "manual"} onChange={() => setControlRiskMode("manual")} /> Enter manually</label>
                  {controlRiskMode === "manual" && (
                    <input type="number" step="0.01" min="0" max="1" value={controlRiskValue} onChange={e => setControlRiskValue(e.target.value)} className="bg-[#0b0c10] border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white w-32" />
                  )}
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Heterogeneity / Information Size Adjustment:</label>
              {model === "Fixed-effect" ? (
                <p className="text-xs text-slate-500 italic">Not applicable — a fixed-effect model has no heterogeneity adjustment.</p>
              ) : (
                <select value={heterogeneityAdj} onChange={e => setHeterogeneityAdj(e.target.value)} className="w-full md:w-64 bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                  <option value="D2">Diversity (D²) → Diversity-Adjusted RIS (DARIS)</option>
                  <option value="I2">I² → Heterogeneity-Adjusted RIS</option>
                  <option value="tau2">Tau² → Heterogeneity-Adjusted RIS</option>
                </select>
              )}
            </div>
          </div>

          {/* Model / Boundaries */}
          <div className="bg-[#151722] border border-indigo-900/30 rounded-2xl p-6 shadow-xl space-y-6">
            <h3 className="text-lg font-bold text-white">Model &amp; Monitoring Boundaries</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Meta-Analysis Model:</label>
                <select value={model} onChange={e => setModel(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                  <option value="Random-effects">Random-effects</option>
                  <option value="Fixed-effect">Fixed-effect</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Boundary Type:</label>
                <select value={boundaryType} onChange={e => setBoundaryType(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                  <option value="OBrien-Fleming">Lan-DeMets O&apos;Brien-Fleming</option>
                  <option value="Pocock">Lan-DeMets Pocock</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Futility Boundary:</label>
                <select value={futility} onChange={e => setFutility(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                  <option value="none">None</option>
                  <option value="non-binding">Non-binding</option>
                  <option value="binding">Binding</option>
                </select>
              </div>
            </div>
          </div>

          <button
            onClick={runAnalysis}
            disabled={loading || rawStudies.length === 0 || validationErrors.length > 0}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl shadow-lg transition"
          >
            {loading ? "RUNNING TSA..." : "RUN TRIAL SEQUENTIAL ANALYSIS"}
          </button>

          {/* Results */}
          {results && (
            <div className="space-y-6">
              <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-white">TSA Figure</h3>
                  <div className="flex gap-2">
                    <button onClick={downloadPlot} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg shadow">Download PNG</button>
                    <button onClick={downloadCSV} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg shadow">Download CSV</button>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-inner flex flex-col items-center overflow-x-auto">
                  <img src={results.plot_base64} className="max-w-none" style={{ height: '640px' }} />
                </div>
              </div>

              <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl space-y-4">
                <h3 className="text-xl font-bold text-white">Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Stat label="Outcome" value={results.settings.effect_measure} />
                  <Stat label="Model" value={results.settings.model} />
                  <Stat label="Alpha" value={`${(results.settings.alpha * 100).toFixed(1)}%`} />
                  <Stat label="Power" value={`${results.settings.power}%`} />
                  <Stat label="Boundary" value={results.settings.boundary_type} />
                  <Stat label="Futility" value={results.settings.futility} />
                  <Stat label="Accrued Information Size" value={results.information.accrued_information_size} />
                  <Stat label={results.information.required_information_size_unavailable ? "Required Information Size" : results.information.required_information_size_label} value={results.information.required_information_size_unavailable ? "N/A" : results.information.required_information_size} />
                  <Stat label="Information Fraction" value={results.information.information_fraction != null && !isNaN(results.information.information_fraction) ? `${(results.information.information_fraction * 100).toFixed(1)}%` : "N/A"} />
                  {results.settings.model === "Random-effects" && <Stat label="Diversity (D²)" value={results.information.diversity_d2 != null ? `${(results.information.diversity_d2 * 100).toFixed(1)}%` : "N/A"} />}
                  {results.settings.model === "Random-effects" && <Stat label="I²" value={results.information.i2 != null ? `${(results.information.i2 * 100).toFixed(1)}%` : "N/A"} />}
                  {results.settings.model === "Random-effects" && <Stat label="Tau²" value={results.information.tau2 != null ? results.information.tau2.toFixed(4) : "N/A"} />}
                </div>
                {results.information.required_information_size_note && (
                  <div className="bg-amber-950/40 border border-amber-600/50 rounded-lg p-3 text-amber-300 text-xs">⚠️ {results.information.required_information_size_note}</div>
                )}
                <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-4 text-sm text-slate-200">{results.interpretation}</div>
                {results.settings.expected_effect_is_posthoc_assumption && (
                  <div className="text-amber-400 text-xs">⚠️ The anticipated effect used for the required information size was the observed pooled effect — a post-hoc assumption that may be optimistic.</div>
                )}
              </div>

              <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl space-y-4">
                <h3 className="text-xl font-bold text-white">Study-by-Study Results</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 uppercase bg-black/40">
                        <th className="p-2">#</th><th className="p-2">Study</th><th className="p-2">Cum. N</th><th className="p-2">Info Fraction</th><th className="p-2">Cum. Z</th><th className="p-2">Boundary (±)</th><th className="p-2">Benefit</th><th className="p-2">Harm</th><th className="p-2">Futility</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.table.study.map((s, i) => (
                        <tr key={i} className="border-b border-slate-800 bg-[#0b0c10]">
                          <td className="p-2">{results.table.analysis_order[i]}</td>
                          <td className="p-2">{s}</td>
                          <td className="p-2">{results.table.cumulative_participants[i]}</td>
                          <td className="p-2">{results.table.cumulative_information_fraction[i] != null ? `${(results.table.cumulative_information_fraction[i] * 100).toFixed(1)}%` : "—"}</td>
                          <td className="p-2">{results.table.cumulative_z[i] != null ? results.table.cumulative_z[i].toFixed(3) : "—"}</td>
                          <td className="p-2">{results.table.monitoring_boundary_upper[i] != null ? `±${results.table.monitoring_boundary_upper[i].toFixed(2)}` : "—"}</td>
                          <td className="p-2">{results.table.crossed_benefit[i] ? "✅" : "—"}</td>
                          <td className="p-2">{results.table.crossed_harm[i] ? "⚠️" : "—"}</td>
                          <td className="p-2">{results.table.crossed_futility[i] ? "⏹️" : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
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
