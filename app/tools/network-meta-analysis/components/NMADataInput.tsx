"use client";

import { useState, type ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import type { NMAArm } from '../../../types/statistics';

// Same positional-parsing lesson learned from the TSA tool: map columns by
// POSITION, not by header text, so renamed headers (a common real-world
// export quirk) never silently break import or leave fields `undefined`.
// Dichotomous: Study, Treatment, Events, Total (columns 1-4)
// Continuous:  Study, Treatment, Mean, SD, Total (columns 1-5)
//
// Optional study-level columns for the analysis extensions (Sensitivity /
// Subgroup / Meta-Regression) - "Subgroup" (categorical) and "Year"
// (numeric covariate) - are detected by HEADER NAME as extra columns
// beyond the required fixed ones, same convention TSA uses for its
// optional Year/Analysis Order columns. Never invented if absent.
//
// ANY OTHER extra column beyond Subgroup/Year (e.g. Age, Sex, Baseline
// Severity, Follow-up Duration) is captured generically into `covariates`,
// keyed by its own header text, for the Evidence & Certainty > Transitivity
// Assessment tool to discover and let the researcher select as a potential
// effect modifier. This does not invent any variable that isn't actually a
// column in the uploaded dataset.
function normHeader(h: unknown) { return String(h || "").trim().toLowerCase(); }

function rowsToArms(headerRow: string[], dataRows: string[][], outcomeType: string): NMAArm[] {
  const num = (v: unknown) => (v === undefined || v === "" ? NaN : Number(v as string));
  const fixedCols = outcomeType === "continuous" ? 5 : 4;
  let subgroupCol = -1, yearCol = -1;
  const covariateCols: { index: number; name: string }[] = [];
  headerRow.forEach((h, i) => {
    if (i < fixedCols) return;
    const n = normHeader(h);
    if (n === "subgroup") subgroupCol = i;
    else if (n === "year") yearCol = i;
    else if (h !== undefined && String(h).trim() !== "") covariateCols.push({ index: i, name: String(h).trim() });
  });
  return dataRows.map((row, idx) => {
    const study = String(row[0] ?? "").trim();
    const treatment = String(row[1] ?? "").trim();
    const subgroup = subgroupCol >= 0 ? String(row[subgroupCol] ?? "").trim() : null;
    const year = yearCol >= 0 && row[yearCol] !== undefined && row[yearCol] !== "" ? Number(row[yearCol]) : null;
    let covariates: Record<string, string> | undefined;
    if (covariateCols.length > 0) {
      covariates = {};
      for (const c of covariateCols) {
        const raw = row[c.index];
        if (raw !== undefined && String(raw).trim() !== "") covariates[c.name] = String(raw).trim();
      }
    }
    const base = { _rowIndex: idx, study, treatment, subgroup: subgroup || null, year, covariates };
    if (outcomeType === "continuous") {
      return { ...base, mean: num(row[2]), sd: num(row[3]), n: num(row[4]) };
    }
    return { ...base, event: num(row[2]), n: num(row[3]) };
  }).filter(r => r.study && r.treatment);
}

export function buildSampleCSV(outcomeType: string) {
  if (outcomeType === "continuous") {
    const header = ["Study", "Treatment", "Mean", "SD", "Total"];
    const rows = [
      ["Study 1", "A", 10.2, 2.1, 100], ["Study 1", "B", 12.3, 2.5, 100],
      ["Study 2", "A", 9.8, 2.0, 90], ["Study 2", "C", 11.1, 2.3, 95],
      ["Study 3", "B", 12.0, 2.4, 85], ["Study 3", "C", 11.5, 2.2, 88],
    ];
    return [header, ...rows].map(r => r.join(",")).join("\n");
  }
  const header = ["Study", "Treatment", "Events", "Total"];
  const rows = [
    ["Study 1", "A", 20, 100], ["Study 1", "B", 30, 100],
    ["Study 2", "A", 15, 80], ["Study 2", "C", 25, 90],
    ["Study 3", "B", 18, 95], ["Study 3", "C", 22, 92],
  ];
  return [header, ...rows].map(r => r.join(",")).join("\n");
}

interface NMADataInputProps {
  outcomeType: string;
  arms: NMAArm[];
  setArms: (arms: NMAArm[]) => void;
}

export default function NMADataInput({ outcomeType, arms, setArms }: NMADataInputProps) {
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isXlsx = /\.xlsx?$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      let headerRow: string[], dataRows: string[][];
      if (isXlsx) {
        const wb = XLSX.read(event.target?.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
        headerRow = (rows[0] || []) as string[];
        dataRows = rows.slice(1).filter((r) => r.some((c) => c !== "")) as string[][];
      } else {
        const text = String(event.target?.result ?? "");
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
        headerRow = lines[0].split(",").map(c => c.replace(/['"]+/g, ''));
        dataRows = lines.slice(1).map(l => l.split(",").map(c => c.replace(/['"]+/g, '').trim()));
      }
      setArms(rowsToArms(headerRow, dataRows, outcomeType));
    };
    if (isXlsx) reader.readAsArrayBuffer(file); else reader.readAsText(file);
  };

  const [pasteData, setPasteData] = useState("");
  const importPaste = () => {
    if (!pasteData.trim()) return;
    const lines = pasteData.trim().split(/\r?\n/);
    const headerRow = lines[0].split("\t");
    const dataRows = lines.slice(1).map(l => l.split("\t"));
    setArms(rowsToArms(headerRow, dataRows, outcomeType));
    setPasteData("");
  };

  const downloadTemplate = () => {
    const csv = buildSampleCSV(outcomeType);
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "nma-template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const setField = (rowIndex: number, field: keyof NMAArm, value: string | number) => {
    setArms(arms.map(a => a._rowIndex === rowIndex ? { ...a, [field]: value } : a));
  };

  return (
    <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 space-y-4">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <h3 className="text-white font-semibold text-sm">Upload your network meta-analysis dataset (CSV / XLSX)</h3>
        <button onClick={downloadTemplate} className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded-lg whitespace-nowrap">Download Sample CSV Template</button>
      </div>
      <p className="text-slate-500 text-xs">
        {outcomeType === "dichotomous"
          ? "Columns (by position): Study, Treatment, Events, Total. One row per treatment arm - a 3-arm study needs 3 rows sharing the same Study ID."
          : "Columns (by position): Study, Treatment, Mean, SD, Total. One row per treatment arm - a 3-arm study needs 3 rows sharing the same Study ID."}
        {" "}Optional extra columns named <strong className="text-slate-400">Subgroup</strong> (text) and/or <strong className="text-slate-400">Year</strong> (number) - if present, they enable the Subgroup Analysis and Meta-Regression tools further down. Any other extra column (e.g. Age, Sex, Baseline Severity) is picked up automatically as a potential effect modifier for the Transitivity Assessment tool in Evidence &amp; Certainty.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-900/40 file:text-indigo-300 cursor-pointer" />
        <div>
          <textarea rows={2} value={pasteData} onChange={e => setPasteData(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2 text-xs text-slate-200 mb-2" placeholder="Paste tab-separated rows, first row = header" />
          <button onClick={importPaste} className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg">Import Pasted Data</button>
        </div>
      </div>

      {arms.length > 0 && (
        <div className="pt-4 border-t border-slate-800 space-y-2">
          <h4 className="text-white font-semibold text-xs">Review &amp; Verify Arms ({arms.length} rows)</h4>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="text-slate-500 uppercase sticky top-0 bg-[#151722]">
                <tr>
                  <th className="pb-2 pr-2">Study</th><th className="pb-2 pr-2">Treatment</th>
                  {outcomeType === "dichotomous" ? (<><th className="pb-2 pr-2">Events</th><th className="pb-2 pr-2">Total</th></>)
                    : (<><th className="pb-2 pr-2">Mean</th><th className="pb-2 pr-2">SD</th><th className="pb-2 pr-2">Total</th></>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {arms.map((a) => (
                  <tr key={a._rowIndex}>
                    <td className="py-1 pr-2"><input type="text" value={a.study} onChange={e => setField(a._rowIndex, "study", e.target.value)} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1 w-28 text-white" /></td>
                    <td className="py-1 pr-2"><input type="text" value={a.treatment} onChange={e => setField(a._rowIndex, "treatment", e.target.value)} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1 w-20 text-white" /></td>
                    {outcomeType === "dichotomous" ? (
                      <>
                        <td className="py-1 pr-2"><input type="number" value={Number.isNaN(a.event) ? "" : a.event} onChange={e => setField(a._rowIndex, "event", e.target.value === "" ? NaN : Number(e.target.value))} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1 w-16 text-white" /></td>
                        <td className="py-1 pr-2"><input type="number" value={Number.isNaN(a.n) ? "" : a.n} onChange={e => setField(a._rowIndex, "n", e.target.value === "" ? NaN : Number(e.target.value))} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1 w-16 text-white" /></td>
                      </>
                    ) : (
                      <>
                        <td className="py-1 pr-2"><input type="number" step="0.1" value={Number.isNaN(a.mean) ? "" : a.mean} onChange={e => setField(a._rowIndex, "mean", e.target.value === "" ? NaN : Number(e.target.value))} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1 w-16 text-white" /></td>
                        <td className="py-1 pr-2"><input type="number" step="0.1" value={Number.isNaN(a.sd) ? "" : a.sd} onChange={e => setField(a._rowIndex, "sd", e.target.value === "" ? NaN : Number(e.target.value))} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1 w-16 text-white" /></td>
                        <td className="py-1 pr-2"><input type="number" value={Number.isNaN(a.n) ? "" : a.n} onChange={e => setField(a._rowIndex, "n", e.target.value === "" ? NaN : Number(e.target.value))} className="bg-[#0b0c10] border border-slate-800 rounded px-2 py-1 w-16 text-white" /></td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
