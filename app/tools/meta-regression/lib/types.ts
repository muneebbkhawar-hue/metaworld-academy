// Shared local types for the pairwise Meta-Regression tool. Not a
// duplicate of app/types/statistics.ts's MetaReg* interfaces (those model
// the R backend's response shape); these model the row the researcher is
// editing/uploading in the browser, before it's sent to the backend.

export type OutcomeType = "dichotomous" | "continuous" | "generic";
export type EffectMeasure = "RR" | "OR" | "RD" | "MD" | "SMD" | "GEN";
export type ModeratorType = "continuous" | "categorical";

export interface MetaRegDataRow {
  _rowIndex: number;
  study: string;
  // dichotomous
  event_e?: number;
  event_c?: number;
  // continuous
  mean_e?: number;
  sd_e?: number;
  mean_c?: number;
  sd_c?: number;
  // dichotomous + continuous share n_e/n_c (arm totals)
  n_e?: number;
  n_c?: number;
  // generic inverse variance
  te?: number;
  se?: number;
  // any extra uploaded column beyond the fixed outcome-type columns -
  // detected by header name, exactly like NMA's covariate convention.
  moderators?: Record<string, string>;
}

export interface SelectedModerator {
  name: string;
  type: ModeratorType;
  reference: string | null; // only meaningful when type === "categorical"
}

export const EFFECT_MEASURES_BY_OUTCOME: Record<OutcomeType, { value: EffectMeasure; label: string }[]> = {
  dichotomous: [
    { value: "RR", label: "Risk Ratio (RR)" },
    { value: "OR", label: "Odds Ratio (OR)" },
    { value: "RD", label: "Risk Difference (RD)" },
  ],
  continuous: [
    { value: "MD", label: "Mean Difference (MD)" },
    { value: "SMD", label: "Standardized Mean Difference (SMD)" },
  ],
  generic: [{ value: "GEN", label: "User-supplied effect estimate (generic inverse variance)" }],
};

// Only estimators verified to actually work correctly against the
// installed metafor 5.0.1 (rma.uni(method=...)) are listed - see
// metareg-api.R's header comment for the verification.
export const TAU2_ESTIMATORS: { value: string; label: string }[] = [
  { value: "REML", label: "REML (Restricted Maximum Likelihood)" },
  { value: "ML", label: "Maximum Likelihood (ML)" },
  { value: "DL", label: "DerSimonian-Laird (DL)" },
  { value: "PM", label: "Paule-Mandel (PM)" },
  { value: "HS", label: "Hunter-Schmidt (HS)" },
  { value: "SJ", label: "Sidik-Jonkman (SJ)" },
];
