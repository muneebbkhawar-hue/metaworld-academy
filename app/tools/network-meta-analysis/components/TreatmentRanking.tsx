"use client";

import type { NMARankingRow } from '../../../types/statistics';

export default function TreatmentRanking({ ranking }: { ranking: NMARankingRow[] | null }) {
  if (!ranking) return null;
  const downloadCSV = () => {
    const header = ["Rank", "Treatment", "P-score"];
    const rows = ranking.map(r => [r.rank, r.treatment, r.pscore]);
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "nma-treatment-ranking.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-4">
      <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-4 text-xs text-slate-300">
        The P-score summarizes each treatment&apos;s ranking relative to all others under the frequentist NMA framework (Rücker &amp; Schwarzer, 2015) - it is <strong>not</strong> the probability that a treatment is the single best option. Larger P-score = more favorable ranking.
      </div>
      <div className="flex justify-end">
        <button onClick={downloadCSV} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg shadow">Download CSV</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300 border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500 uppercase bg-black/40">
              <th className="p-3">Rank</th><th className="p-3">Treatment</th><th className="p-3">P-score</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((r) => (
              <tr key={r.treatment} className={`border-b border-slate-800 ${r.rank === 1 ? "bg-indigo-950/40 font-bold text-white" : "bg-[#0b0c10]"}`}>
                <td className="p-3">{r.rank}</td>
                <td className="p-3">{r.treatment}</td>
                <td className="p-3 text-indigo-400">{r.pscore.toFixed(4)}</td>
                <td className="p-3 w-1/3">
                  <div className="bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div className="bg-indigo-500 h-2" style={{ width: `${r.pscore * 100}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
