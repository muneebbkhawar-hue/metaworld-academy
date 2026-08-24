// Sequential, resilient batch runner shared by Forest Plot / Funnel Plot /
// Sensitivity's multi-outcome mode. Sequential (not parallel) is
// deliberate: the R/Plumber backends this project uses are single-threaded
// per process (documented elsewhere in this codebase), so concurrent
// requests to the same service just queue behind each other anyway -
// running sequentially from the client keeps the UI's own progress
// reporting accurate and avoids piling up simultaneous in-flight requests
// against a backend that can't actually use them.
//
// One failing item never stops the batch: runOne's own try/catch means a
// thrown error becomes a normal {status:"failed"} result for that item,
// and the loop continues to the next one.
export interface BatchProgress {
  index: number; // 0-based
  total: number;
  label: string;
}

export async function runSequentialBatch<T, R>(
  items: T[],
  labelFor: (item: T) => string,
  runOne: (item: T) => Promise<R>,
  onProgress?: (progress: BatchProgress) => void
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i++) {
    onProgress?.({ index: i, total: items.length, label: labelFor(items[i]) });
    const result = await runOne(items[i]);
    results.push(result);
  }
  return results;
}

// ---- Outcome-level batch runner --------------------------------------------
// Purpose-built for the multi-outcome Forest/Funnel/Sensitivity workflows:
// calls one R endpoint per selected outcome, sequentially, reporting each
// outcome's result (or failure) back via onUpdate as soon as it finishes -
// so the UI can show live ✓/⏳/✗ status per outcome instead of waiting for
// the whole batch. A thrown error for one outcome is caught here and
// reported as a normal "failed" state; it never stops the remaining
// outcomes from running.
import type { DetectedOutcome, OutcomeRunState } from "./types";

export interface OutcomeBatchProgress {
  index: number;
  total: number;
  label: string;
  doneLabels: string[];
}

export async function runOutcomeBatch<TResult>(
  outcomes: DetectedOutcome[],
  callEndpoint: (outcome: DetectedOutcome) => Promise<TResult>,
  onUpdate: (index: number, state: OutcomeRunState<TResult>) => void,
  onProgress?: (progress: OutcomeBatchProgress) => void
): Promise<void> {
  const doneLabels: string[] = [];
  for (let i = 0; i < outcomes.length; i++) {
    const outcome = outcomes[i];
    onProgress?.({ index: i, total: outcomes.length, label: outcome.name, doneLabels: [...doneLabels] });
    onUpdate(i, { outcome, status: "running" });
    try {
      const result = await callEndpoint(outcome);
      onUpdate(i, { outcome, status: "success", result });
    } catch (err) {
      onUpdate(i, { outcome, status: "failed", error: err instanceof Error ? err.message : "Unknown error while contacting the statistical backend." });
    }
    doneLabels.push(outcome.name);
  }
}
