// Shared types for the Meta-Analysis Data Extraction tool.
//
// These are the DOMAIN/BACKEND types - shared between the server-side API
// route, the deterministic post-processing logic (verification.ts,
// harmonization.ts, unitConversion.ts, workbookBuilder.ts) and the
// frontend. Local UI/editor state types live separately in
// app/tools/data-extraction/lib/types.ts, matching the existing
// risk-of-bias/meta-regression convention of not merging "editor state"
// with "domain/backend" types.
//
// IMPORTANT: the AI is never asked to compute a final harmonized/canonical
// dataset. It only extracts what one study reports, with evidence, per
// app/lib/ai/extractionSchemas.ts. Cross-study harmonization
// (harmonization.ts) and evidence verification (verification.ts) are both
// deterministic, non-AI post-processing steps - see the architecture note
// in app/tools/data-extraction/DOCS.md.

export type ExtractionStatus =
  | "QUEUED"
  | "UPLOADING"
  | "PROCESSING"
  | "VERIFYING"
  | "COMPLETE"
  | "NEEDS_REVIEW"
  | "FAILED"
  | "RETRYING"
  | "RATE_LIMITED" // Gemini rate-limited or exhausted quota - queue is paused, study is safely re-queueable via Resume
  | "CANCELLED"; // user voluntarily paused/cancelled before this study was sent

// Classifies WHY a Gemini call ultimately failed, so the client queue can
// react differently: a transient per-minute throttle is worth pausing
// briefly and resuming, while day-level quota exhaustion should stop the
// batch outright rather than burning through every remaining study's
// bounded retries for nothing. See GeminiProvider.ts's classifyGeminiError().
export type GeminiErrorCode =
  | "RATE_LIMITED" // transient - a short provider-suggested retry delay was present
  | "QUOTA_EXHAUSTED" // 429/RESOURCE_EXHAUSTED with no short retry window (day-level quota, or unknown duration)
  | "INVALID_RESPONSE" // malformed/schema-invalid JSON after one repair attempt
  | "UNAVAILABLE" // network error, 5xx, or missing GEMINI_API_KEY
  | "VALIDATION" // bad request input (not a Gemini/provider issue)
  | "UNKNOWN";

export type EvidenceStatus = "reported" | "not_reported" | "unclear" | "derived" | "converted";
export type ExtractionConfidence = "High" | "Medium" | "Low" | "Unclear";

export interface Evidence {
  page: number | null;
  location: string | null; // e.g. "Table 1", "Results, paragraph 2"
  quote: string | null; // an ACTUAL verbatim passage, or null - never fabricated
  status: EvidenceStatus;
  confidence: ExtractionConfidence;
  // Populated by the deterministic verification pass (verification.ts),
  // never by the AI itself.
  quote_verified?: boolean | null; // null = not checked (e.g. quote is null, or PDF text unavailable)
  verification_note?: string | null;
}

export interface StudyMeta {
  suggested_study_id: string;
  first_author: string | null;
  year: number | null;
  journal: string | null;
  doi: string | null;
  title: string | null;
  citation: string | null;
  country: string | null;
  study_design: string | null;
}

export interface StudyCharacteristic {
  variable: string;
  value: string;
  unit: string | null;
  evidence: Evidence;
}

export type ArmRole = "experimental" | "control" | "other";

export interface Arm {
  arm_id: string;
  arm_name: string;
  arm_role: ArmRole;
  sample_size: number | null;
  evidence: Evidence;
}

export interface BaselineCharacteristic {
  arm_id: string | null; // null = whole-sample / overall value
  variable_original_label: string;
  variable_canonical_name: string;
  value_type: "continuous" | "categorical";
  reported_value: string;
  reported_unit: string | null;
  standardized_value: string | null;
  standardized_unit: string | null;
  transformation: string | null; // e.g. "lb -> kg (x 0.453592)" - null if no conversion was performed
  evidence: Evidence;
}

export interface DichotomousOutcomeRecord {
  outcome_name: string;
  timepoint: string | null;
  arm_id: string;
  events: number | null;
  total: number | null;
  evidence: Evidence;
}

export interface ContinuousOutcomeRecord {
  outcome_name: string;
  timepoint: string | null;
  arm_id: string;
  mean: number | null;
  sd: number | null;
  total: number | null;
  evidence: Evidence;
}

export type EffectMeasure = "OR" | "RR" | "HR" | "MD" | "SMD" | "Other";

export interface GenericIVOutcomeRecord {
  outcome_name: string;
  timepoint: string | null;
  effect_measure: EffectMeasure;
  effect_measure_other_label: string | null;
  estimate: number | null;
  lower_ci: number | null;
  upper_ci: number | null;
  se_reported: number | null;
  // Derived (never AI-computed) - see deriveGenericIV.ts. Populated only
  // when estimate+CI are present for a ratio measure (OR/RR/HR) and a
  // valid log-scale SE can be computed.
  derived_log_effect: number | null;
  derived_se: number | null;
  evidence: Evidence;
}

export interface StudyExtraction {
  study_id: string; // final ID (user-editable suggestion from study.suggested_study_id)
  filename: string;
  readable: boolean;
  readability_note: string | null;
  study: StudyMeta;
  study_characteristics: StudyCharacteristic[];
  arms: Arm[];
  baseline_characteristics: BaselineCharacteristic[];
  outcomes: {
    dichotomous: DichotomousOutcomeRecord[];
    continuous: ContinuousOutcomeRecord[];
    generic_iv: GenericIVOutcomeRecord[];
  };
  warnings: string[];
  quality_flags: string[]; // populated by deterministic verification, e.g. "quote_not_verified" counts
}

export interface FailedStudy {
  study_id: string;
  filename: string;
  status: "failed";
  reason: string;
  errorCode?: GeminiErrorCode; // absent for pre-Gemini validation failures the route already reports via a 4xx response
  retryAfterMs?: number | null; // provider-suggested wait before retrying, when known (RATE_LIMITED only)
}

export type StudyProcessResult = { status: "completed" | "needs_review"; extraction: StudyExtraction } | FailedStudy;

// --- Cross-study harmonization (harmonization.ts) --------------------------

export type VariableCategory = "COMMON VARIABLE" | "IMPORTANT POTENTIAL MODERATOR" | "RARE VARIABLE";

export interface VariableDictionaryEntry {
  canonical_variable: string;
  category: "study_characteristic" | "baseline_characteristic";
  original_labels: string[];
  studies_reporting: string[]; // study_ids
  studies_total: number;
  reporting_count: number;
  reporting_pct: number;
  typical_unit: string | null;
  recommended: boolean;
  potential_moderator: boolean;
  classification: VariableCategory;
  conflicting_units: boolean;
  notes: string[];
}

export interface SameStudyConflict {
  study_id: string;
  variable: string;
  values: { value: string; source_page: number | null; source_location: string | null }[];
  severity: "high" | "medium";
  suggested_action: string;
}

export interface CrossStudyWarning {
  study_id: string | null; // null = applies across studies (e.g. mixed effect measures)
  warning: string;
  severity: "high" | "medium" | "low";
  suggested_action: string;
}
