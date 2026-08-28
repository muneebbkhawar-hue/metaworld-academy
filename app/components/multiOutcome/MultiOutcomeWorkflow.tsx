"use client";

// Shared upload -> detect -> select -> run workflow for the multi-outcome
// wide-format extraction sheet, reused by Forest Plot, Funnel Plot, and
// Sensitivity/LOO. Each tool owns its own R-calling and results-rendering
// (different endpoints, different plot types) - this component's job ends
// at "here are the outcomes the user selected, please run them."
import { useState, type ChangeEvent } from "react";
import type { DetectedOutcome, DichStudyRow, ContStudyRow, OutcomeDataType } from "@/app/lib/multiOutcome/types";
import { parseWideFormatWorkbook } from "@/app/lib/multiOutcome/wideFormatParser";
import { readWorkbookRows } from "@/app/lib/multiOutcome/readWorkbookRows";
import { downloadDichotomousSample, downloadContinuousSample } from "@/app/lib/multiOutcome/sampleTemplate";
import { MIN_STUDIES_FOR_ANALYSIS } from "@/app/lib/multiOutcome/types";
import type { OutcomeBatchProgress } from "@/app/lib/multiOutcome/batch";

export type BatchProgressInfo = OutcomeBatchProgress;

interface Props {
  type: OutcomeDataType;
  expLabel: string;
  ctrlLabel: string;
  onExpLabelChange: (v: string) => void;
  onCtrlLabelChange: (v: string) => void;
  onRunSelected: (outcomes: DetectedOutcome[]) => void;
  running: boolean;
  progress: BatchProgressInfo | null;
  /** Label for the run button, e.g. "Run Forest Plots" / "Run Funnel Plots" / "Run Leave-One-Out" */
  runLabel: string;
  /** Minimum eligible studies required for an outcome to be selectable - defaults to MIN_STUDIES_FOR_ANALYSIS (2). Sensitivity/LOO passes 3, matching this tool's existing single-outcome minimum (removing 1 study from a 2-study set leaves nothing to pool). */
  minStudies?: number;
}

