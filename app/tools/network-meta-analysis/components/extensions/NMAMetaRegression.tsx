"use client";

import type { NMAArm, NMAMetaRegressionResult } from '../../../../types/statistics';

interface NMAMetaRegressionProps {
  studies: NMAArm[];
  onRun: () => void;
  data: NMAMetaRegressionResult | null;
  loading: boolean;
  error: string | null;
}

export default function NMAMetaRegression({ studies, onRun, data, loading, error }: NMAMetaRegressionProps) {
  const hasYear = studies.some(s => s.year != null);

  if (!hasYear) {
    return (
      <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl">
        <h3 className="text-xl font-bold text-white mb-2">NMA Meta-Regression</h3>
        <p className="text-slate-500 text-sm">No eligible meta-regression covariate detected. Add an optional numeric &quot;Year&quot; column (or another study-level numeric value) to your uploaded data above to use this tool.</p>
      </div>
    );
  }

  const downloadCSV = () => {
    if (!data) return;
    const header = ["Term", "Type", "Estimate", "CI Lower", "CI Upper", "p-value"];
    const rows = data.coefficient_table.map(r => [r.term, r.type, r.estimate, r.ci_lower, r.ci_upper, r.pval]);
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "nma-metaregression.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-bold text-white">NMA Meta-Regression</h3>
          <p className="text-slate-500 text-xs mt-1 max-w-2xl">Network meta-regression on the covariate <strong className="text-slate-300">Year</strong>, via netmeta&apos;s own netmetareg() under the consistency model with independent treatment-by-covariate slopes.</p>
        </div>
        <button onClick={onRun} disabled={loading} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl shadow-lg whitespace-nowrap">
          {loading ? "RUNNING..." : "RUN META-REGRESSION"}
        </button>
      </div>

      {error && <div className="bg-red-950/80 border border-red-500/80 text-red-200 p-4 rounded-xl text-sm font-mono">{error}</div>}

      {data && (
        <div className="space-y-6 pt-4 border-t border-slate-800">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-[#0b0c10] p-3 rounded-xl border border-slate-800"><span className="text-xs text-slate-500 block">Studies (total)</span><span className="text-white font-bold">{data.covariate_summary.n_studies_total}</span></div>
            <div className="bg-[#0b0c10] p-3 rounded-xl border border-slate-800"><span className="text-xs text-slate-500 block">Usable</span><span className="text-white font-bold">{data.covariate_summary.n_usable}</span></div>
            <div className="bg-[#0b0c10] p-3 rounded-xl border border-slate-800"><span className="text-xs text-slate-500 block">Missing</span><span className="text-white font-bold">{data.covariate_summary.n_missing}</span></div>
            <div className="bg-[#0b0c10] p-3 rounded-xl border border-slate-800"><span className="text-xs text-slate-500 block">Range</span><span className="text-white font-bold">{data.covariate_summary.min}–{data.covariate_summary.max}</span></div>
          </div>

          {data.settings_used.studies_excluded_for_missing_covariate?.length > 0 && (
            <div className="bg-amber-950/40 border border-amber-600/50 rounded-lg p-3 text-xs text-amber-300">
              ⚠️ Excluded (missing Year): {data.settings_used.studies_excluded_for_missing_covariate.join(", ")}
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={downloadCSV} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg shadow">Download CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead><tr className="border-b border-slate-800 text-slate-500 uppercase bg-black/40">
                <th className="p-2">Term</th><th className="p-2">Type</th><th className="p-2">Estimate</th><th className="p-2">95% CI</th><th className="p-2">p-value</th>
              </tr></thead>
              <tbody>{data.coefficient_table.map((r, i) => (
                <tr key={i} className={`border-b border-slate-800 bg-[#0b0c10] ${r.type.includes("slope") && r.pval < 0.05 ? "border-l-2 border-l-amber-500" : ""}`}>
                  <td className="p-2 font-mono text-white">{r.term}</td>
                  <td className="p-2">{r.type}</td>
                  <td className="p-2">{r.estimate}</td>
                  <td className="p-2">[{r.ci_lower}; {r.ci_upper}]</td>
                  <td className="p-2">{r.pval}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>

          <div className="bg-[#0b0c10] border border-slate-800 rounded-xl p-4 text-xs text-slate-400">{data.model_specification}</div>
          <div className="bg-amber-950/30 border border-amber-600/40 rounded-xl p-4 text-xs text-amber-200">{data.interpretation}</div>
        </div>
      )}
    </div>
  );
}
