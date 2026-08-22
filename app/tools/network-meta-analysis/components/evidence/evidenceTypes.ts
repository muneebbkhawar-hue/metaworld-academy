// Shared types for the Evidence & Certainty section (Transitivity
// Assessment, Certainty/Confidence Assessment, Final NMA Evidence Report).
//
// These three tools do NOT call any new R backend endpoint - everything
// they display is either (a) descriptive statistics computed client-side
// directly from the already-uploaded study-level data, or (b) values
// already returned by the existing /analyze, /diagnostics, /sensitivity,
// /subgroup, /metaregression endpoints. See CertaintyAssessment.tsx for the
// full rationale on why full automated CINeMA scoring is not implemented.

// --- Transitivity ------------------------------------------------------

export type VariableType = "continuous" | "categorical";

export type ConcernLevel = "Not assessed" | "Low concern" | "Some concern" | "High concern";

export const CONCERN_LEVELS: ConcernLevel[] = ["Not assessed", "Low concern", "Some concern", "High concern"];

// One row = one (effect modifier, treatment comparison) pair the researcher
// has looked at. `summary` is a pre-formatted, human-readable string (not a
// statistical verdict) built from real computed descriptive statistics.
export interface TransitivityRow {
  modifier: string;
  variableType: VariableType;
  comparison: string; // "A vs B"
  nStudies: number;
  nParticipants: number | null;
  summary: string;
  missing: number;
  concern: ConcernLevel;
  notes: string;
}

export interface TransitivityAssessmentState {
  rows: TransitivityRow[];
  overallConcern: ConcernLevel;
  overallNotes: string;
}

// --- Certainty / Confidence ---------------------------------------------

// CINeMA's actual domain-rating vocabulary ("No concerns" / "Some
// concerns" / "Major concerns") - deliberately distinct from the
// Transitivity tool's "concern" wording above, since these map to the
// real, published CINeMA domain scale rather than being an invented
// synonym for it.
export type CinemaDomainRating = "Not assessed" | "No concerns" | "Some concerns" | "Major concerns";

export const CINEMA_DOMAIN_RATINGS: CinemaDomainRating[] = ["Not assessed", "No concerns", "Some concerns", "Major concerns"];

// GRADE's four certainty levels, which CINeMA also reports its overall
// rating on - not an invented scale.
export type OverallCertainty = "Not assessed" | "High" | "Moderate" | "Low" | "Very low";

export const OVERALL_CERTAINTY_LEVELS: OverallCertainty[] = ["Not assessed", "High", "Moderate", "Low", "Very low"];

export type CertaintyDomainKey =
  | "withinStudyBias"
  | "reportingBias"
  | "indirectness"
  | "imprecision"
  | "heterogeneity"
  | "incoherence";

export const CERTAINTY_DOMAINS: { key: CertaintyDomainKey; label: string }[] = [
  { key: "withinStudyBias", label: "Within-study bias" },
  { key: "reportingBias", label: "Reporting bias" },
  { key: "indirectness", label: "Indirectness" },
  { key: "imprecision", label: "Imprecision" },
  { key: "heterogeneity", label: "Heterogeneity" },
  { key: "incoherence", label: "Incoherence" },
];

export interface CertaintyDomainAssessment {
  rating: CinemaDomainRating;
  notes: string;
}

export function emptyDomainAssessment(): CertaintyDomainAssessment {
  return { rating: "Not assessed", notes: "" };
}

// Category A: automatically derived from the existing NMA/diagnostics
// results, never edited by the researcher.
export interface CertaintyAutomatedInfo {
  comparison: string;
  outcome: string;
  estimate: string | null;
  ciLower: string | null;
  ciUpper: string | null;
  nStudies: number | null;
  directEvidence: string | null;
  indirectEvidence: string | null;
  heterogeneityNote: string | null;
  incoherenceNote: string | null;
}

// Category B: researcher judgment, per comparison.
export interface CertaintyRow {
  comparison: string;
  automated: CertaintyAutomatedInfo;
  domains: Record<CertaintyDomainKey, CertaintyDomainAssessment>;
  overall: OverallCertainty;
  overallNotes: string;
  assessedAt: string | null; // ISO timestamp, set when the researcher first records a judgment on this row
}

export function emptyCertaintyDomains(): Record<CertaintyDomainKey, CertaintyDomainAssessment> {
  return {
    withinStudyBias: emptyDomainAssessment(),
    reportingBias: emptyDomainAssessment(),
    indirectness: emptyDomainAssessment(),
    imprecision: emptyDomainAssessment(),
    heterogeneity: emptyDomainAssessment(),
    incoherence: emptyDomainAssessment(),
  };
}

// --- Shared CSV/XLSX export helpers -------------------------------------
// Moved to app/lib/exportUtils.ts (shared with the Risk of Bias tool);
// re-exported here so existing imports from this file keep working
// unchanged.

export { toCSV, downloadCSVFile, downloadXLSXFile } from "@/app/lib/exportUtils";
