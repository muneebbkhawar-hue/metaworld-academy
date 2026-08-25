// Shared TypeScript types for the statistics tools' R-backend API responses.
// Every field here reflects JSON actually returned by the corresponding
// Plumber endpoint (verified via direct testing during development) - none
// are invented. Kept intentionally loose on deeply-nested/variable-shape
// substructures (e.g. league table matrices, per-comparison rows) using
// index signatures or `unknown` rather than exhaustively modeling every
// field, since those genuinely vary by dataset; this still eliminates the
// implicit-any/property-on-never error cascade at the state/prop boundary
// without inventing precision the backend doesn't guarantee.

export interface ApiError {
  status: "error";
  message: string;
}

// --- TSA (tsa-api.R) ---------------------------------------------------------
export interface TSASettings {
  outcome_type: string;
  effect_measure: string;
  model: string;
  weighting?: string;
  alpha: number;
  beta: number;
  power: number;
  side: number;
  expected_effect_mode: string;
  expected_effect_used: number | null;
  expected_effect_is_posthoc_assumption: boolean;
  control_event_risk_mode?: string;
  control_event_risk_used: number | null;
  heterogeneity_adjustment: string;
  re_method?: string;
  boundary_type: string;
  futility: string;
  n_studies: number;
}

export interface TSAInformation {
  accrued_information_size: number;
  required_information_size: number | null;
  required_information_size_label: string;
  required_information_size_unavailable: boolean;
  required_information_size_note: string | null;
  information_fraction: number | null;
  diversity_d2: number | null;
  i2: number | null;
  tau2: number | null;
}

export interface TSATableRow {
  analysis_order: number;
  study: string;
  cumulative_participants: number | null;
  cumulative_information_fraction: number | null;
  cumulative_z: number | null;
  monitoring_boundary_upper: number | null;
  monitoring_boundary_lower: number | null;
  futility_boundary_upper: number | null;
  futility_boundary_lower: number | null;
  crossed_benefit: boolean;
  crossed_harm: boolean;
  crossed_futility: boolean;
}

export interface TSAResult {
  status: "success";
  plot_base64: string;
  settings: TSASettings;
  information: TSAInformation;
  interpretation: string;
  table: {
    analysis_order: number[];
    study: string[];
    cumulative_participants: (number | null)[];
    cumulative_information_fraction: (number | null)[];
    cumulative_z: (number | null)[];
    monitoring_boundary_upper: (number | null)[];
    monitoring_boundary_lower: (number | null)[];
    futility_boundary_upper: (number | null)[];
    futility_boundary_lower: (number | null)[];
    crossed_benefit: boolean[];
    crossed_harm: boolean[];
    crossed_futility: boolean[];
  };
}

// --- Pairwise Forest / Synthesis (api.R) -------------------------------------
export interface SynthesisStats {
  k: number;
  i2: number;
  tau2: number;
  q: number;
  q_pval: number;
}

export interface SynthesisResult {
  status: "success";
  forest_plot_base64: string;
  stats: SynthesisStats;
}

// --- Pairwise Funnel / Publication Bias (api.R) ------------------------------
export interface BiasResult {
  eggers_p_value: number | null;
  bias_intercept: number | null;
  t_val: number | null;
  begg_p_value?: number | null;
  n_studies: number;
  funnel_plot_base64: string;
}

// --- Pairwise Sensitivity (LOO) (api.R) --------------------------------------
export interface SensitivityLOOResult {
  status: "success";
  plot_base64: string;
  table: {
    omitted_study: string[];
    k: string[];
    pooled_effect: string[];
    lower_ci: string[];
    upper_ci: string[];
    pval: string[];
    tau2: string[];
    i2: string[];
  };
}

// --- NMA shared building blocks (nma-api.R) ----------------------------------
export interface NMAArm {
  _rowIndex: number;
  study: string;
  treatment: string;
  subgroup: string | null;
  year: number | null;
  event?: number;
  n: number;
  mean?: number;
  sd?: number;
  // Any extra columns in the uploaded dataset beyond the fixed/Subgroup/Year
  // ones (e.g. Age, Sex, Baseline Severity, Follow-up Duration) - detected
  // by header name, never invented. Values are kept as raw strings; the
  // Transitivity Assessment UI decides continuous vs categorical per
  // variable from the actual values observed, and lets the researcher
  // override that. Same value is expected to repeat across every arm of a
  // given study, since these are study-level (not arm-level) covariates.
  covariates?: Record<string, string>;
}

export interface NMAValidation {
  status: "success" | "error";
  message?: string;
  n_studies?: number;
  n_treatments?: number;
  n_treatment_arms?: number;
  n_multiarm_studies?: number;
  max_arms?: number;
  n_participants?: number;
  n_direct_comparisons?: number;
  treatments?: string[];
  connected?: boolean;
  n_components?: number;
  components?: { component: number; treatments: string[] }[];
}

