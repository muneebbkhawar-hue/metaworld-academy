"use client";

import type { NMADiagnosticsResult } from '../../../../types/statistics';

export default function ContributionMatrix({ data }: { data: NMADiagnosticsResult["contribution_matrix"] | null }) {
  if (!data) return null;
  if (data.unavailable_reason) {
    return <div className="bg-amber-950/40 border border-amber-600/50 rounded-xl p-4 text-amber-300 text-sm">Contribution matrix could not be computed: {data.unavailable_reason}</div>;
  }
  const downloadPng = () => {
    const link = document.createElement("a");
    link.href = data.plot_base64 ?? "";
    link.download = "nma-contribution-matrix.png";
    link.click();
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-slate-400 text-sm">{data.method}</p>
        <button onClick={downloadPng} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg shadow whitespace-nowrap ml-4">Download PNG</button>
      </div>
      <div className="bg-white p-4 rounded-xl shadow-inner flex justify-center overflow-x-auto">
        <img src={data.plot_base64} className="max-w-none" style={{ height: '520px' }} alt="Contribution matrix" />
      </div>
    </div>
  );
}
