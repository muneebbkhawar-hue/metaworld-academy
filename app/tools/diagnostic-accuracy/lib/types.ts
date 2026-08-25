// Local types for the Diagnostic Test Accuracy Meta-Analysis tool's
// upload/validation step, before rows are sent to dta-api.R. Mirrors the
// pattern used by TSA/Meta-Regression's own lib/types.ts.

export interface DTARawRow {
  _rowIndex: number;
  study: string;
  tp: number; // NaN when missing/invalid - never silently 0
  fp: number;
  fn: number;
  tn: number;
}

export interface DTAExcludedRow {
  study: string;
  reason: string;
}

export interface DTAValidationResult {
  eligible: DTARawRow[];
  excluded: DTAExcludedRow[];
}
