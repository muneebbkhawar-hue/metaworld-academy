// Zod schemas validating the raw JSON Gemini returns for the Meta-Analysis
// Data Extraction tool, BEFORE any of it is trusted or rendered. Mirrors
// the two-layer validation pattern in schemas.ts/evidenceValidator.ts (Zod
// shape validation here; semantic checks + deterministic quote verification
// in app/lib/extraction/verification.ts).
//
// IMPORTANT: the AI is never asked to compute a harmonized/canonical
// dataset, a derived log-effect/SE, or a unit conversion - it reports only
// what one study says, with evidence. Harmonization, unit conversion, and
// log-effect/SE derivation are deterministic post-processing steps.
import { z } from "zod";

export const EvidenceStatusEnum = z.enum(["reported", "not_reported", "unclear", "derived", "converted"]);
export const ExtractionConfidenceEnum = z.enum(["High", "Medium", "Low", "Unclear"]);

export const EvidenceSchema = z.object({
  page: z.number().int().nonnegative().nullable(),
  location: z.string().nullable(),
  quote: z.string().min(1).nullable(), // an ACTUAL verbatim passage or null - never a paraphrase in quotes
  status: EvidenceStatusEnum,
  confidence: ExtractionConfidenceEnum,
});

export const StudyMetaSchema = z.object({
  suggested_study_id: z.string().min(1),
  first_author: z.string().nullable(),
  year: z.number().int().nullable(),
  journal: z.string().nullable(),
  doi: z.string().nullable(),
  title: z.string().nullable(),
  citation: z.string().nullable(),
  country: z.string().nullable(),
  study_design: z.string().nullable(),
});

export const StudyCharacteristicSchema = z.object({
  variable: z.string().min(1),
  value: z.string().min(1),
  unit: z.string().nullable(),
  evidence: EvidenceSchema,
});

export const ArmRoleEnum = z.enum(["experimental", "control", "other"]);

export const ArmSchema = z.object({
  arm_id: z.string().min(1),
  arm_name: z.string().min(1),
  arm_role: ArmRoleEnum,
  sample_size: z.number().int().nonnegative().nullable(),
  evidence: EvidenceSchema,
});

export const BaselineCharacteristicSchema = z.object({
  arm_id: z.string().nullable(),
  variable_original_label: z.string().min(1),
  variable_canonical_name: z.string().min(1),
  value_type: z.enum(["continuous", "categorical"]),
  reported_value: z.string().min(1),
  reported_unit: z.string().nullable(),
  evidence: EvidenceSchema,
});

export const DichotomousOutcomeRecordSchema = z.object({
  outcome_name: z.string().min(1),
  timepoint: z.string().nullable(),
  arm_id: z.string().min(1),
  events: z.number().int().nonnegative().nullable(),
  total: z.number().int().nonnegative().nullable(),
  evidence: EvidenceSchema,
});

export const ContinuousOutcomeRecordSchema = z.object({
  outcome_name: z.string().min(1),
  timepoint: z.string().nullable(),
  arm_id: z.string().min(1),
  mean: z.number().nullable(),
  sd: z.number().nullable(),
  total: z.number().int().nonnegative().nullable(),
  evidence: EvidenceSchema,
});

export const EffectMeasureEnum = z.enum(["OR", "RR", "HR", "MD", "SMD", "Other"]);

export const GenericIVOutcomeRecordSchema = z.object({
  outcome_name: z.string().min(1),
  timepoint: z.string().nullable(),
  effect_measure: EffectMeasureEnum,
  effect_measure_other_label: z.string().nullable(),
  estimate: z.number().nullable(),
  lower_ci: z.number().nullable(),
  upper_ci: z.number().nullable(),
  se_reported: z.number().nullable(),
  evidence: EvidenceSchema,
});

export const StudyExtractionEnvelopeSchema = z.object({
  readable: z.boolean(),
  readability_note: z.string().nullable(),
  study: StudyMetaSchema,
  study_characteristics: z.array(StudyCharacteristicSchema),
  arms: z.array(ArmSchema).min(1),
  baseline_characteristics: z.array(BaselineCharacteristicSchema),
  outcomes: z.object({
    dichotomous: z.array(DichotomousOutcomeRecordSchema),
    continuous: z.array(ContinuousOutcomeRecordSchema),
    generic_iv: z.array(GenericIVOutcomeRecordSchema),
  }),
  warnings: z.array(z.string()),
});

export type StudyExtractionEnvelope = z.infer<typeof StudyExtractionEnvelopeSchema>;
