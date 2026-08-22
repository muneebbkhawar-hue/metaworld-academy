"use client";

import { useState, type ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import type { MetaRegDataRow, OutcomeType } from '../lib/types';

// Positional column parsing - same convention as every other data-input
// tool in this app (TSA, NMA, Bias, Synthesis, Sensitivity): map the FIXED
// required columns by position, not header text, so a renamed header never
// silently breaks import. Any column beyond the fixed ones is captured
// generically as a potential moderator, keyed by its own header text -
// never invented if absent.
const FIXED_COLS: Record<OutcomeType, number> = { dichotomous: 5, continuous: 7, generic: 3 };

function rowsToData(headerRow: string[], dataRows: string[][], outcomeType: OutcomeType): MetaRegDataRow[] {
  const num = (v: unknown) => (v === undefined || v === "" ? NaN : Number(v as string));
  const fixedCols = FIXED_COLS[outcomeType];
  const moderatorCols: { index: number; name: string }[] = [];
  headerRow.forEach((h, i) => {
    if (i < fixedCols) return;
    if (h !== undefined && String(h).trim() !== "") moderatorCols.push({ index: i, name: String(h).trim() });
  });

  return dataRows.map((row, idx) => {
    const study = String(row[0] ?? "").trim();
    let moderators: Record<string, string> | undefined;
    if (moderatorCols.length > 0) {
      moderators = {};
      for (const c of moderatorCols) {
        const raw = row[c.index];
        if (raw !== undefined && String(raw).trim() !== "") moderators[c.name] = String(raw).trim();
      }
    }
    const base: MetaRegDataRow = { _rowIndex: idx, study, moderators };
    if (outcomeType === "dichotomous") {
      return { ...base, event_e: num(row[1]), n_e: num(row[2]), event_c: num(row[3]), n_c: num(row[4]) };
    }
    if (outcomeType === "continuous") {
      return { ...base, mean_e: num(row[1]), sd_e: num(row[2]), n_e: num(row[3]), mean_c: num(row[4]), sd_c: num(row[5]), n_c: num(row[6]) };
    }
    return { ...base, te: num(row[1]), se: num(row[2]) };
  }).filter(r => r.study);
}

export function buildSampleCSV(outcomeType: OutcomeType): string {
  if (outcomeType === "dichotomous") {
    const header = ["Study", "Events_E", "Total_E", "Events_C", "Total_C", "Age", "Region"];
    const rows = [
      ["Study 1", 10, 100, 20, 100, 45, "Europe"], ["Study 2", 15, 90, 25, 95, 52, "Asia"],
      ["Study 3", 8, 80, 18, 85, 38, "Europe"], ["Study 4", 12, 110, 22, 105, 60, "America"],
    ];
    return [header, ...rows].map(r => r.join(",")).join("\n");
  }
  if (outcomeType === "continuous") {
    const header = ["Study", "Mean_E", "SD_E", "Total_E", "Mean_C", "SD_C", "Total_C", "Dose", "Followup"];
    const rows = [
      ["Study 1", 5.2, 1.1, 40, 4.0, 1.0, 42, 10, 12], ["Study 2", 6.1, 1.3, 35, 4.5, 1.2, 38, 20, 24],
      ["Study 3", 7.0, 1.0, 50, 5.0, 1.1, 48, 30, 6], ["Study 4", 5.8, 1.2, 45, 4.2, 1.0, 44, 15, 18],
    ];
    return [header, ...rows].map(r => r.join(",")).join("\n");
  }
  const header = ["Study", "Effect", "SE", "Baseline_Risk"];
  const rows = [["Study 1", 0.5, 0.15, 20], ["Study 2", 0.3, 0.12, 35], ["Study 3", 0.8, 0.20, 10], ["Study 4", 0.6, 0.18, 25]];
  return [header, ...rows].map(r => r.join(",")).join("\n");
}

interface DataInputProps {
  outcomeType: OutcomeType;
  rows: MetaRegDataRow[];
  setRows: (rows: MetaRegDataRow[]) => void;
}

export default function DataInput({ outcomeType, rows, setRows }: DataInputProps) {
  const [pasteData, setPasteData] = useState("");

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
        const parsed: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
        headerRow = (parsed[0] || []) as string[];
        dataRows = parsed.slice(1).filter((r) => r.some((c) => c !== "")) as string[][];
      } else {
        const text = String(event.target?.result ?? "");
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
        headerRow = lines[0].split(",").map(c => c.replace(/['"]+/g, ''));
        dataRows = lines.slice(1).map(l => l.split(",").map(c => c.replace(/['"]+/g, '').trim()));
      }
      setRows(rowsToData(headerRow, dataRows, outcomeType));
    };
    if (isXlsx) reader.readAsArrayBuffer(file); else reader.readAsText(file);
  };

  const importPaste = () => {
    if (!pasteData.trim()) return;
    const lines = pasteData.trim().split(/\r?\n/);
    const headerRow = lines[0].split("\t");
    const dataRows = lines.slice(1).map(l => l.split("\t"));
    setRows(rowsToData(headerRow, dataRows, outcomeType));
    setPasteData("");
  };

  const downloadTemplate = () => {
    const csv = buildSampleCSV(outcomeType);
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `metareg-${outcomeType}-template.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const columnHelp: Record<OutcomeType, string> = {
    dichotomous: "Study, Events_E, Total_E, Events_C, Total_C",
    continuous: "Study, Mean_E, SD_E, Total_E, Mean_C, SD_C, Total_C",
    generic: "Study, Effect, SE",
  };

  return (
    <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 space-y-4">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <h3 className="text-white font-semibold text-sm">Upload your dataset (CSV / XLSX)</h3>
        <button onClick={downloadTemplate} className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded-lg whitespace-nowrap">Download Sample CSV Template</button>
      </div>
      <p className="text-slate-500 text-xs">
        Columns (by position): {columnHelp[outcomeType]}. One row per study.
        {" "}Any additional column (e.g. Age, Region, Dose, Follow-up) is picked up automatically as a potential moderator you can select below.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-900/40 file:text-indigo-300 cursor-pointer" />
        <div>
          <textarea rows={2} value={pasteData} onChange={e => setPasteData(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2 text-xs text-slate-200 mb-2" placeholder="Paste tab-separated rows, first row = header" />
          <button onClick={importPaste} className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg">Import Pasted Data</button>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="pt-4 border-t border-slate-800 space-y-2">
          <h4 className="text-white font-semibold text-xs">Review Data ({rows.length} studies)</h4>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="text-slate-500 uppercase sticky top-0 bg-[#151722]">
                <tr>
                  <th className="pb-2 pr-2">Study</th>
                  {outcomeType === "dichotomous" && <><th className="pb-2 pr-2">Events_E</th><th className="pb-2 pr-2">Total_E</th><th className="pb-2 pr-2">Events_C</th><th className="pb-2 pr-2">Total_C</th></>}
                  {outcomeType === "continuous" && <><th className="pb-2 pr-2">Mean_E</th><th className="pb-2 pr-2">SD_E</th><th className="pb-2 pr-2">Total_E</th><th className="pb-2 pr-2">Mean_C</th><th className="pb-2 pr-2">SD_C</th><th className="pb-2 pr-2">Total_C</th></>}
                  {outcomeType === "generic" && <><th className="pb-2 pr-2">Effect</th><th className="pb-2 pr-2">SE</th></>}
                  <th className="pb-2 pr-2">Moderator columns detected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {rows.map((r) => (
                  <tr key={r._rowIndex}>
                    <td className="py-1 pr-2 text-white">{r.study}</td>
                    {outcomeType === "dichotomous" && <><td className="py-1 pr-2">{r.event_e}</td><td className="py-1 pr-2">{r.n_e}</td><td className="py-1 pr-2">{r.event_c}</td><td className="py-1 pr-2">{r.n_c}</td></>}
                    {outcomeType === "continuous" && <><td className="py-1 pr-2">{r.mean_e}</td><td className="py-1 pr-2">{r.sd_e}</td><td className="py-1 pr-2">{r.n_e}</td><td className="py-1 pr-2">{r.mean_c}</td><td className="py-1 pr-2">{r.sd_c}</td><td className="py-1 pr-2">{r.n_c}</td></>}
                    {outcomeType === "generic" && <><td className="py-1 pr-2">{r.te}</td><td className="py-1 pr-2">{r.se}</td></>}
                    <td className="py-1 pr-2 text-slate-400">{r.moderators ? Object.entries(r.moderators).map(([k, v]) => `${k}=${v}`).join(", ") : "—"}</td>
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
