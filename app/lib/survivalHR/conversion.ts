// Survival/time-to-event (Hazard Ratio) data support for the Generic
// Inverse-Variance meta-analysis pathway already used by the Forest Plot,
// Funnel Plot, and Sensitivity Analysis (leave-one-out) tools.
//
// Those tools' R backends (api.R's /api/meta/iv, /api/meta/bias-iv, and
// tsa-api.R... no, sensitivity-loo's generic branch in api.R) already
// accept a generic {study, te, se} row - a log-scale effect estimate and
// its standard error - and pool it with `meta::metagen()`. That machinery
// is untouched here. What was missing is a way to hand the tool the data
// as it's actually reported in a paper (HR with a 95% CI), rather than
// requiring the user to have already computed ln(HR) and SE(ln HR)
// themselves.
//
// This module derives {te, se} from whichever the user actually has:
//   - ln(HR) and SE(ln HR) directly, if already computed (used as-is,
//     never re-derived - a user-supplied SE is always more trustworthy
//     than one back-computed from a rounded, published CI), or
//   - HR and its 95% CI, using the standard Cochrane Handbook formula:
//       SE(ln HR) = (ln(upper) - ln(lower)) / (2 x 1.959964)
//     (1.959964 = qnorm(0.975), the exact two-sided 95% z-value - not the
//     common 1.96 rounding, for a marginally more precise SE).
// Never fabricates a value: a row with neither complete direct values nor
// a complete, valid HR+CI triple is reported as unresolvable, not guessed.

export interface HRStudyRow {
  id: string;
  study: string;
  hr: number | null;
  ciLower: number | null;
  ciUpper: number | null;
  lnHR: number | null;
  seLnHR: number | null;
}

export function emptyHRRow(id: string): HRStudyRow {
  return { id, study: "", hr: null, ciLower: null, ciUpper: null, lnHR: null, seLnHR: null };
}

export type DerivationSource = "direct" | "derived-from-ci";

export interface DerivedEffect {
  te: number;
  se: number;
  source: DerivationSource;
}

// qnorm(0.975), the exact multiplier for a two-sided 95% CI - matches the
// Cochrane Handbook's own stated formula (section 6.3.1) rather than the
// coarser 1.96 rounding.
const Z_975 = 1.959963984540054;

/**
 * Resolves one row to a {te, se} pair for the generic inverse-variance
 * endpoints, or null if the row has neither complete direct ln(HR)/SE(ln HR)
 * values nor a complete, valid HR + 95% CI triple to derive them from.
 */
export function deriveEffect(row: HRStudyRow): DerivedEffect | null {
  if (row.lnHR !== null && row.seLnHR !== null && Number.isFinite(row.lnHR) && Number.isFinite(row.seLnHR) && row.seLnHR > 0) {
    return { te: row.lnHR, se: row.seLnHR, source: "direct" };
  }
  if (
    row.hr !== null && row.ciLower !== null && row.ciUpper !== null &&
    Number.isFinite(row.hr) && Number.isFinite(row.ciLower) && Number.isFinite(row.ciUpper) &&
    row.hr > 0 && row.ciLower > 0 && row.ciUpper > row.ciLower
  ) {
    const te = Math.log(row.hr);
    const se = (Math.log(row.ciUpper) - Math.log(row.ciLower)) / (2 * Z_975);
    if (se > 0) return { te, se, source: "derived-from-ci" };
  }
  return null;
}

/** Human-readable reason a row could not be resolved - null if it resolves fine. */
export function describeUnresolvedReason(row: HRStudyRow): string | null {
  if (deriveEffect(row) !== null) return null;
  const hasPartialDirect = row.lnHR !== null || row.seLnHR !== null;
  const hasPartialCI = row.hr !== null || row.ciLower !== null || row.ciUpper !== null;
  if (hasPartialDirect && (row.lnHR === null || row.seLnHR === null)) {
    return "ln(HR) and SE(ln HR) must both be filled in to use them directly (or leave both blank and provide HR + 95% CI instead).";
  }
  if (row.hr !== null && row.hr <= 0) return "HR must be a positive number.";
  if (row.ciLower !== null && row.ciLower <= 0) return "95% CI Lower must be a positive number.";
  if (row.ciUpper !== null && row.ciLower !== null && row.ciUpper <= row.ciLower) return "95% CI Upper must be greater than 95% CI Lower.";
  if (hasPartialCI && (row.hr === null || row.ciLower === null || row.ciUpper === null)) {
    return "HR, 95% CI Lower, and 95% CI Upper must all be filled in to derive ln(HR)/SE.";
  }
  return "Enter either ln(HR) + SE(ln HR) directly, or HR + 95% CI Lower + 95% CI Upper.";
}
