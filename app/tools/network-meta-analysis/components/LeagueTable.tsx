"use client";

import type { NMALeagueTable } from '../../../types/statistics';

export default function LeagueTable({ leagueTable, effectMeasure }: { leagueTable: NMALeagueTable | null; effectMeasure: string }) {
  if (!leagueTable) return null;
  const { rownames, matrix } = leagueTable;

  const downloadCSV = () => {
    const header = ["", ...rownames];
    const rows = matrix.map((row, i) => [rownames[i], ...row]);
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "nma-league-table.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <p className="text-slate-400 text-sm">Row treatment vs. column treatment ({effectMeasure} [95% CI]). Diagonal is blank. {leagueTable.reference_note}</p>
        <button onClick={downloadCSV} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg shadow whitespace-nowrap">Download CSV</button>
      </div>
      <div className="overflow-x-auto">
        <table className="text-left text-xs text-slate-300 border-collapse min-w-full">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500 uppercase bg-black/40">
              <th className="p-2 sticky left-0 bg-black/40"></th>
              {rownames.map(t => <th key={t} className="p-2 whitespace-nowrap">{t}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i} className="border-b border-slate-800 bg-[#0b0c10]">
                <td className="p-2 font-bold text-white sticky left-0 bg-[#0b0c10] whitespace-nowrap">{rownames[i]}</td>
                {row.map((cell, j) => (
                  <td key={j} className={`p-2 whitespace-nowrap ${i === j ? "text-slate-600" : "text-slate-200"}`}>{i === j ? "—" : cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
