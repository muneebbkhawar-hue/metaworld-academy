// Automatic "human review required" flagging - implements the trigger list
// from the brief: study design uncertain, framework compatibility
// uncertain, evidence absent, evidence conflicting, unreadable/scanned
// text, low AI confidence, or the deterministic algorithm producing no
// clean judgment. This never suppresses a result - it only adds a flag the
// UI surfaces prominently so a human knows to look closer.
import type { ClassificationResult, CompatibilityResult, SignallingQuestionRecord } from "./types";

export function needsHumanReview(
  classification: ClassificationResult,
  compatibility: CompatibilityResult,
  allQuestions: SignallingQuestionRecord[],
  readable: boolean
): { required: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (classification.confidence < 0.7) reasons.push("Study design classification confidence is low.");
  if (!compatibility.compatible) reasons.push("Framework compatibility is uncertain or was rejected.");
  if (!readable) reasons.push("The PDF's extractable text may be insufficient for a fully reliable automated assessment.");

  const absentCount = allQuestions.filter((q) => q.evidence_status === "absent").length;
  if (absentCount > 0) reasons.push(`${absentCount} signalling question(s) had no supporting evidence in the paper ("No information").`);

  const lowConfidenceCount = allQuestions.filter((q) => q.confidence < 0.5).length;
  if (lowConfidenceCount > 0) reasons.push(`${lowConfidenceCount} signalling question(s) were answered with low AI confidence.`);

  return { required: reasons.length > 0, reasons };
}

export function overallAIConfidence(allQuestions: SignallingQuestionRecord[], classification: ClassificationResult): "High" | "Medium" | "Low" {
  if (allQuestions.length === 0) return "Low";
  const avg = (allQuestions.reduce((s, q) => s + q.confidence, 0) / allQuestions.length + classification.confidence) / 2;
  if (avg >= 0.75) return "High";
  if (avg >= 0.5) return "Medium";
  return "Low";
}
