"use client";

import { useState } from 'react';
import type { NMAArm, NMASensitivityResult } from '../../../../types/statistics';

interface SensitivityPayload {
  method: string;
  alt_model?: string;
  alt_tau_method?: string;
  excluded_studies?: string[];
  criterion?: { type: string; min_year?: number; max_year?: number; exclude_value?: string };
}

function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows || rows.length === 0) return;
  const header = Object.keys(rows[0]);
  const csv = [header, ...rows.map(r => header.map(h => r[h]))].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

interface NMASensitivityProps {
  studies: NMAArm[];
  tauMethod: string;
  isCommon: boolean;
  onRun: (payload: SensitivityPayload) => void;
  data: NMASensitivityResult | null;
  loading: boolean;
  error: string | null;
}

export default function NMASensitivity({ studies, tauMethod, isCommon, onRun, data, loading, error }: NMASensitivityProps) {
  const [method, setMethod] = useState("exclude_studies");
  const [altModel, setAltModel] = useState(isCommon ? "Random-effects" : "Common-effect");
  const [altTau, setAltTau] = useState(tauMethod === "REML" ? "DL" : "REML");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [critType, setCritType] = useState("year_range");
  const [minYear, setMinYear] = useState("");
  const [maxYear, setMaxYear] = useState("");
  const [excludeSubgroupValue, setExcludeSubgroupValue] = useState("");

  const hasYear = studies.some(s => s.year != null);
  const hasSubgroup = studies.some(s => s.subgroup);
  const subgroupValues = Array.from(new Set(studies.map(s => s.subgroup).filter((v): v is string => !!v)));
  const studyIds = Array.from(new Set(studies.map(s => s.study)));

  const buildSensitivityPayload = () => {
    if (method === "alt_model") return { method, alt_model: altModel };
    if (method === "alt_tau") return { method, alt_tau_method: altTau };
    if (method === "exclude_studies") return { method, excluded_studies: excluded };
    if (method === "exclude_criterion") {
      if (critType === "year_range") return { method, criterion: { type: "year_range", min_year: Number(minYear), max_year: Number(maxYear) } };
      return { method, criterion: { type: "subgroup_value", exclude_value: excludeSubgroupValue } };
    }
    return { method };
  };

  const toggleStudy = (id: string) => setExcluded(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  return (
    <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl space-y-6">
      <div>
        <h3 className="text-xl font-bold text-white">NMA Sensitivity Analysis</h3>
        <p className="text-slate-500 text-xs mt-1 max-w-2xl">Tests whether the network&apos;s conclusions are robust to a specific, predefined change - not a different statistical method, just the same netmeta() fit re-run with one thing altered.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Sensitivity Method:</label>
          <select value={method} onChange={e => setMethod(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
            <option value="exclude_studies">Exclude Selected Studies</option>
            <option value="alt_model">Alternative Model (Common ↔ Random)</option>
            {!isCommon && <option value="alt_tau">Alternative Tau² Estimator</option>}
            {(hasYear || hasSubgroup) && <option value="exclude_criterion">Exclude by Criterion</option>}
          </select>
        </div>

        {method === "alt_model" && (
          <div>
            <label className="block text-xs text-slate-400 mb-1">Alternative Model:</label>
            <select value={altModel} onChange={e => setAltModel(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
              <option value="Random-effects">Random-effects</option>
              <option value="Common-effect">Common-effect</option>
            </select>
          </div>
        )}

        {method === "alt_tau" && (
          <div>
            <label className="block text-xs text-slate-400 mb-1">Alternative Tau² Estimator:</label>
            <select value={altTau} onChange={e => setAltTau(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
              {["DL", "ML", "REML"].filter(t => t !== tauMethod).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}

        {method === "exclude_criterion" && (
          <div className="space-y-2">
            <label className="block text-xs text-slate-400 mb-1">Criterion Type:</label>
            <select value={critType} onChange={e => setCritType(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
              {hasYear && <option value="year_range">Keep only studies within a Year range</option>}
              {hasSubgroup && <option value="subgroup_value">Exclude a Subgroup category</option>}
            </select>
            {critType === "year_range" && (
              <div className="flex gap-2">
                <input type="number" placeholder="Min year" value={minYear} onChange={e => setMinYear(e.target.value)} className="bg-[#0b0c10] border border-slate-800 rounded-lg p-2 text-sm text-white w-1/2" />
                <input type="number" placeholder="Max year" value={maxYear} onChange={e => setMaxYear(e.target.value)} className="bg-[#0b0c10] border border-slate-800 rounded-lg p-2 text-sm text-white w-1/2" />
              </div>
            )}
            {critType === "subgroup_value" && (
              <select value={excludeSubgroupValue} onChange={e => setExcludeSubgroupValue(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                <option value="">Select value to exclude...</option>
                {subgroupValues.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            )}
          </div>
        )}
      </div>

      {method === "exclude_studies" && (
        <div>
          <label className="block text-xs text-slate-400 mb-2">Select studies to exclude:</label>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {studyIds.map(id => (
              <label key={id} className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer border ${excluded.includes(id) ? "bg-red-950/60 border-red-600 text-red-300" : "bg-[#0b0c10] border-slate-800 text-slate-400"}`}>
                <input type="checkbox" checked={excluded.includes(id)} onChange={() => toggleStudy(id)} className="mr-1.5" />{id}
              </label>
            ))}
          </div>
        </div>
      )}

      <button onClick={() => onRun(buildSensitivityPayload())} disabled={loading} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl shadow-lg">
        {loading ? "RUNNING..." : "RUN SENSITIVITY ANALYSIS"}
      </button>

      {error && <div className="bg-red-950/80 border border-red-500/80 text-red-200 p-4 rounded-xl text-sm font-mono">{error}</div>}

      {data && (
        <div className="space-y-6 pt-4 border-t border-slate-800">
          <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-lg p-3 text-xs text-slate-300 space-y-1">
            <div><strong>Primary model:</strong> {data.settings_used.primary.model}, tau²={data.settings_used.primary.tau_method}</div>
            <div><strong>Sensitivity model:</strong> {data.settings_used.sensitivity.model}, tau²={data.settings_used.sensitivity.tau_method}</div>
            {data.settings_used.excluded_studies.length > 0 && <div><strong>Excluded studies:</strong> {data.settings_used.excluded_studies.join(", ")}</div>}
          </div>

          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="bg-[#0b0c10] border border-slate-800 rounded-xl p-4">
              <h4 className="text-white font-semibold text-xs mb-2">PRIMARY NMA</h4>
              <p className="text-slate-400 text-xs">Studies: {data.primary_summary.k} · Treatments: {data.primary_summary.n_treatments} · Tau²: {data.primary_summary.tau2 ?? "n/a"}</p>
            </div>
            <div className="bg-[#0b0c10] border border-slate-800 rounded-xl p-4">
              <h4 className="text-white font-semibold text-xs mb-2">SENSITIVITY NMA</h4>
              <p className="text-slate-400 text-xs">Studies: {data.sensitivity_summary.k} · Treatments: {data.sensitivity_summary.n_treatments} · Tau²: {data.sensitivity_summary.tau2 ?? "n/a"}</p>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={() => downloadCSV(data.comparison_table, "nma-sensitivity-comparison.csv")} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg shadow">Download Comparison CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead><tr className="border-b border-slate-800 text-slate-500 uppercase bg-black/40"><th className="p-2">Comparison</th><th className="p-2">Primary</th><th className="p-2">Sensitivity</th></tr></thead>
              <tbody>{data.comparison_table.map((r, i) => (
                <tr key={i} className="border-b border-slate-800 bg-[#0b0c10]"><td className="p-2 font-semibold text-white">{r.comparison}</td><td className="p-2">{r.primary}</td><td className="p-2">{r.sensitivity}</td></tr>
              ))}</tbody>
            </table>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white p-3 rounded-xl"><img src={data.primary_forest_base64} className="w-full" alt="Primary forest" /></div>
            <div className="bg-white p-3 rounded-xl"><img src={data.sensitivity_forest_base64} className="w-full" alt="Sensitivity forest" /></div>
          </div>
        </div>
      )}
    </div>
  );
}
