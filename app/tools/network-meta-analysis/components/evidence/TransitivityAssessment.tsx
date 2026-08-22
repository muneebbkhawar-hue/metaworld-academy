"use client";

// Transitivity Assessment.
//
// Transitivity is a clinical/methodological assumption about the NMA
// network, not something a single automated statistical test can prove.
// This tool therefore does NOT compute a "transitivity p-value" or any
// other invented statistic. It helps the researcher assess the assumption
// systematically by:
//   1. Detecting which study-level variables (effect modifiers) actually
//      exist in the uploaded dataset (never inventing one).
//   2. Computing real, transparent descriptive statistics (mean/median/SD/
//      range for continuous variables; counts/percentages for categorical
//      ones) of each selected modifier's distribution across treatment
//      comparisons.
//   3. Visualizing those distributions.
//   4. Recording the researcher's own concern rating and notes per
//      (modifier, comparison) pair - clearly labeled as a RESEARCHER
//      ASSESSMENT, never converted into a computed verdict.

import { useMemo, useState } from 'react';
import type { NMAArm } from '../../../../types/statistics';
import { BoxPlotChart, CategoricalBarChart, type BoxPlotDatum, type BarChartDatum } from './EvidenceCharts';
import {
  type ConcernLevel, CONCERN_LEVELS, type TransitivityRow, type VariableType,
  downloadCSVFile, downloadXLSXFile,
} from './evidenceTypes';

interface ComparisonInfo { key: string; treatments: [string, string]; studies: string[]; }

