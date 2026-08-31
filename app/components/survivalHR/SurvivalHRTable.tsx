"use client";

// Shared editable input table for survival/time-to-event (Hazard Ratio)
// data, reused identically by the Forest Plot, Funnel Plot, and Sensitivity
// Analysis tools' "Survival (HR)" tab. Accepts data exactly as it's usually
// reported in a paper (HR + 95% CI) OR already-computed ln(HR) + SE(ln HR)
// - whichever the user has - and shows the resolved {ln(HR), SE} used for
// every row so nothing is a black box. The derivation itself lives in
// app/lib/survivalHR/conversion.ts (pure, unit-tested); this component is
// purely presentational/input-handling.
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Plus, Trash2, Upload } from "lucide-react";
import { deriveEffect, describeUnresolvedReason, emptyHRRow, type HRStudyRow } from "@/app/lib/survivalHR/conversion";

let idCounter = 0;
const nextId = () => `hr-${Date.now()}-${idCounter++}`;

interface Props {
  rows: HRStudyRow[];
  onChange: (rows: HRStudyRow[]) => void;
}

function parseNum(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Accepts either 3 columns (Study, HR, CI Lower, CI Upper) or 5+ columns
 *  (...plus ln(HR), SE(ln HR)) per row - matching how these are commonly
 *  extracted, with or without the log-scale values already computed. */
function parseHRRows(cells: unknown[][]): HRStudyRow[] {
  return cells
    .filter((c) => c.some((v) => String(v ?? "").trim() !== ""))
    .map((c) => ({
      id: nextId(),
      study: String(c[0] ?? "").replace(/['"]+/g, "").trim(),
      hr: parseNum(c[1]),
      ciLower: parseNum(c[2]),
      ciUpper: parseNum(c[3]),
      lnHR: parseNum(c[4]),
      seLnHR: parseNum(c[5]),
    }))
    .filter((r) => r.study !== "");
}

export default function SurvivalHRTable({ rows, onChange }: Props) {
  const [pasteData, setPasteData] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function updateRow(id: string, patch: Partial<HRStudyRow>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeRow(id: string) {
    onChange(rows.filter((r) => r.id !== id));
  }
  function addRow() {
    onChange([...rows, emptyHRRow(nextId())]);
  }

  function importPaste() {
    if (!pasteData.trim()) return;
    const cells = pasteData.trim().split("\n").map((line) => line.split("\t"));
    const parsed = parseHRRows(cells);
    if (parsed.length > 0) {
      onChange(parsed);
      setPasteData("");
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isXlsx = /\.xlsx?$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      let cells: unknown[][];
      if (isXlsx) {
        const wb = XLSX.read(event.target?.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const allRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
        cells = allRows.slice(1); // drop header row
      } else {
        const text = String(event.target?.result ?? "");
        cells = text.split("\n").slice(1).map((l) => l.split(","));
      }
      const parsed = parseHRRows(cells);
      if (parsed.length > 0) onChange(parsed);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    if (isXlsx) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  }

  function downloadSample() {
    const header = "Study,HR,95% CI Lower,95% CI Upper,ln(HR),SE (lnHR)\n";
    const body = [
      "Trial A 2020,0.65,0.45,0.94,,",
      "Trial B 2021,0.72,0.50,1.03,,",
      "Trial C 2022,,,,-0.55,0.21",
    ].join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "survival-hr-sample.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="space-y-4">
      <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-4 text-xs text-slate-300 space-y-1">
        <p className="font-semibold text-indigo-300">Two ways to enter each study - use whichever your extraction sheet has:</p>
        <p>1. <strong className="text-white">HR + 95% CI</strong> (as reported in the paper) — ln(HR) and SE(ln HR) are derived automatically using the standard Cochrane formula.</p>
        <p>2. <strong className="text-white">ln(HR) + SE(ln HR)</strong> directly, if already computed — used exactly as entered, never re-derived.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Paste rows (tab-separated): Study, HR, CI Lower, CI Upper, [ln(HR)], [SE lnHR]</label>
          <textarea rows={3} value={pasteData} onChange={(e) => setPasteData(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2 text-xs text-slate-200 mb-2" placeholder="Trial A 2020&#9;0.65&#9;0.45&#9;0.94" />
          <button onClick={importPaste} className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg">Import Pasted Data</button>
        </div>
        <div className="space-y-2">
          <label className="block text-xs text-slate-400 mb-1">Or upload CSV / Excel (header row: Study, HR, 95% CI Lower, 95% CI Upper, ln(HR), SE (lnHR))</label>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-900/40 file:text-indigo-300 cursor-pointer" />
          <button onClick={downloadSample} className="inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-indigo-200">
            <Upload size={12} /> Download sample template
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300 border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500 uppercase bg-black/40">
              <th className="p-2">Study</th>
              <th className="p-2">HR</th>
              <th className="p-2">95% CI Lower</th>
              <th className="p-2">95% CI Upper</th>
              <th className="p-2">ln(HR)</th>
              <th className="p-2">SE (lnHR)</th>
              <th className="p-2">Resolved ln(HR) / SE</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const derived = deriveEffect(r);
              const issue = describeUnresolvedReason(r);
              return (
                <tr key={r.id} className="border-b border-slate-800 bg-[#0b0c10]">
                  <td className="p-1"><input value={r.study} onChange={(e) => updateRow(r.id, { study: e.target.value })} className="w-32 bg-transparent border border-slate-800 rounded px-2 py-1 text-white" /></td>
                  {(["hr", "ciLower", "ciUpper", "lnHR", "seLnHR"] as const).map((field) => (
                    <td className="p-1" key={field}>
                      <input
                        type="number"
                        step="any"
                        value={r[field] ?? ""}
                        onChange={(e) => updateRow(r.id, { [field]: e.target.value === "" ? null : Number(e.target.value) } as Partial<HRStudyRow>)}
                        className="w-20 bg-transparent border border-slate-800 rounded px-2 py-1 text-white"
                      />
                    </td>
                  ))}
                  <td className="p-2 whitespace-nowrap">
                    {derived ? (
                      <span className="text-emerald-400">
                        {derived.te.toFixed(4)} / {derived.se.toFixed(4)} <span className="text-slate-500">({derived.source === "direct" ? "direct" : "from CI"})</span>
                      </span>
                    ) : (
                      <span className="text-rose-400" title={issue ?? undefined}>Unresolved</span>
                    )}
                  </td>
                  <td className="p-1"><button onClick={() => removeRow(r.id)} className="text-slate-500 hover:text-rose-400"><Trash2 size={14} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.some((r) => describeUnresolvedReason(r) !== null) && (
        <div className="bg-rose-950/40 border border-rose-600/50 rounded-lg p-3 text-rose-300 text-xs space-y-1">
          {rows
            .filter((r) => describeUnresolvedReason(r) !== null)
            .map((r) => (
              <p key={r.id}>
                <strong>{r.study || "(unnamed study)"}:</strong> {describeUnresolvedReason(r)}
              </p>
            ))}
        </div>
      )}

      <button onClick={addRow} className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-200">
        <Plus size={13} /> Add study
      </button>
    </div>
  );
}
