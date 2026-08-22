"use client";

// Final NMA Evidence Report - assembles the ALREADY-COMPUTED results of
// every other tab into one structured document. It does not recompute or
// refit anything, and does not generate narrative claims beyond what the
// actual settings/results/researcher assessments already state.

import type {
  NMAArm, NMAAnalyzeResult, NMADiagnosticsResult, NMAFunnelResult,
  NMASensitivityResult, NMASubgroupResult, NMAMetaRegressionResult,
} from '../../../../types/statistics';
import LeagueTable from '../LeagueTable';
import TreatmentRanking from '../TreatmentRanking';
import type { TransitivityRow, CertaintyRow, ConcernLevel } from './evidenceTypes';
import { downloadCSVFile, downloadXLSXFile } from './evidenceTypes';

interface FinalEvidenceReportProps {
  sessionId: string;
  arms: NMAArm[];
  outcomeType: string;
  effectMeasure: string;
  model: string;
  tauMethod: string;
  referenceTreatment: string;
  results: NMAAnalyzeResult | null;
  diagnostics: NMADiagnosticsResult | null;
  funnelData: NMAFunnelResult | null;
  sensData: NMASensitivityResult | null;
  subgroupData: NMASubgroupResult | null;
  metaregData: NMAMetaRegressionResult | null;
  transitivityRows: TransitivityRow[];
  transitivityOverall: ConcernLevel;
  transitivityNotes: string;
  certaintyRows: CertaintyRow[];
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-[#0b0c10] border border-slate-800 rounded-xl p-5 space-y-3 print:break-inside-avoid">
      <h4 className="text-white font-bold text-sm">{n}. {title}</h4>
      <div className="text-sm text-slate-300 space-y-2">{children}</div>
    </section>
  );
}

const NA = <span className="text-slate-600 italic">Not available - this analysis step has not been run yet.</span>;