export interface NMARankingRow {
  treatment: string;
  rank: number;
  pscore: number;
}

export interface NMALeagueTable {
  reference_note: string;
  rownames: string[];
  matrix: string[][];
}

export interface NMASummary {
  n_studies: number;
  n_treatments: number;
  n_treatment_arms: number;
  n_multiarm_studies: number;
  max_arms: number;
  n_participants: number;
  n_direct_comparisons: number;
  outcome_type: string;
  effect_measure: string;
  model: string;
  tau_method: string;
  reference_treatment: string;
  connected: boolean;
  connectivity_note: string;
  tau2: number | null;
  i2: number | null;
  analysis_status: string;
}

export interface NMAAnalyzeResult {
  status: "success";
  summary: NMASummary;
  treatments: string[];
  network_geometry_base64: string;
  forest_plot_base64: string;
  rankogram_base64: string;
  league_table: NMALeagueTable;
  ranking: NMARankingRow[];
}

export interface NMASettingsUsed {
  outcome_type: string;
  effect_measure: string;
  model: string;
  tau_method: string;
  reference_treatment: string;
  note?: string;
  [extra: string]: unknown;
}

export interface NMADiagnosticsResult {
  status: "success";
  settings_used: NMASettingsUsed;
  global_inconsistency: {
    method?: string;
    table?: { component: string; Q: number; df: number; pval: number | null }[];
    interpretation?: string;
    unavailable_reason?: string;
  };
  node_splitting: {
    method?: string;
    table?: {
      comparison: string; k_direct_studies: number; proportion_direct: number;
      direct_estimate: number; direct_lower: number; direct_upper: number;
      indirect_estimate: number | null; indirect_lower: number | null; indirect_upper: number | null;
      diff_estimate: number; diff_p: number | null; evaluable: boolean;
    }[];
    unavailable_reason?: string;
  };
  direct_vs_indirect: NMADiagnosticsResult["node_splitting"];
  contribution_matrix: { method?: string; plot_base64?: string; unavailable_reason?: string };
  net_heat_plot: { method?: string; model_used?: string; plot_base64?: string; unavailable_reason?: string };
}

export interface NMAFunnelResult {
  status: "success";
  plot_base64: string;
  settings_used: NMASettingsUsed & { n_comparisons_plotted: number };
  small_study_effect_test: {
    available: boolean;
    method: string;
    statistic?: number;
    pval?: number;
    unavailable_reason?: string;
  };
  interpretation: string;
}

export interface NMASensitivityResult {
  status: "success";
  settings_used: { primary: NMASettingsUsed; sensitivity: NMASettingsUsed; method: string; excluded_studies: string[] };
  primary_summary: NMAFitSummary;
  sensitivity_summary: NMAFitSummary;
  comparison_table: { comparison: string; primary: string; sensitivity: string }[];
  primary_forest_base64: string;
  sensitivity_forest_base64: string;
}

export interface NMAFitSummary {
  k: number;
  n_treatments: number;
  trts: string[];
  tau2: number | null;
  i2: number | null;
  ranking: NMARankingRow[] | null;
  league: NMALeagueTable | null;
}

export interface NMASubgroupResult {
  status: "success";
  settings_used: NMASettingsUsed & { subgroup_variable: string; groups_analyzed: string[] };
  subgroup_results: Record<string, ({ available: true } & NMAFitSummary) | { available: false; reason: string }>;
  forest_plots: Record<string, string>;
  between_subgroup_comparison: { note: string; table: Record<string, string>[] };
}

export interface NMAMetaRegressionCoefficient {
  term: string;
  type: string;
  estimate: number;
  ci_lower: number;
  ci_upper: number;
  pval: number;
}

export interface NMAMetaRegressionResult {
  status: "success";
  settings_used: NMASettingsUsed & { covariate_variable: string; studies_excluded_for_missing_covariate: string[] };
  covariate_summary: { n_studies_total: number; n_usable: number; n_missing: number; min: number; max: number };
  coefficient_table: NMAMetaRegressionCoefficient[];
  model_specification: string;
  interpretation: string;
}

// --- Pairwise Meta-Regression (metareg-api.R, metafor::rma.uni()) -----------
export interface MetaRegModeratorSetting {
  name: string;
  type: "continuous" | "categorical";
  reference: string | null;
}

export interface MetaRegSettingsUsed {
  outcome_type: string;
  effect_measure: string;
  model: string;
  tau_method: string;
  ci_level: number;
  knha: boolean;
  moderators: MetaRegModeratorSetting[];
  r_package: string;
  r_package_version: string;
  r_function: string;
}

export interface MetaRegExcludedStudy {
  study: string;
  reason: string;
}

