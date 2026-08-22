"use client";

import type { NMAFunnelResult } from '../../../../types/statistics';

interface ComparisonAdjustedFunnelPlotProps {
  data: NMAFunnelResult | null;
  loading: boolean;
  error: string | null;
  onRun: () => void;
}

export default function ComparisonAdjustedFunnelPlot({ data, loading, error, onRun }: ComparisonAdjustedFunnelPlotProps) {
  const downloadPng = () => {
    if (!data?.plot_base64) return;
    const link = document.createElement("a");
    link.href = data.plot_base64;
    link.download = "nma-comparison-adjusted-funnel-plot.png";
    link.click();
  };

  return (
    <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-bold text-white">Comparison-Adjusted Funnel Plot</h3>
          <p className="text-slate-500 text-xs mt-1 max-w-2xl">This plot assesses small-study effects across treatment comparisons while accounting for the network structure. It reuses the same validated dataset and analysis settings already loaded above - no new upload needed.</p>
        </div>
        <button onClick={onRun} disabled={loading} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl shadow-lg whitespace-nowrap">
          {loading ? "GENERATING..." : data ? "RE-GENERATE" : "GENERATE FUNNEL PLOT"}
        </button>
      </div>

      {error && <div className="bg-red-950/80 border border-red-500/80 text-red-200 p-4 rounded-xl text-sm font-mono">{error}</div>}

      {data && (
        <div className="space-y-6">
          <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-lg p-3 text-xs text-slate-300">{data.settings_used.note} Comparisons plotted: {data.settings_used.n_comparisons_plotted}.</div>

          <div className="flex justify-end">
            <button onClick={downloadPng} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg shadow">Download PNG</button>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-inner flex justify-center overflow-x-auto">
            <img src={data.plot_base64} className="max-w-none" style={{ height: '560px' }} alt="Comparison-adjusted funnel plot" />
          </div>

          <div className="bg-[#0b0c10] border border-slate-800 rounded-xl p-4 space-y-2">
            <h4 className="text-white font-semibold text-sm">Small-Study-Effect Test</h4>
            {data.small_study_effect_test.available ? (
              <>
                <p className="text-xs text-slate-500">{data.small_study_effect_test.method}</p>
                <p className="text-sm text-slate-200">statistic = {data.small_study_effect_test.statistic}, p-value = {data.small_study_effect_test.pval}</p>
              </>
            ) : (
              <p className="text-sm text-amber-300">Not available: {data.small_study_effect_test.unavailable_reason}</p>
            )}
            <p className="text-xs text-amber-400 pt-1">⚠️ This is an NMA comparison-adjusted test, not an ordinary pairwise Egger test on raw study data - the two are not automatically equivalent.</p>
          </div>

          <div className="bg-amber-950/30 border border-amber-600/40 rounded-xl p-4 text-xs text-amber-200">{data.interpretation}</div>
        </div>
      )}
    </div>
  );
}
