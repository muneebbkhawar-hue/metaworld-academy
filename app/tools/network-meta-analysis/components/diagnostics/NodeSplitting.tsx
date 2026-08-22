"use client";

import type { NMADiagnosticsResult } from '../../../../types/statistics';

type NodeSplittingData = NMADiagnosticsResult["node_splitting"];
type NodeSplittingRow = NonNullable<NodeSplittingData["table"]>[number];

function downloadTable(rows: NodeSplittingRow[], filename: string) {
  const header = ["Comparison", "k (direct studies)", "Proportion direct", "Direct estimate", "Direct 95% CI", "Indirect estimate", "Indirect 95% CI", "Difference (p-value)", "Evaluable"];
  const body = rows.map(r => [
    r.comparison, r.k_direct_studies, r.proportion_direct, r.direct_estimate,
    `[${r.direct_lower}; ${r.direct_upper}]`,
    r.evaluable ? r.indirect_estimate : "N/A",
    r.evaluable ? `[${r.indirect_lower}; ${r.indirect_upper}]` : "N/A",
    r.diff_p != null ? r.diff_p : "N/A", r.evaluable ? "Yes" : "No"
  ]);
  const csv = [header, ...body].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function NodeSplitting({ data }: { data: NodeSplittingData | null }) {
  if (!data) return null;
  if (data.unavailable_reason) {
    return <div className="bg-amber-950/40 border border-amber-600/50 rounded-xl p-4 text-amber-300 text-sm">Node splitting could not be computed: {data.unavailable_reason}</div>;
  }
  const table = data.table ?? [];
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <p className="text-slate-400 text-xs max-w-3xl">{data.method} Comparisons marked &quot;not evaluable&quot; lack sufficient independent indirect evidence in the network to compute a separate indirect estimate.</p>
        <button onClick={() => downloadTable(table, "nma-node-splitting.csv")} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg shadow whitespace-nowrap">Download CSV</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300 border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500 uppercase bg-black/40">
              <th className="p-2">Comparison</th><th className="p-2">k</th><th className="p-2">Direct</th><th className="p-2">Indirect</th><th className="p-2">Difference p-value</th>
            </tr>
          </thead>
          <tbody>
            {table.map((r, i) => (
              <tr key={i} className={`border-b border-slate-800 bg-[#0b0c10] ${r.diff_p != null && r.diff_p < 0.05 ? "border-l-2 border-l-red-500" : ""}`}>
                <td className="p-2 font-semibold text-white">{r.comparison}</td>
                <td className="p-2">{r.k_direct_studies}</td>
                <td className="p-2">{r.direct_estimate} [{r.direct_lower}; {r.direct_upper}]</td>
                <td className="p-2">{r.evaluable ? `${r.indirect_estimate} [${r.indirect_lower}; ${r.indirect_upper}]` : <span className="text-slate-600 italic">not evaluable</span>}</td>
                <td className={`p-2 ${r.diff_p != null && r.diff_p < 0.05 ? "text-red-400 font-semibold" : ""}`}>{r.evaluable ? (r.diff_p ?? "—") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">Rows highlighted red have a direct-vs-indirect disagreement p-value &lt; 0.05, suggesting local inconsistency at that comparison specifically.</p>
    </div>
  );
}