export interface MetaRegDataSummary {
  n_studies_included: number;
  n_studies_excluded: number;
  excluded_studies: MetaRegExcludedStudy[];
}

export interface MetaRegHeterogeneity {
  tau2: number | null;
  i2: number | null;
  h2: number | null;
  qe: number | null;
  qe_df: number | null;
  qe_p: number | null;
}

export interface MetaRegModeratorTest {
  label: string;
  qm: number | null;
  df1: number | null;
  df2: number | null;
  pval: number | null;
  test_type: "F" | "Chi-squared";
}

export interface MetaRegCoefficient {
  term: string;
  estimate: number | null;
  se: number | null;
  ci_lower: number | null;
  ci_upper: number | null;
  statistic: number | null;
  stat_type: "t" | "z";
  df: number | null;
  pval: number | null;
}

export interface MetaRegDiagnosticRow {
  study: string;
  cooks_distance: number | null;
  hat: number | null;
  dffits: number | null;
  rstudent: number | null;
  influential: boolean;
}

export interface MetaRegDiagnostics {
  available: boolean;
  method: string | null;
  table: MetaRegDiagnosticRow[];
  unavailable_reason: string | null;
}

export interface MetaRegResult {
  status: "success";
  settings_used: MetaRegSettingsUsed;
  model_formula: string;
  data_summary: MetaRegDataSummary;
  overall_heterogeneity: MetaRegHeterogeneity | null;
  residual_heterogeneity: MetaRegHeterogeneity;
  r2: number | null;
  moderator_test: MetaRegModeratorTest;
  coefficients: MetaRegCoefficient[];
  figure_base64: string;
  figure_type: "bubble" | "categorical" | "coefficient";
  diagnostics: MetaRegDiagnostics;
  interpretation: string;
  warnings: string[];
}

// --- Diagnostic Test Accuracy Meta-Analysis (dta-api.R, mada::reitsma()) -----
export interface DTAStudyResult {
  study: string;
  tp: number; fp: number; fn: number; tn: number; total: number;
  sensitivity: number | null; sensitivity_ci_lower: number | null; sensitivity_ci_upper: number | null;
  specificity: number | null; specificity_ci_lower: number | null; specificity_ci_upper: number | null;
  ppv: number | null; npv: number | null;
  dor: number | null; dor_ci_lower: number | null; dor_ci_upper: number | null;
  lr_pos: number | null; lr_pos_ci_lower: number | null; lr_pos_ci_upper: number | null;
  lr_neg: number | null; lr_neg_ci_lower: number | null; lr_neg_ci_upper: number | null;
  has_zero_cell: boolean;
}

export interface DTAExcludedStudy { study: string; reason: string }

export interface DTADataSummary {
  n_studies_included: number;
  n_studies_excluded: number;
  total_participants: number;
  excluded_studies: DTAExcludedStudy[];
}

export interface DTAPooledMeasure {
  available: boolean;
  estimate?: number; ci_lower?: number; ci_upper?: number;
  tau2?: number; i2?: number; k?: number;
  note: string | null;
}

export interface DTABivariateResult {
  available: boolean;
  n_studies?: number; n_participants?: number;
  pooled_sensitivity?: number; pooled_sensitivity_ci_lower?: number; pooled_sensitivity_ci_upper?: number;
  pooled_specificity?: number; pooled_specificity_ci_lower?: number; pooled_specificity_ci_upper?: number;
  correlation?: number | null; tau_sens_logit?: number | null; tau_fpr_logit?: number | null;
  note: string | null;
}

export interface DTASrocResult {
  available: boolean;
  plot_base64?: string;
  confidence_region_available?: boolean;
  prediction_region_available?: boolean;
  note: string | null;
}

export interface DTASettingsUsed {
  bivariate_model: string; bivariate_package: string; bivariate_package_version: string; bivariate_r_function: string;
  univariate_pooling_package: string; univariate_pooling_package_version: string; univariate_pooling_r_function: string;
  ci_level: number;
  continuity_correction: { value: number; scope: string; studies_affected: string[] };
}

export interface DTAResult {
  status: "success";
  settings_used: DTASettingsUsed;
  data_summary: DTADataSummary;
  study_results: DTAStudyResult[];
  univariate_pooled: { dor: DTAPooledMeasure; lr_pos: DTAPooledMeasure; lr_neg: DTAPooledMeasure };
  bivariate: DTABivariateResult;
  sroc: DTASrocResult;
  forest_plots: { sensitivity_base64: string; specificity_base64: string; dor_base64: string };
  warnings: string[];
  interpretation: string;
}

export interface SupervisorServiceStatus {
  name: string;
  label: string;
  port: number;
  status: string;
  pid: number | null;
  restarts: number;
  uptime_seconds: number | null;
  lastError: string | null;
}
