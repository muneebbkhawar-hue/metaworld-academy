"use client";

// Certainty / Confidence Assessment - a CINeMA-COMPATIBLE ASSISTED
// ASSESSMENT WORKFLOW, not a full automated CINeMA implementation.
//
// WHY: CINeMA (Confidence In Network Meta-Analysis) is a specific,
// published methodology from the University of Bern. There is no CRAN R
// package that reproduces its domain-rating algorithm (verified against
// the R environment this app actually uses - netmeta 3.4.0 plus meta,
// metafor, robvis, etc.; no "cinema"/"CINeMA" package is installed or
// available), and several of its six domains (within-study bias, reporting
// bias, indirectness, and part of imprecision/heterogeneity/incoherence)
// are explicitly defined by CINeMA's own methodology as requiring
// structured REVIEWER judgment informed by the evidence, not a formula.
// Recreating "CINeMA" with invented numerical weights or p-value
// thresholds would misrepresent the actual methodology, so this tool does
// not do that.
//
// Instead, this component:
//   1. Auto-populates every domain with the real, already-computed NMA
//      evidence relevant to it (CATEGORY A - automatically derived: the
//      NMA estimate/CI, number of studies, direct/indirect evidence split,
//      network heterogeneity, and per-comparison inconsistency p-value
//      where available from the existing /analyze and /diagnostics
//      results).
//   2. Presents CINeMA's own six domains with CINeMA's own rating
//      vocabulary (No concerns / Some concerns / Major concerns).
//   3. Requires the researcher to make the actual judgment call per domain
//      (CATEGORY B), with free-text justification.
//   4. Never auto-computes an "Overall confidence" grade - CINeMA derives
//      the overall GRADE-style rating (High/Moderate/Low/Very low) by
//      starting at "High" and downgrading per domain according to
//      reviewer judgment of severity, which is itself a qualitative
//      synthesis step CINeMA assigns to the reviewer, not a formula this
//      tool can safely automate. The researcher sets it explicitly.

import { useMemo, useState } from 'react';
import type { NMAAnalyzeResult, NMADiagnosticsResult } from '../../../../types/statistics';
import {
  CERTAINTY_DOMAINS, CINEMA_DOMAIN_RATINGS, OVERALL_CERTAINTY_LEVELS,
  type CertaintyDomainKey, type CertaintyRow, type CinemaDomainRating, type OverallCertainty,
  emptyCertaintyDomains, downloadCSVFile, downloadXLSXFile,
} from './evidenceTypes';

function parseLeagueCell(cell: string): { estimate: string; lower: string; upper: string } | null {
  const m = cell.match(/^(-?\d+\.?\d*)\s*\((-?\d+\.?\d*);\s*(-?\d+\.?\d*)\)$/);
  if (!m) return null;
  return { estimate: m[1], lower: m[2], upper: m[3] };
}

function canonicalKey(a: string, b: string): string {
  return [a, b].sort((x, y) => x.localeCompare(y)).join(" vs ");
}

interface LeagueComparison { key: string; a: string; b: string; estimate: string; lower: string; upper: string }

function leagueComparisons(results: NMAAnalyzeResult): LeagueComparison[] {
  const { rownames, matrix } = results.league_table;
  const out: LeagueComparison[] = [];
  for (let i = 0; i < rownames.length; i++) {
    for (let j = i + 1; j < rownames.length; j++) {
      const cell = matrix[i]?.[j];
      const parsed = cell ? parseLeagueCell(cell) : null;
      if (parsed) out.push({ key: canonicalKey(rownames[i], rownames[j]), a: rownames[i], b: rownames[j], ...parsed });
    }
  }
  return out.sort((x, y) => x.key.localeCompare(y.key));
}

interface CertaintyAssessmentProps {
  results: NMAAnalyzeResult | null;
  diagnostics: NMADiagnosticsResult | null;
  rows: CertaintyRow[];
  setRows: (rows: CertaintyRow[]) => void;
}

