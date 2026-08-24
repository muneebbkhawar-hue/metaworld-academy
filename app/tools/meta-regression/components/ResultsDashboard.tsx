"use client";

import * as XLSX from 'xlsx';
import type { MetaRegResult } from '../../../types/statistics';

function downloadCSV(filename: string, header: string[], rows: (string | number)[][]) {
  const esc = (c: string | number) => `"${String(c).replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map(r => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function downloadXLSX(filename: string, sheetName: string, header: string[], rows: (string | number)[][]) {
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

function downloadPNG(base64: string, filename: string) {
  const link = document.createElement("a");
  link.href = base64;
  link.download = filename;
  link.click();
}

function fmt(v: number | null | undefined): string {
  return v === null || v === undefined ? "n/a" : String(v);
}

// `filenamePrefix` keeps exports from different outcomes/moderators from
// overwriting each other when several ResultsDashboards are shown at once
// (e.g. "mortality_age" -> meta_regression_mortality_age_coefficients.csv).
// Defaults to the tool's original filenames for the single-outcome case, so
// existing behavior is unchanged when only one result is ever shown.
export default function ResultsDashboard({ data, filenamePrefix = "metareg" }: { data: MetaRegResult; filenamePrefix?: string }) {
  const coefHeader = ["Term", "Estimate", "SE", "CI Lower", "CI Upper", "Statistic", "Stat Type", "df", "p-value"];
  const coefRows = data.coefficients.map(c => [c.term, fmt(c.estimate), fmt(c.se), fmt(c.ci_lower), fmt(c.ci_upper), fmt(c.statistic), c.stat_type, fmt(c.df), fmt(c.pval)]);

  const exportResults = (format: "csv" | "xlsx") => {
    const settingsRows: (string | number)[][] = [
      ["Outcome type", data.settings_used.outcome_type],
      ["Effect measure", data.settings_used.effect_measure],
      ["Model", data.settings_used.model],
      ["Tau2 estimator", data.settings_used.tau_method],
      ["Confidence level", `${data.settings_used.ci_level}%`],
      ["Knapp-Hartung", data.settings_used.knha ? "Applied" : "Not applied"],
      ["Moderators", data.settings_used.moderators.map(m => m.type === "categorical" ? `${m.name} (ref: ${m.reference})` : m.name).join("; ")],
      ["R package", `${data.settings_used.r_package} ${data.settings_used.r_package_version}`],
      ["R function", data.settings_used.r_function],
      ["Model formula", data.model_formula],
      ["Studies included", data.data_summary.n_studies_included],
      ["Studies excluded", data.data_summary.n_studies_excluded],
    ];
    if (format === "csv") {
      downloadCSV(`${filenamePrefix}_settings.csv`, ["Setting", "Value"], settingsRows);
      downloadCSV(`${filenamePrefix}_coefficients.csv`, coefHeader, coefRows);
    } else {
      downloadXLSX(`${filenamePrefix}_results.xlsx`, "Analysis Settings", ["Setting", "Value"], settingsRows);
    }
  };

  return (
    <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h3 className="text-xl font-bold text-white">Meta-Regression Results</h3>
        <div className="flex gap-2">
          <button onClick={() => exportResults("csv")} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg shadow">Download CSV</button>
          <button onClick={() => exportResults("xlsx")} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg shadow">Download XLSX</button>
          <button onClick={() => downloadPNG(data.figure_base64, `${filenamePrefix}_figure.png`)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg shadow">Download Figure PNG</button>
        </div>
      </div>

      {/* 1. Analysis Settings (reproducibility) */}
      <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-lg p-4 text-xs text-slate-300 space-y-1">
        <p className="text-indigo-300 font-bold uppercase tracking-wider text-[10px] mb-2">Analysis Settings</p>
        <div className="grid md:grid-cols-2 gap-x-6 gap-y-1">
          <div>Outcome type: <strong className="text-white">{data.settings_used.outcome_type}</strong></div>
          <div>Effect measure: <strong className="text-white">{data.settings_used.effect_measure}</strong></div>
          <div>Model: <strong className="text-white">{data.settings_used.model}</strong></div>
          <div>τ² estimator: <strong className="text-white">{data.settings_used.tau_method}</strong></div>
          <div>Confidence level: <strong className="text-white">{data.settings_used.ci_level}%</strong></div>
          <div>Knapp-Hartung: <strong className="text-white">{data.settings_used.knha ? "Applied" : "Not applied"}</strong></div>
          <div className="md:col-span-2">R package/function: <strong className="text-white">{data.settings_used.r_package} {data.settings_used.r_package_version} — {data.settings_used.r_function}</strong></div>
          <div className="md:col-span-2">Moderators: <strong className="text-white">{data.settings_used.moderators.map(m => m.type === "categorical" ? `${m.name} (ref: ${m.reference})` : m.name).join(", ")}</strong></div>
        </div>
      </div>

      {/* Model formula */}
      <div className="bg-[#0b0c10] border border-slate-800 rounded-lg p-4">
        <p className="text-slate-500 text-xs mb-1">Fitted model</p>
        <code className="text-emerald-300 text-sm">{data.model_formula}</code>
      </div>

      {/* Data / exclusion summary */}
      <div className="bg-[#0b0c10] border border-slate-800 rounded-lg p-4 text-sm text-slate-300">
        <p className="text-slate-500 text-xs mb-1">Data Summary</p>
        <p>Studies included: <strong className="text-white">{data.data_summary.n_studies_included}</strong> · Studies excluded: <strong className="text-white">{data.data_summary.n_studies_excluded}</strong></p>
        {data.data_summary.excluded_studies.length > 0 && (
          <ul className="mt-2 text-xs text-amber-300 list-disc list-inside">
            {data.data_summary.excluded_studies.map(ex => <li key={ex.study}>{ex.study}: {ex.reason}</li>)}
          </ul>
        )}
      </div>

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-600/50 rounded-lg p-4 space-y-1">
          {data.warnings.map((w, i) => <p key={i} className="text-amber-200 text-xs">⚠️ {w}</p>)}
        </div>
      )}

      {/* Heterogeneity */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-[#0b0c10] border border-slate-800 rounded-xl p-4">
          <h4 className="text-white font-semibold text-xs mb-2">Overall Heterogeneity (no moderators)</h4>
          {data.overall_heterogeneity ? (
            <p className="text-xs text-slate-300">τ²={fmt(data.overall_heterogeneity.tau2)}, I²={fmt(data.overall_heterogeneity.i2)}%, H²={fmt(data.overall_heterogeneity.h2)}<br />
              Q({fmt(data.overall_heterogeneity.qe_df)})={fmt(data.overall_heterogeneity.qe)}, p={fmt(data.overall_heterogeneity.qe_p)}</p>
          ) : <p className="text-xs text-slate-500 italic">Not available.</p>}
        </div>
        <div className="bg-[#0b0c10] border border-slate-800 rounded-xl p-4">
          <h4 className="text-white font-semibold text-xs mb-2">Residual Heterogeneity (after moderators)</h4>
          <p className="text-xs text-slate-300">τ²={fmt(data.residual_heterogeneity.tau2)}, I²={fmt(data.residual_heterogeneity.i2)}%, H²={fmt(data.residual_heterogeneity.h2)}<br />
            Q({fmt(data.residual_heterogeneity.qe_df)})={fmt(data.residual_heterogeneity.qe)}, p={fmt(data.residual_heterogeneity.qe_p)}
            {data.r2 !== null && <><br />R² (heterogeneity explained): {data.r2}%</>}
          </p>
        </div>
      </div>

      {/* Moderator test */}
      <div className="bg-[#0b0c10] border border-slate-800 rounded-xl p-4">
        <h4 className="text-white font-semibold text-xs mb-1">{data.moderator_test.label}</h4>
        <p className="text-xs text-slate-300">
          {data.moderator_test.test_type}({fmt(data.moderator_test.df1)}{data.moderator_test.df2 !== null ? `, ${fmt(data.moderator_test.df2)}` : ""}) = {fmt(data.moderator_test.qm)}, p = {fmt(data.moderator_test.pval)}
        </p>
      </div>

      {/* Coefficient table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300 border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500 uppercase bg-black/40">
              <th className="p-2">Term</th><th className="p-2">Estimate</th><th className="p-2">SE</th><th className="p-2">95% CI</th><th className="p-2">{data.coefficients[0]?.stat_type === "t" ? "t" : "z"}</th><th className="p-2">df</th><th className="p-2">p-value</th>
            </tr>
          </thead>
          <tbody>
            {data.coefficients.map((c, i) => (
              <tr key={i} className="border-b border-slate-800 bg-[#0b0c10]">
                <td className="p-2 font-semibold text-white">{c.term}</td>
                <td className="p-2">{fmt(c.estimate)}</td>
                <td className="p-2">{fmt(c.se)}</td>
                <td className="p-2">[{fmt(c.ci_lower)}; {fmt(c.ci_upper)}]</td>
                <td className="p-2">{fmt(c.statistic)}</td>
                <td className="p-2">{fmt(c.df)}</td>
                <td className="p-2">{fmt(c.pval)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Figure */}
      <div className="bg-white p-4 rounded-xl shadow-inner flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.figure_base64} className="w-full max-w-4xl" alt={`Meta-regression ${data.figure_type} figure`} />
        <p className="text-slate-500 text-[10px] mt-2">
          {data.figure_type === "bubble" && "Bubble size reflects each study's inverse-variance weight in the fitted model."}
          {data.figure_type === "categorical" && "Diamonds show estimated coefficients (reference category = intercept) with confidence intervals."}
          {data.figure_type === "coefficient" && "Coefficient plot: estimates and confidence intervals for every term in the multivariable model."}
        </p>
      </div>

      {/* Diagnostics */}
      <div className="bg-[#0b0c10] border border-slate-800 rounded-xl p-4">
        <h4 className="text-white font-semibold text-xs mb-2">Diagnostics (Influence)</h4>
        {data.diagnostics.available ? (
          <>
            <p className="text-[10px] text-slate-500 mb-2">{data.diagnostics.method}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead><tr className="text-slate-500 uppercase border-b border-slate-800"><th className="p-1">Study</th><th className="p-1">Cook&apos;s D</th><th className="p-1">Hat</th><th className="p-1">DFFITS</th><th className="p-1">rstudent</th><th className="p-1">Flag</th></tr></thead>
                <tbody>
                  {data.diagnostics.table.map(row => (
                    <tr key={row.study} className={`border-b border-slate-800/60 ${row.influential ? "bg-amber-950/30" : ""}`}>
                      <td className="p-1">{row.study}</td><td className="p-1">{fmt(row.cooks_distance)}</td><td className="p-1">{fmt(row.hat)}</td><td className="p-1">{fmt(row.dffits)}</td><td className="p-1">{fmt(row.rstudent)}</td>
                      <td className="p-1">{row.influential ? <span className="text-amber-400 font-semibold">Potentially influential</span> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">Flags are informational only (metafor&apos;s own influence-diagnostic rule) - no study is automatically removed or re-fit.</p>
          </>
        ) : <p className="text-xs text-slate-500 italic">{data.diagnostics.unavailable_reason}</p>}
      </div>

      {/* Interpretation */}
      <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-4 text-sm text-slate-200">
        {data.interpretation}
      </div>
    </div>
  );
}
