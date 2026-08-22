import { QUADAS2_DOMAINS } from "@/app/lib/rob/quadas2";
import { buildFrameworkPrompt, type DomainQuestionSpec } from "./shared";

// QUADAS-2's domain defs separate risk-of-bias questions from the single
// applicability question per domain (see quadas2.ts) - flatten them into
// one question list per domain for the prompt, so the AI answers both sets
// in a single pass. Question IDs already distinguish them ("1.1"-"1.3" are
// risk-of-bias, "1.A" is applicability), and quadas2.ts reads them back out
// by ID, so nothing is lost by flattening here.
const domainsForPrompt: DomainQuestionSpec[] = QUADAS2_DOMAINS.map((d) => ({
  key: d.key,
  label: d.label,
  questions: d.applicabilityQuestion ? [...d.robQuestions, d.applicabilityQuestion] : d.robQuestions,
}));

export const QUADAS2_PROMPT = buildFrameworkPrompt(
  "QUADAS-2 (tool for quality assessment of diagnostic accuracy studies)",
  "Only apply this if the paper is a diagnostic accuracy study (evaluating an index test against a reference standard). Domains D1-D3 have both a risk-of-bias judgment and a separate applicability-concern judgment (the '.A' question); D4 (Flow and timing) has risk of bias only, no applicability question.",
  domainsForPrompt
);
