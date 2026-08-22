// Shared types for the AI-Assisted Risk of Bias Assessment tool.
//
// These are the FRAMEWORK LOGIC types - shared between the server-side
// decision engine (app/lib/rob/*.ts), the API route, and the frontend.
// Local UI/editor state types live separately in
// app/tools/risk-of-bias/lib/types.ts (matching the existing meta-regression
// convention of not merging "editor state" with "domain/backend" types).
//
// IMPORTANT: judgment vocabularies are deliberately NOT shared across
// frameworks. RoB 2, ROBINS-I, and QUADAS-2 each have distinct official
// terminology and mixing them is an explicit correctness requirement of
// this tool, not a style preference.

export type Framework = "RoB2" | "ROBINS-I" | "QUADAS-2";

export type StudyDesign =
  | "Randomized controlled trial"
  | "Cluster randomized trial"
  | "Crossover randomized trial"
  | "Non-randomized study of interventions"
  | "Cohort study"
  | "Case-control study"
  | "Cross-sectional study"
  | "Diagnostic accuracy study"
  | "Systematic review/meta-analysis"
  | "Protocol"
  | "Editorial/commentary"
  | "Other/unclear";

// RoB 2 signalling-question response scale (official five-point scale plus
// "Not applicable" for questions that don't apply to every study).
export type RoB2SignallingAnswer = "Yes" | "Probably yes" | "Probably no" | "No" | "No information" | "Not applicable";

export type RoB2Judgment = "Low risk of bias" | "Some concerns" | "High risk of bias";
export type RobinsIJudgment = "Low" | "Moderate" | "Serious" | "Critical" | "No information";
export type Quadas2Judgment = "Low" | "High" | "Unclear";

export interface EvidenceCitation {
  question_id: string;
  answer: string;
  evidence_status: "direct" | "indirect" | "absent";
  supporting_text: string | null; // an ACTUAL quoted passage, or null - never a paraphrase in quotes
  page: number | null;
  section: string | null;
  confidence: number; // 0-1, AI-reported
  reasoning: string;
  needs_review?: boolean;
  needs_review_reason?: string;
}

export interface ClassificationResult {
  study_design: StudyDesign;
  confidence: number; // 0-1
  evidence: string | null;
  page: number | null;
  human_override?: { study_design: StudyDesign; reason: string } | null;
}

export interface CompatibilityResult {
  compatible: boolean;
  reason: string;
  recommended_framework: Framework | null;
}

// One signalling question's full record: the AI's answer + evidence, plus
// the deterministic domain this question feeds.
export interface SignallingQuestionRecord extends EvidenceCitation {
  domain_key: string;
}

// Per-domain assessment: AI-proposed judgment (derived deterministically
// from the domain's signalling questions, NEVER asked of the AI directly),
// plus the human's final judgment (defaults to the AI proposal until
// overridden).
export interface DomainAssessment<J extends string> {
  domain_key: string;
	domain_label: string;
  ai_judgment: J;
  human_judgment: J;
  human_override_applied: boolean;
  reviewer_rationale: string | null;
  questions: SignallingQuestionRecord[];
}

export interface StudyAssessmentBase {
  study_id: string;
  filename: string;
  framework: Framework;
  classification: ClassificationResult;
  compatibility: CompatibilityResult;
  ai_confidence: "High" | "Medium" | "Low";
  human_review_required: boolean;
  human_review_reasons: string[];
  overall_notes: string;
}

export interface RoB2Assessment extends StudyAssessmentBase {
  framework: "RoB2";
  domains: DomainAssessment<RoB2Judgment>[];
  ai_overall: RoB2Judgment;
  human_overall: RoB2Judgment;
}

export interface RobinsIAssessment extends StudyAssessmentBase {
  framework: "ROBINS-I";
  domains: DomainAssessment<RobinsIJudgment>[];
  ai_overall: RobinsIJudgment;
  human_overall: RobinsIJudgment;
}

// QUADAS-2 keeps risk-of-bias and applicability strictly separate per the
// official framework - never combined into one score.
export interface Quadas2Assessment extends StudyAssessmentBase {
  framework: "QUADAS-2";
  domains: DomainAssessment<Quadas2Judgment>[]; // risk of bias, 4 domains
  applicability: DomainAssessment<Quadas2Judgment>[]; // 3 domains only (no Flow & timing)
  ai_overall: Quadas2Judgment;
  human_overall: Quadas2Judgment;
}

export type StudyAssessment = RoB2Assessment | RobinsIAssessment | Quadas2Assessment;

export interface FailedStudy {
  study_id: string;
  filename: string;
  status: "failed" | "rejected";
  reason: string;
}

export type StudyResult = { status: "completed" | "needs_review"; assessment: StudyAssessment } | FailedStudy;