function computeComparisons(arms: NMAArm[]): ComparisonInfo[] {
  const byStudy = new Map<string, Set<string>>();
  arms.forEach(a => {
    if (!byStudy.has(a.study)) byStudy.set(a.study, new Set());
    byStudy.get(a.study)!.add(a.treatment);
  });
  const compMap = new Map<string, ComparisonInfo>();
  byStudy.forEach((treatments, study) => {
    const list = Array.from(treatments).sort();
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const key = `${list[i]} vs ${list[j]}`;
        if (!compMap.has(key)) compMap.set(key, { key, treatments: [list[i], list[j]], studies: [] });
        compMap.get(key)!.studies.push(study);
      }
    }
  });
  return Array.from(compMap.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function studyModifierValue(arms: NMAArm[], study: string, modifier: string): string | undefined {
  const arm = arms.find(a => a.study === study && a.covariates?.[modifier] !== undefined);
  return arm?.covariates?.[modifier];
}

function participantsForComparison(arms: NMAArm[], study: string, t1: string, t2: string): number {
  return arms
    .filter(a => a.study === study && (a.treatment === t1 || a.treatment === t2))
    .reduce((s, a) => s + (Number.isFinite(a.n) ? a.n : 0), 0);
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface TransitivityAssessmentProps {
  arms: NMAArm[];
  rows: TransitivityRow[];
  setRows: (rows: TransitivityRow[]) => void;
  overallConcern: ConcernLevel;
  setOverallConcern: (v: ConcernLevel) => void;
  overallNotes: string;
  setOverallNotes: (v: string) => void;
}

export default function TransitivityAssessment({
  arms, rows, setRows, overallConcern, setOverallConcern, overallNotes, setOverallNotes,
}: TransitivityAssessmentProps) {
  const modifiers = useMemo(
    () => Array.from(new Set(arms.flatMap(a => (a.covariates ? Object.keys(a.covariates) : [])))).sort(),
    [arms]
  );
  const comparisons = useMemo(() => computeComparisons(arms), [arms]);

  const [selectedModifier, setSelectedModifier] = useState<string>("");
  const [selectedComparison, setSelectedComparison] = useState<string>("__all__");
  const [typeOverride, setTypeOverride] = useState<VariableType | null>(null);

  // Auto-detect continuous vs categorical from the actual values observed
  // for the selected modifier - not assumed just because a column exists.
  const detectedType: VariableType = useMemo(() => {
    if (!selectedModifier) return "categorical";
    const values = arms.map(a => a.covariates?.[selectedModifier]).filter((v): v is string => v !== undefined);
    if (values.length === 0) return "categorical";
    const allNumeric = values.every(v => v.trim() !== "" && Number.isFinite(Number(v)));
    return allNumeric ? "continuous" : "categorical";
  }, [arms, selectedModifier]);
  const effectiveType = typeOverride ?? detectedType;

  const displayedComparisons = selectedComparison === "__all__" ? comparisons : comparisons.filter(c => c.key === selectedComparison);

  function addOrUpdateModifierRows() {
    if (!selectedModifier) return;
    const next = [...rows];
    comparisons.forEach(comp => {
      const rawValues = comp.studies.map(s => studyModifierValue(arms, s, selectedModifier)).filter((v): v is string => v !== undefined);
      const missing = comp.studies.length - rawValues.length;
      const nParticipants = comp.studies.reduce((s, study) => s + participantsForComparison(arms, study, comp.treatments[0], comp.treatments[1]), 0);
      let summary: string;
      if (effectiveType === "continuous") {
        const nums = rawValues.map(Number).filter(Number.isFinite);
        if (nums.length === 0) {
          summary = "No numeric data available for this comparison.";
        } else {
          const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
          const sorted = [...nums].sort((a, b) => a - b);
          const sd = nums.length > 1 ? Math.sqrt(nums.reduce((s, v) => s + (v - mean) ** 2, 0) / (nums.length - 1)) : NaN;
          summary = `Mean ${mean.toFixed(2)}, Median ${median(sorted).toFixed(2)}, SD ${Number.isFinite(sd) ? sd.toFixed(2) : "n/a"}, Range ${sorted[0].toFixed(2)}–${sorted[sorted.length - 1].toFixed(2)} (n=${nums.length})`;
        }
      } else {
        const counts = new Map<string, number>();
        rawValues.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
        const total = rawValues.length;
        summary = total === 0
          ? "No categorical data available for this comparison."
          : Array.from(counts.entries()).map(([k, c]) => `${k}: ${c} (${((c / total) * 100).toFixed(0)}%)`).join("; ");
      }
      const idx = next.findIndex(r => r.modifier === selectedModifier && r.comparison === comp.key);
      const row: TransitivityRow = {
        modifier: selectedModifier, variableType: effectiveType, comparison: comp.key,
        nStudies: comp.studies.length, nParticipants: nParticipants || null, summary, missing,
        concern: idx >= 0 ? next[idx].concern : "Not assessed",
        notes: idx >= 0 ? next[idx].notes : "",
      };
      if (idx >= 0) next[idx] = row; else next.push(row);
    });
    setRows(next);
  }

  function updateRow(modifier: string, comparison: string, patch: Partial<TransitivityRow>) {
    setRows(rows.map(r => (r.modifier === modifier && r.comparison === comparison) ? { ...r, ...patch } : r));
  }

  function removeRow(modifier: string, comparison: string) {
    setRows(rows.filter(r => !(r.modifier === modifier && r.comparison === comparison)));
  }

  const chartData = useMemo(() => {
    if (!selectedModifier) return null;
    if (effectiveType === "continuous") {
      const data: BoxPlotDatum[] = displayedComparisons.map(comp => ({
        label: comp.key,
        values: comp.studies.map(s => Number(studyModifierValue(arms, s, selectedModifier))).filter(Number.isFinite),
      }));
      return { kind: "continuous" as const, data };
    }
    const data: BarChartDatum[] = displayedComparisons.map(comp => {
      const counts = new Map<string, number>();
      comp.studies.forEach(s => {
        const v = studyModifierValue(arms, s, selectedModifier);
        if (v !== undefined) counts.set(v, (counts.get(v) || 0) + 1);
      });
      return { label: comp.key, categories: Array.from(counts.entries()).map(([name, count]) => ({ name, count })) };
    });
    return { kind: "categorical" as const, data };
  }, [arms, selectedModifier, effectiveType, displayedComparisons]);

  const potentialConcerns = rows.filter(r => r.concern === "Some concern" || r.concern === "High concern").length;

  function exportRows(format: "csv" | "xlsx") {
    const header = ["Potential Effect Modifier", "Treatment Comparison", "Variable Type", "Number of Studies", "Number of Participants", "Summary/Distribution", "Missing Data (studies)", "Researcher Assessment", "Notes"];
    const body = rows.map(r => [r.modifier, r.comparison, r.variableType, r.nStudies, r.nParticipants ?? "n/a", r.summary, r.missing, r.concern, r.notes]);
    if (format === "csv") downloadCSVFile("nma-transitivity-assessment.csv", header, body);
    else downloadXLSXFile("nma-transitivity-assessment.xlsx", "Transitivity", header, body);
  }

  if (modifiers.length === 0) {
    return (
      <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl">
        <h3 className="text-xl font-bold text-white mb-2">Transitivity Assessment</h3>
        <p className="text-slate-500 text-sm">
          No potential effect-modifier columns were detected in the uploaded dataset. Add optional extra columns
          (e.g. Age, Sex, Baseline Severity, Follow-up Duration, Study Design) beyond the required Study/Treatment/
          outcome columns above to use this tool - nothing is invented if none are present.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl space-y-6">
      <div>
        <h3 className="text-xl font-bold text-white">Transitivity Assessment</h3>
        <p className="text-slate-500 text-xs mt-1 max-w-3xl">
          Transitivity is a clinical/methodological assumption - the plausibility that treatment comparisons can be
          combined indirectly because trials are otherwise sufficiently similar in effect-modifying characteristics.
          It cannot be confirmed by a single automated test. This tool computes real distribution statistics for
          effect modifiers actually present in your dataset and lets you record a structured, transparent
          <strong className="text-slate-300"> RESEARCHER ASSESSMENT</strong> per comparison.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Potential effect modifier:</label>
          <select value={selectedModifier} onChange={e => { setSelectedModifier(e.target.value); setTypeOverride(null); }} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
            <option value="">Select a variable…</option>
            {modifiers.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Treatment comparison:</label>
          <select value={selectedComparison} onChange={e => setSelectedComparison(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
            <option value="__all__">All comparisons</option>
            {comparisons.map(c => <option key={c.key} value={c.key}>{c.key}</option>)}
          </select>
        </div>
        {selectedModifier && (
          <div>
            <label className="block text-xs text-slate-400 mb-1">Variable type (auto-detected: {detectedType}):</label>
            <select value={effectiveType} onChange={e => setTypeOverride(e.target.value as VariableType)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
              <option value="continuous">Continuous</option>
              <option value="categorical">Categorical</option>
            </select>
          </div>
        )}
      </div>

      {selectedModifier && chartData && (
        chartData.kind === "continuous"
          ? <BoxPlotChart data={chartData.data} xLabel={selectedModifier} chartTitle={`${selectedModifier} distribution by comparison`} />
          : <CategoricalBarChart data={chartData.data} chartTitle={`${selectedModifier} distribution by comparison`} />
      )}

      {selectedModifier && (
        <button onClick={addOrUpdateModifierRows} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl shadow-lg">
          Add / Update &quot;{selectedModifier}&quot; in Assessment Table
        </button>
      )}

      {rows.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-800">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <h4 className="text-white font-semibold text-sm">Effect-Modifier Comparison Table</h4>
            <div className="flex gap-2">
              <button onClick={() => exportRows("csv")} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg shadow">Download CSV</button>
              <button onClick={() => exportRows("xlsx")} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg shadow">Download XLSX</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 uppercase bg-black/40">
                  <th className="p-2">Modifier</th><th className="p-2">Comparison</th><th className="p-2">k</th><th className="p-2">Summary</th><th className="p-2">Missing</th>
                  <th className="p-2">Researcher Assessment</th><th className="p-2">Notes</th><th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={`${r.modifier}__${r.comparison}`} className="border-b border-slate-800 bg-[#0b0c10] align-top">
                    <td className="p-2 font-semibold text-white whitespace-nowrap">{r.modifier}</td>
                    <td className="p-2 whitespace-nowrap">{r.comparison}</td>
                    <td className="p-2">{r.nStudies}</td>
                    <td className="p-2 max-w-xs">{r.summary}</td>
                    <td className="p-2">{r.missing}</td>
                    <td className="p-2">
                      <select value={r.concern} onChange={e => updateRow(r.modifier, r.comparison, { concern: e.target.value as ConcernLevel })} className="bg-[#151722] border border-slate-700 rounded px-2 py-1 text-white">
                        {CONCERN_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="p-2">
                      <input type="text" value={r.notes} onChange={e => updateRow(r.modifier, r.comparison, { notes: e.target.value })} placeholder="Free-text notes…" className="bg-[#151722] border border-slate-700 rounded px-2 py-1 text-white w-40" />
                    </td>
                    <td className="p-2"><button onClick={() => removeRow(r.modifier, r.comparison)} className="text-red-400 hover:text-red-300 text-xs">Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-5 space-y-3 mt-4">
            <h4 className="text-indigo-300 font-bold uppercase tracking-wider text-xs">Transitivity Summary</h4>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-300">
              <div>Potential effect modifiers assessed: <strong className="text-white">{new Set(rows.map(r => r.modifier)).size}</strong></div>
              <div>Potential concerns identified: <strong className="text-white">{potentialConcerns}</strong></div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Researcher overall assessment (RESEARCHER ASSESSMENT):</label>
              <select value={overallConcern} onChange={e => setOverallConcern(e.target.value as ConcernLevel)} className="w-full md:w-64 bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                {CONCERN_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Notes:</label>
              <textarea rows={3} value={overallNotes} onChange={e => setOverallNotes(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2 text-sm text-slate-200" placeholder="Free-text notes on the overall transitivity judgment…" />
            </div>
            <p className="text-xs text-slate-500 italic">
              Potential effect-modifier distributions should be considered when judging the plausibility of the transitivity assumption. This tool does not and cannot confirm transitivity automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