export default function FinalEvidenceReport(props: FinalEvidenceReportProps) {
  const {
    sessionId, arms, outcomeType, effectMeasure, model, tauMethod, referenceTreatment,
    results, diagnostics, funnelData, sensData, subgroupData, metaregData,
    transitivityRows, transitivityOverall, transitivityNotes, certaintyRows,
  } = props;

  if (!results) {
    return (
      <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl">
        <h3 className="text-xl font-bold text-white mb-2">Final NMA Evidence Report</h3>
        <p className="text-slate-500 text-sm">Run NMA Core first - the report assembles its results rather than re-fitting the network.</p>
      </div>
    );
  }

  // Rebind to a local const so TypeScript's null-narrowing above survives
  // into the nested exportSummary closure defined below (a destructured
  // function-parameter binding doesn't retain narrowing across closures).
  const nmaResults = results;
  const treatments = nmaResults.treatments;
  const studyCount = new Set(arms.map(a => a.study)).size;

  function exportSummary(format: "csv" | "xlsx") {
    const results = nmaResults;
    const header = ["Section", "Value"];
    const rows: (string | number)[][] = [
      ["Analysis session ID", sessionId],
      ["Studies", studyCount],
      ["Treatments", treatments.join(", ")],
      ["Participants", results.summary.n_participants],
      ["Outcome type", outcomeType],
      ["Effect measure", effectMeasure],
      ["Model", model],
      ["Tau² method", model === "Random-effects" ? tauMethod : "n/a (common-effect model)"],
      ["Reference treatment", referenceTreatment],
      ["Multi-arm studies", results.summary.n_multiarm_studies],
      ["Max arms in a single study", results.summary.max_arms],
      ["Network connected", results.summary.connected ? "Yes" : "No"],
      ["Tau²", results.summary.tau2 ?? "n/a"],
      ["I²", results.summary.i2 != null ? `${(results.summary.i2 * 100).toFixed(1)}%` : "n/a"],
      ["Network inconsistency (design-based)", diagnostics?.global_inconsistency?.interpretation ?? "Not computed - run NMA Diagnostics"],
      ["Small-study/publication-bias test", funnelData?.small_study_effect_test?.available ? `${funnelData.small_study_effect_test.method}: statistic=${funnelData.small_study_effect_test.statistic}, p=${funnelData.small_study_effect_test.pval}` : "Not computed - run Comparison-adjusted Funnel"],
      ["Sensitivity analysis", sensData ? "Computed - see NMA Sensitivity tab" : "Not computed"],
      ["Subgroup analysis", subgroupData ? `Computed for: ${Object.keys(subgroupData.subgroup_results).join(", ")}` : "Not computed"],
      ["Meta-regression", metaregData ? metaregData.model_specification : "Not computed"],
      ["Transitivity - modifiers assessed", new Set(transitivityRows.map(r => r.modifier)).size],
      ["Transitivity - overall researcher assessment", transitivityOverall],
      ["Transitivity - notes", transitivityNotes],
      ["Certainty - comparisons assessed", certaintyRows.length],
      ["R package", "netmeta (R)"],
    ];
    if (format === "csv") downloadCSVFile("nma-final-evidence-report-summary.csv", header, rows);
    else downloadXLSXFile("nma-final-evidence-report-summary.xlsx", "Report Summary", header, rows);
  }

  return (
    <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl space-y-6 print:bg-white print:text-black">
      <div className="flex justify-between items-start flex-wrap gap-3 print:hidden">
        <div>
          <h3 className="text-xl font-bold text-white">Final NMA Evidence Report</h3>
          <p className="text-slate-500 text-xs mt-1 max-w-2xl">
            Assembled entirely from the results already computed in the other tabs of this module - nothing here is
            re-fitted or invented. Tables/values not yet computed are explicitly labeled as such rather than omitted
            silently.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportSummary("csv")} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg shadow">Download CSV</button>
          <button onClick={() => exportSummary("xlsx")} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg shadow">Download XLSX</button>
          <button onClick={() => window.print()} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg shadow">Print / Save as PDF</button>
        </div>
      </div>

      <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-lg p-3 text-xs text-slate-400 print:hidden">
        Analysis session ID: <span className="text-slate-300 font-mono">{sessionId}</span> · Generated: {new Date().toLocaleString()}
      </div>

      <div className="grid gap-4">
        <Section n={1} title="Data">
          <p>{studyCount} studies, {arms.length} treatment-arm rows uploaded by the researcher (CSV/XLSX/paste). Outcome type: {outcomeType}.</p>
        </Section>

        <Section n={2} title="Network">
          <p>{results.summary.n_treatments} treatments, {results.summary.n_treatment_arms} treatment arms, {results.summary.n_direct_comparisons} direct pairwise comparisons. Network connectivity: <strong>{results.summary.connected ? "Connected" : "Disconnected"}</strong>. {results.summary.connectivity_note}</p>
        </Section>

        <Section n={3} title="Population">
          <p>{results.summary.n_participants.toLocaleString()} participants across {studyCount} studies. No additional population-level detail is captured by this application beyond study-level effect-modifier columns (see Transitivity Assessment).</p>
        </Section>

        <Section n={4} title="Intervention / Comparator Structure">
          <p>Treatments compared: {treatments.join(", ")}. Reference treatment: <strong>{referenceTreatment}</strong>. {results.summary.n_multiarm_studies} multi-arm stud{results.summary.n_multiarm_studies === 1 ? "y" : "ies"} (max {results.summary.max_arms} arms in a single study).</p>
        </Section>

        <Section n={5} title="Outcome">
          <p>{outcomeType === "continuous" ? "Continuous" : "Dichotomous"} outcome, analyzed on the {effectMeasure} scale.</p>
        </Section>

        <Section n={6} title="Effect Measure">
          <p>{effectMeasure}</p>
        </Section>

        <Section n={7} title="Statistical Model">
          <p>{model}{model === "Random-effects" ? ` (tau² estimator: ${tauMethod})` : ""}, fitted via the R <code>netmeta</code> package (graph-theoretical / weighted-least-squares NMA).</p>
        </Section>

        <Section n={8} title="Heterogeneity">
          {results.summary.tau2 != null
            ? <p>tau² = {results.summary.tau2}, I² = {results.summary.i2 != null ? `${(results.summary.i2 * 100).toFixed(1)}%` : "n/a"} (network-level, common heterogeneity variance assumption).</p>
            : NA}
        </Section>

        <Section n={9} title="Network Consistency / Inconsistency">
          {diagnostics
            ? <>
                <p>{diagnostics.global_inconsistency.interpretation}</p>
                {diagnostics.node_splitting.table && diagnostics.node_splitting.table.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead><tr className="text-slate-500 uppercase border-b border-slate-800"><th className="p-1">Comparison</th><th className="p-1">Direct</th><th className="p-1">Indirect</th><th className="p-1">Diff p</th></tr></thead>
                      <tbody>{diagnostics.node_splitting.table.map((r, i) => (
                        <tr key={i} className="border-b border-slate-800/60"><td className="p-1">{r.comparison}</td><td className="p-1">{r.direct_estimate} [{r.direct_lower}; {r.direct_upper}]</td><td className="p-1">{r.evaluable ? `${r.indirect_estimate} [${r.indirect_lower}; ${r.indirect_upper}]` : "n/a"}</td><td className="p-1">{r.diff_p ?? "n/a"}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </>
            : NA}
        </Section>

        <Section n={10} title="Direct / Indirect Evidence">
          {diagnostics?.node_splitting?.table
            ? <p>Per-comparison direct/indirect breakdown shown in Section 9 (Node Splitting) above; see also the Certainty Assessment tab for the same figures organized per comparison alongside domain judgments.</p>
            : NA}
        </Section>

        <Section n={11} title="Treatment Effects (League Table)">
          <LeagueTable leagueTable={results.league_table} effectMeasure={effectMeasure} />
        </Section>

        <Section n={12} title="Treatment Ranking">
          <TreatmentRanking ranking={results.ranking} />
        </Section>

        <Section n={13} title="Small-Study / Publication-Bias Assessment">
          {funnelData
            ? <p>{funnelData.interpretation} {funnelData.small_study_effect_test.available ? `(${funnelData.small_study_effect_test.method}: statistic=${funnelData.small_study_effect_test.statistic}, p=${funnelData.small_study_effect_test.pval})` : `Not available: ${funnelData.small_study_effect_test.unavailable_reason}`}</p>
            : NA}
        </Section>

        <Section n={14} title="Sensitivity Analysis">
          {sensData
            ? <p>Method: {sensData.settings_used.method}. Primary model: k={sensData.primary_summary.k}, tau²={sensData.primary_summary.tau2 ?? "n/a"}. Sensitivity model: k={sensData.sensitivity_summary.k}, tau²={sensData.sensitivity_summary.tau2 ?? "n/a"}. Full comparison table available in the NMA Sensitivity tab.</p>
            : NA}
        </Section>

        <Section n={15} title="Subgroup Analysis">
          {subgroupData
            ? <p>Subgroup variable analyzed across: {Object.keys(subgroupData.subgroup_results).join(", ")}. {subgroupData.between_subgroup_comparison.note}</p>
            : NA}
        </Section>

        <Section n={16} title="Meta-Regression">
          {metaregData
            ? <p>{metaregData.model_specification} Covariate usable in {metaregData.covariate_summary.n_usable}/{metaregData.covariate_summary.n_studies_total} studies. {metaregData.interpretation}</p>
            : NA}
        </Section>

        <Section n={17} title="Transitivity Assessment">
          {transitivityRows.length > 0
            ? <>
                <p>{new Set(transitivityRows.map(r => r.modifier)).size} potential effect modifier(s) assessed across {new Set(transitivityRows.map(r => r.comparison)).size} comparison(s). Researcher overall assessment: <strong>{transitivityOverall}</strong>.</p>
                {transitivityNotes && <p className="italic text-slate-400">&quot;{transitivityNotes}&quot;</p>}
                <p className="text-xs text-slate-500">Full modifier-by-comparison table available in the Transitivity Assessment tab and its CSV/XLSX export.</p>
              </>
            : NA}
        </Section>

        <Section n={18} title="Certainty / Confidence Assessment">
          {certaintyRows.length > 0
            ? <>
                <p>{certaintyRows.length} comparison(s) assessed using the CINeMA-compatible assisted workflow.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead><tr className="text-slate-500 uppercase border-b border-slate-800"><th className="p-1">Comparison</th><th className="p-1">Overall (researcher)</th></tr></thead>
                    <tbody>{certaintyRows.map(r => (
                      <tr key={r.comparison} className="border-b border-slate-800/60"><td className="p-1">{r.comparison}</td><td className="p-1">{r.overall}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500">Full per-domain assessment available in the Certainty Assessment tab and its CSV/XLSX export.</p>
              </>
            : NA}
        </Section>

        <Section n={19} title="Limitations">
          <ul className="list-disc list-inside space-y-1 text-slate-400 text-xs">
            <li>Transitivity assessment is based only on effect-modifier columns actually present in the uploaded dataset; absence of an imbalance signal does not confirm transitivity.</li>
            <li>Certainty/confidence domain ratings (within-study bias, reporting bias, indirectness, and the qualitative components of imprecision/heterogeneity/incoherence) are researcher judgments recorded through a CINeMA-compatible assisted workflow, not an automated CINeMA score.</li>
            <li>Network heterogeneity (tau², I²) is reported at the network level under netmeta&apos;s common heterogeneity-variance assumption, not per individual comparison.</li>
            <li>{results.summary.connectivity_note}</li>
            {!diagnostics && <li>NMA Diagnostics has not been run - inconsistency/node-splitting information is not included above.</li>}
            {!funnelData && <li>Comparison-adjusted funnel plot has not been run - small-study-effect assessment is not included above.</li>}
          </ul>
        </Section>
      </div>
    </div>
  );
}
