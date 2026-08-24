// Types for the GRADE tool's multi-outcome batch workflow. GRADE does NOT
// consume raw per-study extraction data the way Forest/Funnel/Sensitivity/
// TSA do - the existing R endpoint (/api/grade/evaluate) has always taken
// one already-summarized outcome (effect estimate, k, n, I2, and the
// reviewer's own domain judgments) and returned one certainty rating. So
// "multi-outcome" here means letting a reviewer manage a table of several
// such summary rows - one per outcome - in one project, rather than forcing
// GRADE into the wide-format per-study extraction sheet used by the other
// tools (which would require it to run its own meta-analysis, duplicating
// Forest Plot's job and risking two different pooled-effect numbers for the
// same outcome).

export type RiskOfBiasRating = "Not serious" | "Serious" | "Very serious";
export type PublicationBiasRating = "Undetected" | "Suspected" | "Serious" | "Very serious";
export type IndirectnessOverride = "" | "Not serious" | "Serious" | "Very serious";
export type StudyDesign = "RCT" | "Observational";

export interface GradeOutcomeInput {
  outcome: string;
  effect: string; // e.g. "RR 0.82 (0.71 to 0.95)" - free text, matches the existing single-outcome field
  design: StudyDesign;
  k: number | null;
  n: number | null;
  i2: number | null;
  riskOfBias: RiskOfBiasRating;
  indirectnessOverride: IndirectnessOverride;
  publicationBias: PublicationBiasRating;
}

export interface GradeExcludedOutcome {
  outcome: string;
  reason: string;
}

export interface GradeParseResult {
  rows: GradeOutcomeInput[];
  excluded: GradeExcludedOutcome[];
  fatalErrors: string[];
}

export interface GradeResultRow {
  outcome: string;
  effect_ci: string;
  k: number;
  n: number;
  risk_of_bias: string;
  inconsistency: string;
  indirectness: string;
  imprecision: string;
  publication_bias: string;
  certainty: string;
}

export type GradeRunStatus = "pending" | "running" | "success" | "failed";

export interface GradeRunState {
  input: GradeOutcomeInput;
  status: GradeRunStatus;
  result?: GradeResultRow;
  error?: string;
}

export const RISK_OF_BIAS_OPTIONS: RiskOfBiasRating[] = ["Not serious", "Serious", "Very serious"];
export const PUBLICATION_BIAS_OPTIONS: PublicationBiasRating[] = ["Undetected", "Suspected", "Serious", "Very serious"];
export const INDIRECTNESS_OPTIONS: IndirectnessOverride[] = ["", "Not serious", "Serious", "Very serious"];
export const STUDY_DESIGN_OPTIONS: StudyDesign[] = ["RCT", "Observational"];

export function blankGradeRow(): GradeOutcomeInput {
  return {
    outcome: "",
    effect: "",
    design: "RCT",
    k: null,
    n: null,
    i2: null,
    riskOfBias: "Not serious",
    indirectnessOverride: "",
    publicationBias: "Undetected",
  };
}