export default function CertaintyAssessment({ results, diagnostics, rows, setRows }: CertaintyAssessmentProps) {
  const [outcomeName, setOutcomeName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clinicallyImportant, setClinicallyImportant] = useState<Set<string>>(new Set());
  const [viewFilter, setViewFilter] = useState<"all" | "selected" | "important">("all");

  const comparisons = useMemo(() => (results ? leagueComparisons(results) : []), [results]);

  const nodeSplitByKey = useMemo(() => {
    const map = new Map<string, NonNullable<NMADiagnosticsResult["node_splitting"]["table"]>[number]>();
    diagnostics?.node_splitting?.table?.forEach(r => {
      const [a, b] = r.comparison.split(/:| vs /).map(s => s.trim());
      if (a && b) map.set(canonicalKey(a, b), r);
    });
    return map;
  }, [diagnostics]);

  const networkInconsistencyNote = useMemo(() => {
    const between = diagnostics?.global_inconsistency?.table?.find(r => r.component === "Between designs");
    if (!between) return null;
    return `Network-level (design-based) inconsistency: Q=${between.Q}, df=${between.df}, p=${between.pval ?? "n/a"}.`;
  }, [diagnostics]);

  const outcomeLabel = useMemo(() => {
    if (!results) return "";
    const base = `${results.summary.outcome_type === "continuous" ? "Continuous" : "Dichotomous"} outcome (${results.summary.effect_measure})`;
    return outcomeName.trim() ? `${outcomeName.trim()} — ${base}` : base;
  }, [results, outcomeName]);

  function toggleSet(set: Set<string>, key: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    setter(next);
  }

  function addSelectedToTable() {
    if (!results) return;
    const keysToAdd = comparisons.filter(c => selected.has(c.key)).length > 0
      ? comparisons.filter(c => selected.has(c.key))
      : comparisons; // if nothing explicitly checked yet, add all - convenience for a first pass
    const next = [...rows];
    keysToAdd.forEach(c => {
      const ns = nodeSplitByKey.get(c.key);
      const heterogeneityNote = results.summary.i2 != null
        ? `Network I² = ${(results.summary.i2 * 100).toFixed(1)}%, tau² = ${results.summary.tau2 != null ? results.summary.tau2.toExponential(2) : "n/a"} (common heterogeneity variance across the network under the ${results.summary.model} model).`
        : "Not available.";
      const incoherenceParts = [
        ns ? `Comparison-level (node-splitting): direct vs indirect difference p = ${ns.diff_p ?? "n/a"}${ns.evaluable ? "" : " (not independently evaluable)"}.` : "Comparison-level node-splitting result not available - run NMA Diagnostics first.",
        networkInconsistencyNote,
      ].filter(Boolean);
      const idx = next.findIndex(r => r.comparison === c.key);
      const row: CertaintyRow = {
        comparison: c.key,
        automated: {
          comparison: c.key,
          outcome: outcomeLabel,
          estimate: c.estimate,
          ciLower: c.lower,
          ciUpper: c.upper,
          nStudies: ns ? ns.k_direct_studies : null,
          directEvidence: ns ? `${ns.direct_estimate} [${ns.direct_lower}; ${ns.direct_upper}] (k=${ns.k_direct_studies} direct studies)` : "Not available - run NMA Diagnostics for a direct/indirect breakdown.",
          indirectEvidence: ns && ns.evaluable ? `${ns.indirect_estimate} [${ns.indirect_lower}; ${ns.indirect_upper}]` : (ns ? "Not independently evaluable for this comparison." : "Not available - run NMA Diagnostics for a direct/indirect breakdown."),
          heterogeneityNote,
          incoherenceNote: incoherenceParts.join(" "),
        },
        domains: idx >= 0 ? next[idx].domains : emptyCertaintyDomains(),
        overall: idx >= 0 ? next[idx].overall : "Not assessed",
        overallNotes: idx >= 0 ? next[idx].overallNotes : "",
        assessedAt: idx >= 0 ? next[idx].assessedAt : null,
      };
      if (idx >= 0) next[idx] = row; else next.push(row);
    });
    setRows(next);
  }

  function updateDomain(comparison: string, domain: CertaintyDomainKey, patch: Partial<{ rating: CinemaDomainRating; notes: string }>) {
    setRows(rows.map(r => r.comparison === comparison
      ? { ...r, domains: { ...r.domains, [domain]: { ...r.domains[domain], ...patch } }, assessedAt: r.assessedAt ?? new Date().toISOString() }
      : r));
  }

  function updateOverall(comparison: string, patch: Partial<{ overall: OverallCertainty; overallNotes: string }>) {
    setRows(rows.map(r => r.comparison === comparison ? { ...r, ...patch } : r));
  }

  function removeRow(comparison: string) {
    setRows(rows.filter(r => r.comparison !== comparison));
  }

  const visibleRows = rows.filter(r => {
    if (viewFilter === "selected") return selected.has(r.comparison);
    if (viewFilter === "important") return clinicallyImportant.has(r.comparison);
    return true;
  });

  function exportRows(format: "csv" | "xlsx") {
    const header = [
      "Comparison", "Outcome", "NMA Estimate", "95% CI Lower", "95% CI Upper", "Studies",
      "Within-study bias", "Reporting bias", "Indirectness", "Imprecision", "Heterogeneity", "Incoherence",
      "Overall Confidence (RESEARCHER ASSESSMENT)", "Comments",
    ];
    const body = rows.map(r => [
      r.comparison, r.automated.outcome, r.automated.estimate ?? "", r.automated.ciLower ?? "", r.automated.ciUpper ?? "", r.automated.nStudies ?? "",
      r.domains.withinStudyBias.rating, r.domains.reportingBias.rating, r.domains.indirectness.rating,
      r.domains.imprecision.rating, r.domains.heterogeneity.rating, r.domains.incoherence.rating,
      r.overall, r.overallNotes,
    ]);
    if (format === "csv") downloadCSVFile("nma-certainty-assessment.csv", header, body);
    else downloadXLSXFile("nma-certainty-assessment.xlsx", "Certainty", header, body);
  }

  if (!results) {
    return (
      <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl">
        <h3 className="text-xl font-bold text-white mb-2">Certainty / Confidence Assessment</h3>
        <p className="text-slate-500 text-sm">Run NMA Core first - this tool assembles its results rather than re-fitting the network.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl space-y-6">
      <div>
        <h3 className="text-xl font-bold text-white">Certainty / Confidence Assessment</h3>
        <p className="text-slate-500 text-xs mt-1 max-w-3xl">
          A <strong className="text-slate-300">CINeMA-compatible assisted assessment workflow</strong> (see code comments for why full
          automated CINeMA scoring is not implemented - no CINeMA R package exists in this environment, and several
          domains are methodologically defined as reviewer judgments). <span className="text-indigo-300">CATEGORY A</span> fields below
          are auto-populated from your actual NMA results; <span className="text-amber-300">CATEGORY B</span> domain ratings are entered by you.
        </p>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Outcome name (optional label for the report):</label>
        <input type="text" value={outcomeName} onChange={e => setOutcomeName(e.target.value)} placeholder="e.g. All-cause mortality" className="w-full md:w-96 bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white" />
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-slate-400">Comparisons ({comparisons.length} total from the league table):</label>
        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto bg-[#0b0c10] border border-slate-800 rounded-lg p-3">
          {comparisons.map(c => (
            <label key={c.key} className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer border flex items-center gap-2 ${selected.has(c.key) ? "bg-indigo-950/60 border-indigo-500 text-indigo-300" : "bg-[#151722] border-slate-800 text-slate-400"}`}>
              <input type="checkbox" checked={selected.has(c.key)} onChange={() => toggleSet(selected, c.key, setSelected)} />
              {c.key}
              <button type="button" onClick={(e) => { e.preventDefault(); toggleSet(clinicallyImportant, c.key, setClinicallyImportant); }} title="Mark as clinically important" className={clinicallyImportant.has(c.key) ? "text-amber-400" : "text-slate-600"}>★</button>
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-500">Check comparisons to select them; click the star to mark a comparison as clinically important (a researcher-defined label used only to filter the table below, not a computed property).</p>
        <button onClick={addSelectedToTable} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl shadow-lg">
          Add / Update Selected Comparisons in Certainty Table
        </button>
      </div>

      {rows.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div>
              <label className="text-xs text-slate-400 mr-2">Show:</label>
              <select value={viewFilter} onChange={e => setViewFilter(e.target.value as typeof viewFilter)} className="bg-[#0b0c10] border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white">
                <option value="all">All comparisons</option>
                <option value="selected">Selected comparisons</option>
                <option value="important">Clinically important comparisons</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => exportRows("csv")} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg shadow">Download CSV</button>
              <button onClick={() => exportRows("xlsx")} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg shadow">Download XLSX</button>
            </div>
          </div>

          {visibleRows.map(r => (
            <div key={r.comparison} className="bg-[#0b0c10] border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-start flex-wrap gap-3">
                <h4 className="text-white font-bold text-sm">{r.comparison}{clinicallyImportant.has(r.comparison) && <span className="text-amber-400 ml-2" title="Clinically important">★</span>}</h4>
                <button onClick={() => removeRow(r.comparison)} className="text-red-400 hover:text-red-300 text-xs">Remove</button>
              </div>

              <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-lg p-3">
                <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-wider mb-2">Category A — Automatically Derived</p>
                <div className="grid md:grid-cols-3 gap-3 text-xs text-slate-300">
                  <div><span className="text-slate-500 block">Outcome</span>{r.automated.outcome}</div>
                  <div><span className="text-slate-500 block">NMA estimate [95% CI]</span>{r.automated.estimate} [{r.automated.ciLower}; {r.automated.ciUpper}]</div>
                  <div><span className="text-slate-500 block">Direct-comparison studies</span>{r.automated.nStudies ?? "n/a"}</div>
                  <div className="md:col-span-3"><span className="text-slate-500 block">Direct evidence</span>{r.automated.directEvidence}</div>
                  <div className="md:col-span-3"><span className="text-slate-500 block">Indirect evidence</span>{r.automated.indirectEvidence}</div>
                  <div className="md:col-span-3"><span className="text-slate-500 block">Heterogeneity (network-level)</span>{r.automated.heterogeneityNote}</div>
                  <div className="md:col-span-3"><span className="text-slate-500 block">Incoherence</span>{r.automated.incoherenceNote}</div>
                </div>
              </div>

              <div>
                <p className="text-amber-300 text-[10px] font-bold uppercase tracking-wider mb-2">Category B — Researcher Assessment (domain ratings)</p>
                <div className="grid md:grid-cols-2 gap-3">
                  {CERTAINTY_DOMAINS.map(d => (
                    <div key={d.key} className="bg-[#151722] border border-slate-800 rounded-lg p-3">
                      <label className="block text-xs text-slate-300 font-semibold mb-1">{d.label}</label>
                      <select value={r.domains[d.key].rating} onChange={e => updateDomain(r.comparison, d.key, { rating: e.target.value as CinemaDomainRating })} className="w-full bg-[#0b0c10] border border-slate-700 rounded px-2 py-1.5 text-xs text-white mb-1">
                        {CINEMA_DOMAIN_RATINGS.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                      <input type="text" value={r.domains[d.key].notes} onChange={e => updateDomain(r.comparison, d.key, { notes: e.target.value })} placeholder="Justification / notes…" className="w-full bg-[#0b0c10] border border-slate-700 rounded px-2 py-1 text-xs text-white" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3 items-start pt-2 border-t border-slate-800">
                <div>
                  <label className="block text-xs text-amber-300 font-semibold mb-1">Overall confidence (RESEARCHER ASSESSMENT — not auto-calculated)</label>
                  <select value={r.overall} onChange={e => updateOverall(r.comparison, { overall: e.target.value as OverallCertainty })} className="w-full bg-[#0b0c10] border border-slate-700 rounded-lg px-2 py-2 text-sm text-white">
                    {OVERALL_CERTAINTY_LEVELS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Comments</label>
                  <input type="text" value={r.overallNotes} onChange={e => updateOverall(r.comparison, { overallNotes: e.target.value })} className="w-full bg-[#0b0c10] border border-slate-700 rounded-lg px-2 py-2 text-sm text-white" />
                </div>
              </div>
              {r.assessedAt && <p className="text-[10px] text-slate-600">First assessed: {new Date(r.assessedAt).toLocaleString()}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
