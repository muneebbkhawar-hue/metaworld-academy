// Shared types for the multi-outcome extraction-sheet workflow, used by
// Forest Plot, Funnel Plot, and Sensitivity/LOO. See wideFormatParser.ts
// for the parsing algorithm these types describe the output of.

export type OutcomeDataType = "dichotomous" | "continuous";

export interface DichStudyRow {
  study: string;
  event_e: number;
  n_e: number;
  event_c: number;
  n_c: number;
}

export interface ContStudyRow {
  study: string;
  n_e: number;
  mean_e: number;
  sd_e: number;
  n_c: number;
  mean_c: number;
  sd_c: number;
}

export type OutcomeStudyRow = DichStudyRow | ContStudyRow;

export interface ExcludedStudy {
  study: string;
  reason: string;
}

export interface DetectedOutcome {
  name: string;
  type: OutcomeDataType;
  /** Studies with every required field present and numeric - safe to send to R. */
  eligibleStudies: OutcomeStudyRow[];
  /** Studies excluded FROM THIS OUTCOME ONLY, with the specific reason. */
  excludedStudies: ExcludedStudy[];
  /** Total studies found in the sheet for this outcome block (eligible + excluded). */
  totalStudies: number;
}

export interface ParseResult {
  outcomes: DetectedOutcome[];
  /** Sheet-level problems (e.g. couldn't find a Study ID column) that stopped parsing entirely. */
  fatalErrors: string[];
  /** Non-fatal notices (e.g. an outcome block's header row didn't say "Events/Total" as expected). */
  warnings: string[];
}

export const MIN_STUDIES_FOR_ANALYSIS = 2;

export type OutcomeRunStatus = "pending" | "running" | "success" | "failed" | "insufficient-data";

export interface OutcomeRunState<TResult> {
  outcome: DetectedOutcome;
  status: OutcomeRunStatus;
  result?: TResult;
  error?: string;
}
