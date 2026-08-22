"use client";

import type { NMADiagnosticsResult } from '../../../../types/statistics';

type GlobalInconsistencyData = NMADiagnosticsResult["global_inconsistency"];

export default function GlobalInconsistency({ data }: { data: GlobalInconsistencyData | null }) {
  if (!data) return null;
  if (data.unavailable_reason) {
    return <div className="bg-amber-950/40 border border-amber-600/50 rounded-xl p-4 text-amber-300 text-sm">Global inconsistency could not be computed: {data.unavailable_reason}</div>;
  }
  const table = data.table ?? [];
  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-xs">{data.method}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300 border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500 uppercase bg-black/40">
              <th className="p-3">Component</th><th className="p-3">Q</th><th className="p-3">df</th><th className="p-3">p-value</th>
            </tr>
          </thead>
          <tbody>
            {table.map((r, i) => (
              <tr key={i} className={`border-b border-slate-800 ${r.component === "Between designs" ? "bg-indigo-950/40 font-semibold text-white" : "bg-[#0b0c10]"}`}>
                <td className="p-3">{r.component}</td>
                <td className="p-3">{r.Q}</td>
                <td className="p-3">{r.df}</td>
                <td className="p-3">{r.pval != null ? r.pval : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-4 text-sm text-slate-200">{data.interpretation}</div>
    </div>
  );
}
