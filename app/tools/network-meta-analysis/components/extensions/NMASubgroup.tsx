"use client";

import { useState } from 'react';
import type { NMAArm, NMASubgroupResult } from '../../../../types/statistics';

interface NMASubgroupProps {
  studies: NMAArm[];
  onRun: (groups: string[]) => void;
  data: NMASubgroupResult | null;
  loading: boolean;
  error: string | null;
}

export default function NMASubgroup({ studies, onRun, data, loading, error }: NMASubgroupProps) {
  const allGroups = Array.from(new Set(studies.map(s => s.subgroup).filter((v): v is string => !!v)));
  const [selected, setSelected] = useState<string[]>(allGroups);

  if (allGroups.length === 0) {
    return (
      <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl">
        <h3 className="text-xl font-bold text-white mb-2">NMA Subgroup Analysis</h3>
        <p className="text-slate-500 text-sm">No subgroup variable detected in the uploaded dataset. Add an optional &quot;Subgroup&quot; column (e.g. Inpatient/Outpatient, Mild/Severe) to your data above to use this tool.</p>
      </div>
    );
  }
  if (allGroups.length < 2) {
    return (
      <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl">
        <h3 className="text-xl font-bold text-white mb-2">NMA Subgroup Analysis</h3>
        <p className="text-amber-300 text-sm">Only one subgroup category (&quot;{allGroups[0]}&quot;) was detected. Subgroup analysis cannot be performed with fewer than 2 categories.</p>
      </div>
    );
  }

  const toggle = (g: string) => setSelected(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);

  return (
    <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl space-y-6">
      <div>
        <h3 className="text-xl font-bold text-white">NMA Subgroup Analysis</h3>
        <p className="text-slate-500 text-xs mt-1 max-w-2xl">Fits a separate, fully valid network meta-analysis within each subgroup (same methodology, subgroup-filtered data) via netmeta&apos;s own subgroup() function.</p>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-2">Subgroup variable: <span className="text-white font-semibold">Subgroup</span> - Detected groups:</label>
        <div className="flex flex-wrap gap-2">
          {allGroups.map(g => (
            <label key={g} className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer border ${selected.includes(g) ? "bg-indigo-950/60 border-indigo-500 text-indigo-300" : "bg-[#0b0c10] border-slate-800 text-slate-400"}`}>
              <input type="checkbox" checked={selected.includes(g)} onChange={() => toggle(g)} className="mr-1.5" />{g}
            </label>
          ))}
        </div>
      </div>

      <button onClick={() => onRun(selected)} disabled={loading || selected.length < 2} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl shadow-lg">
        {loading ? "RUNNING..." : "RUN SUBGROUP ANALYSIS"}
      </button>

      {error && <div className="bg-red-950/80 border border-red-500/80 text-red-200 p-4 rounded-xl text-sm font-mono">{error}</div>}

      {data && (
        <div className="space-y-6 pt-4 border-t border-slate-800">
          {Object.entries(data.subgroup_results).map(([g, res]) => (
            <div key={g} className="bg-[#0b0c10] border border-slate-800 rounded-xl p-4 space-y-3">
              <h4 className="text-white font-bold text-sm uppercase tracking-wide">{g}</h4>
              {!res.available ? (
                <p className="text-amber-300 text-xs">{res.reason}</p>
              ) : (
                <>
                  <p className="text-slate-400 text-xs">Studies: {res.k} · Treatments: {res.n_treatments} ({res.trts.join(", ")}) · Tau²: {res.tau2 ?? "n/a"} · I²: {res.i2 != null ? `${(res.i2 * 100).toFixed(1)}%` : "n/a"}</p>
                  {res.ranking && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {res.ranking.map(r => <span key={r.treatment} className="px-2 py-1 bg-indigo-950/40 rounded text-indigo-300">#{r.rank} {r.treatment} (P={r.pscore})</span>)}
                    </div>
                  )}
                  {data.forest_plots[g] && (
                    <div className="bg-white p-3 rounded-xl mt-2"><img src={data.forest_plots[g]} className="w-full" alt={`${g} forest`} /></div>
                  )}
                </>
              )}
            </div>
          ))}

          <div className="bg-amber-950/30 border border-amber-600/40 rounded-xl p-4 text-xs text-amber-200">
            <strong>Between-Subgroup Comparison:</strong> {data.between_subgroup_comparison.note}
          </div>
          {data.between_subgroup_comparison.table.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead><tr className="border-b border-slate-800 text-slate-500 uppercase bg-black/40">
                  <th className="p-2">Comparison</th>{Object.keys(data.subgroup_results).map(g => <th key={g} className="p-2">{g}</th>)}
                </tr></thead>
                <tbody>{data.between_subgroup_comparison.table.map((row, i) => (
                  <tr key={i} className="border-b border-slate-800 bg-[#0b0c10]">
                    <td className="p-2 font-semibold text-white">{row.comparison}</td>
                    {Object.keys(data.subgroup_results).map(g => <td key={g} className="p-2">{row[g] ?? "—"}</td>)}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