export default function MultiOutcomeWorkflow({ type, expLabel, ctrlLabel, onExpLabelChange, onCtrlLabelChange, onRunSelected, running, progress, runLabel, minStudies = MIN_STUDIES_FOR_ANALYSIS }: Props) {
  const [outcomes, setOutcomes] = useState<DetectedOutcome[] | null>(null);
  const [fatalErrors, setFatalErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedExclusions, setExpandedExclusions] = useState<Set<string>>(new Set());
  const [expandedPreview, setExpandedPreview] = useState<Set<string>>(new Set());
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setOutcomes(null);
    setFatalErrors([]);
    setWarnings([]);
    try {
      const rows = await readWorkbookRows(file);
      const result = parseWideFormatWorkbook(rows, type, expLabel || "Experimental", ctrlLabel || "Control");
      setFatalErrors(result.fatalErrors);
      setWarnings(result.warnings);
      setOutcomes(result.outcomes);
      setFileName(file.name);
      setSelected(new Set(result.outcomes.filter((o) => o.eligibleStudies.length >= minStudies).map((o) => o.name)));
    } catch (err) {
      setFatalErrors([err instanceof Error ? err.message : "Could not read this file."]);
    } finally {
      setParsing(false);
      e.target.value = "";
    }
  }

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleExpanded(name: string) {
    setExpandedExclusions((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function togglePreview(name: string) {
    setExpandedPreview((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const selectableOutcomes = outcomes?.filter((o) => o.eligibleStudies.length >= minStudies) ?? [];
  const allSelected = selectableOutcomes.length > 0 && selectableOutcomes.every((o) => selected.has(o.name));

  return (
    <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 space-y-5">
      <h3 className="text-white font-semibold text-sm">Multi-Outcome Extraction Sheet</h3>
      <p className="text-xs text-slate-400">
        Upload one workbook containing every outcome for this project. Each outcome is detected and analyzed independently - a study
        missing data for one outcome is still included in every other outcome it has complete data for.
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Experimental group name</label>
          <input type="text" value={expLabel} onChange={(e) => onExpLabelChange(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Control group name</label>
          <input type="text" value={ctrlLabel} onChange={(e) => onCtrlLabelChange(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <button
          type="button"
          onClick={() => (type === "dichotomous" ? downloadDichotomousSample(expLabel, ctrlLabel) : downloadContinuousSample(expLabel, ctrlLabel))}
          className="px-4 py-2 bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 rounded-lg text-xs font-medium"
        >
          Download Sample — {type === "dichotomous" ? "Dichotomous" : "Continuous"}
        </button>
        <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg cursor-pointer">
          {parsing ? "Reading…" : "Upload Extraction Sheet"}
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" disabled={parsing} />
        </label>
        {fileName && <span className="text-xs text-slate-500">{fileName}</span>}
      </div>

      {fatalErrors.length > 0 && (
        <div className="bg-red-950/80 border border-red-500/80 text-red-200 p-4 rounded-xl text-xs space-y-1">
          {fatalErrors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-600/50 text-amber-300 p-4 rounded-xl text-xs space-y-1">
          {warnings.map((w, i) => (
            <p key={i}>⚠ {w}</p>
          ))}
        </div>
      )}

      {outcomes && outcomes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-white font-semibold text-sm">Detected outcomes ({outcomes.length})</h4>
            <button
              type="button"
              onClick={() => setSelected(allSelected ? new Set() : new Set(selectableOutcomes.map((o) => o.name)))}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          </div>

          <div className="space-y-2">
            {outcomes.map((outcome) => {
              const insufficient = outcome.eligibleStudies.length < minStudies;
              const isExpanded = expandedExclusions.has(outcome.name);
              return (
                <div key={outcome.name} className={`border rounded-xl p-4 ${insufficient ? "border-red-900/50 bg-red-950/10" : "border-slate-800 bg-[#0b0c10]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <label className="flex items-start gap-3 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={selected.has(outcome.name)}
                        disabled={insufficient}
                        onChange={() => toggle(outcome.name)}
                        className="mt-1"
                      />
                      <div className="min-w-0">
                        <p className="text-white font-medium text-sm truncate">{outcome.name}</p>
                        <p className="text-xs text-slate-400">
                          {outcome.eligibleStudies.length} eligible / {outcome.totalStudies} total study{outcome.totalStudies === 1 ? "" : "ies"}
                          {outcome.excludedStudies.length > 0 && ` · ${outcome.excludedStudies.length} excluded`}
                        </p>
                        {insufficient && (
                          <p className="text-xs text-red-400 mt-1">
                            Insufficient eligible studies for meta-analysis. At least {minStudies} studies with complete
                            required data are needed for this outcome.
                          </p>
                        )}
                      </div>
                    </label>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {outcome.eligibleStudies.length > 0 && (
                        <button type="button" onClick={() => togglePreview(outcome.name)} className="text-xs text-slate-500 hover:text-slate-300">
                          {expandedPreview.has(outcome.name) ? "Hide" : "Show"} data used
                        </button>
                      )}
                      {outcome.excludedStudies.length > 0 && (
                        <button type="button" onClick={() => toggleExpanded(outcome.name)} className="text-xs text-slate-500 hover:text-slate-300">
                          {isExpanded ? "Hide" : "Show"} exclusions
                        </button>
                      )}
                    </div>
                  </div>
                  {expandedPreview.has(outcome.name) && outcome.eligibleStudies.length > 0 && (
                    <DataPreviewTable type={type} studies={outcome.eligibleStudies} expLabel={expLabel || "Experimental"} ctrlLabel={ctrlLabel || "Control"} />
                  )}
                  {isExpanded && outcome.excludedStudies.length > 0 && (
                    <table className="w-full mt-3 text-xs text-slate-400">
                      <thead>
                        <tr className="text-slate-600 uppercase text-[10px]">
                          <th className="text-left pb-1 pr-2">Study</th>
                          <th className="text-left pb-1">Reason for exclusion</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {outcome.excludedStudies.map((ex, i) => (
                          <tr key={i}>
                            <td className="py-1 pr-2 text-slate-300">{ex.study}</td>
                            <td className="py-1">{ex.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            disabled={running || selected.size === 0}
            onClick={() => onRunSelected(outcomes.filter((o) => selected.has(o.name)))}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl shadow-lg transition"
          >
            {running ? "Processing…" : `${runLabel} (${selected.size} outcome${selected.size === 1 ? "" : "s"})`}
          </button>

          {running && progress && (
            <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-4 text-xs">
              <p className="text-indigo-300 mb-2">
                Processing outcome {progress.index + 1} of {progress.total}: {progress.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {progress.doneLabels.map((l, i) => (
                  <span key={i} className="text-emerald-400">
                    ✓ {l}
                  </span>
                ))}
                <span className="text-indigo-300">⏳ {progress.label}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Shows the exact event/total (or mean/SD/total) values the tool parsed for
// every eligible study in one outcome, so a user can check them directly
// against the source spreadsheet before running any analysis - this is
// what actually gets sent to the R backend, not a re-derivation of it.
function DataPreviewTable({ type, studies, expLabel, ctrlLabel }: { type: OutcomeDataType; studies: DetectedOutcome["eligibleStudies"]; expLabel: string; ctrlLabel: string }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-xs text-slate-300 border-collapse">
        <thead>
          <tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800">
            <th className="text-left py-1 pr-3">Study</th>
            {type === "dichotomous" ? (
              <>
                <th className="text-right py-1 pr-3">{expLabel} Events</th>
                <th className="text-right py-1 pr-3">{expLabel} Total</th>
                <th className="text-right py-1 pr-3">{ctrlLabel} Events</th>
                <th className="text-right py-1">{ctrlLabel} Total</th>
              </>
            ) : (
              <>
                <th className="text-right py-1 pr-3">{expLabel} Mean</th>
                <th className="text-right py-1 pr-3">{expLabel} SD</th>
                <th className="text-right py-1 pr-3">{expLabel} Total</th>
                <th className="text-right py-1 pr-3">{ctrlLabel} Mean</th>
                <th className="text-right py-1 pr-3">{ctrlLabel} SD</th>
                <th className="text-right py-1">{ctrlLabel} Total</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {studies.map((s, i) => {
            if (type === "dichotomous") {
              const d = s as DichStudyRow;
              return (
                <tr key={i}>
                  <td className="py-1 pr-3 text-slate-200">{d.study}</td>
                  <td className="py-1 pr-3 text-right">{d.event_e}</td>
                  <td className="py-1 pr-3 text-right">{d.n_e}</td>
                  <td className="py-1 pr-3 text-right">{d.event_c}</td>
                  <td className="py-1 text-right">{d.n_c}</td>
                </tr>
              );
            }
            const c = s as ContStudyRow;
            return (
              <tr key={i}>
                <td className="py-1 pr-3 text-slate-200">{c.study}</td>
                <td className="py-1 pr-3 text-right">{c.mean_e}</td>
                <td className="py-1 pr-3 text-right">{c.sd_e}</td>
                <td className="py-1 pr-3 text-right">{c.n_e}</td>
                <td className="py-1 pr-3 text-right">{c.mean_c}</td>
                <td className="py-1 pr-3 text-right">{c.sd_c}</td>
                <td className="py-1 text-right">{c.n_c}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
