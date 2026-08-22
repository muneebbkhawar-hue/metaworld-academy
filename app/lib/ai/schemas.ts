// Zod schemas validating the raw JSON Gemini returns, BEFORE any of it is
// trusted or rendered. This is the first of two validation layers - see
// evidenceValidator.ts for the second, semantic layer (allowed-vocabulary /
// required-domain / evidence-consistency checks that Zod's shape validation
// alone can't express).
//
// IMPORTANT: the AI is never asked for a final domain/overall judgment.
// It only answers signalling questions and cites evidence; the deterministic
// engines in app/lib/rob/*.ts compute judgments from those answers. This
// schema reflects that split - there is no "judgment" field here at all.
import { z } from "zod";

export const StudyDesignEnum = z.enum([
  "Randomized controlled trial",
  "Cluster randomized trial",
  "Crossover randomized trial",
  "Non-randomized study of interventions",
  "Cohort study",
  "Case-control study",
  "Cross-sectional study",
  "Diagnostic accuracy study",
  "Systematic review/meta-analysis",
  "Protocol",
  "Editorial/commentary",
  "Other/unclear",
]);

export const EvidenceStatusEnum = z.enum(["direct", "indirect", "absent"]);

// RoB 2's official signalling-question response scale. ROBINS-I and
// QUADAS-2 signalling questions in this tool are answered on the same
// scale for consistency in the evidence-extraction layer (the OFFICIAL
// domain-judgment vocabularies differ per framework and are applied only
// after the deterministic engine runs - see app/lib/rob/types.ts).
export const SignallingAnswerEnum = z.enum(["Yes", "Probably yes", "Probably no", "No", "No information", "Not applicable"]);

export const SignallingQuestionSchema = z.object({
  question_id: z.string().min(1),
  answer: SignallingAnswerEnum,
  evidence_status: EvidenceStatusEnum,
  supporting_text: z.string().min(1).nullable(),
  page: z.number().int().nonnegative().nullable(),
  section: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
});

export const ClassificationSchema = z.object({
  study_design: StudyDesignEnum,
  confidence: z.number().min(0).max(1),
  evidence: z.string().nullable(),
  page: z.number().int().nonnegative().nullable(),
});

// One AI response = one study, one framework. Keyed by domain_key (e.g.
// "D1".."D5" for RoB 2) -> array of that domain's signalling questions.
export const AIAssessmentResponseSchema = z.object({
  study_design: ClassificationSchema,
  readable: z.boolean(), // false => PDF had insufficient extractable text
  readability_note: z.string().nullable(),
  domains: z.record(z.string(), z.array(SignallingQuestionSchema)),
});

export type AIAssessmentResponse = z.infer<typeof AIAssessmentResponseSchema>;
export type SignallingQuestionRaw = z.infer<typeof SignallingQuestionSchema>;
