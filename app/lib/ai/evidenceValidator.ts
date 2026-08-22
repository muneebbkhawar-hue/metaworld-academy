// Second validation layer, beyond Zod's shape checks (schemas.ts): semantic
// consistency rules that a shape schema can't express. Never silently
// "fixes" data - it only flags a record with needs_review/needs_review_reason
// so the UI and human_review_required logic surface it, per the brief's
// explicit instruction that malformed/inconsistent AI data must never be
// silently rendered as trustworthy.
import type { SignallingQuestionRecord } from "@/app/lib/rob/types";
import type { AIAssessmentResponse } from "./schemas";

export function toSignallingRecords(raw: AIAssessmentResponse): Record<string, SignallingQuestionRecord[]> {
  const out: Record<string, SignallingQuestionRecord[]> = {};
  for (const [domainKey, questions] of Object.entries(raw.domains)) {
    out[domainKey] = questions.map((q) => {
      const record: SignallingQuestionRecord = { ...q, domain_key: domainKey };

      // Rule: a "direct" evidence status requires a non-empty quote.
      if (q.evidence_status === "direct" && (!q.supporting_text || q.supporting_text.trim().length === 0)) {
        record.needs_review = true;
        record.needs_review_reason = "Marked as direct evidence but no supporting quote was provided.";
      }
      // Rule: "absent" evidence should not carry a confident "Yes"/"No" answer.
      if (q.evidence_status === "absent" && q.answer !== "No information" && q.answer !== "Not applicable") {
        record.needs_review = true;
        record.needs_review_reason = "Evidence is marked absent but the answer is not 'No information'.";
      }
      // Rule: a claimed direct quote longer than what could plausibly
      // appear verbatim is a red flag for paraphrase-as-quote behavior.
      if (q.evidence_status === "direct" && q.supporting_text && q.supporting_text.length > 900) {
        record.needs_review = true;
        record.needs_review_reason = (record.needs_review_reason ? record.needs_review_reason + " " : "") + "Unusually long quoted passage - verify against the source PDF.";
      }
      return record;
    });
  }
  return out;
}
