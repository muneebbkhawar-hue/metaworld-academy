// Shared prompt-building logic used by the three framework-specific prompt
// files (rob2.ts, robinsI.ts, quadas2.ts in this directory). Each of those
// files calls this with ITS OWN domain/question list and produces a
// genuinely distinct final prompt - this only factors out the boilerplate
// rules that are identical across all three frameworks (no-hallucination
// policy, JSON-only output, quote-vs-paraphrase distinction), matching the
// brief's explicit "separate authoritative system prompts, not one generic
// prompt" requirement while not hand-duplicating the shared ground rules
// three times.
export interface DomainQuestionSpec {
  key: string;
  label: string;
  questions: { id: string; text: string }[];
}

const NO_HALLUCINATION_RULES = `
GROUND RULES (follow exactly - violating any of these makes your response unusable):
1. Never invent evidence. Every "supporting_text" must be an ACTUAL passage copied verbatim from the PDF, or null.
2. Never invent page numbers. If you cannot determine the page, use null - do not guess.
3. Never fabricate quotations. Do not paraphrase and then wrap the paraphrase in quotes - if you are paraphrasing, put the paraphrase in "reasoning" instead and set supporting_text to null with evidence_status "indirect".
4. If information is missing from the paper, answer "No information" - do not guess or infer.
5. Do not infer a methodological feature merely because it is conventional (e.g. do not assume "randomized" implies adequate allocation concealment, "double blind" resolves every blinding concern, "prospective" implies low risk of bias, "adjusted analysis" implies all confounding was controlled, or "consecutive patients" implies every applicability concern is low).
6. Do not treat the abstract as sufficient when the Methods or Results sections contain more specific relevant information - read the whole paper.
7. If conflicting information exists in different parts of the paper, note the conflict in "reasoning" and lower your "confidence".
8. If the paper is ambiguous, lower "confidence" rather than picking an answer with false certainty.
9. For every signalling question, evidence_status must be "direct" (an exact quoted passage supports the answer), "indirect" (you inferred the answer from related but non-explicit text - explain in reasoning), or "absent" (the paper does not address this at all - answer "No information").
10. Return ONLY the JSON object described below. No prose, no markdown fences, no commentary outside the JSON.
`.trim();

const RESPONSE_FORMAT = `
RESPONSE FORMAT (JSON only):
{
  "study_design": {
    "study_design": "<one of: Randomized controlled trial | Cluster randomized trial | Crossover randomized trial | Non-randomized study of interventions | Cohort study | Case-control study | Cross-sectional study | Diagnostic accuracy study | Systematic review/meta-analysis | Protocol | Editorial/commentary | Other/unclear>",
    "confidence": <0-1>,
    "evidence": "<a real quoted passage from the Methods section describing the design, or null>",
    "page": <page number or null>
  },
  "readable": <true|false - false only if the PDF's extractable text is clearly insufficient for reliable assessment, e.g. a scanned image with no usable OCR layer>,
  "readability_note": "<explanation if readable is false, otherwise null>",
  "domains": {
    "<domain key, e.g. D1>": [
      {
        "question_id": "<e.g. 1.1>",
        "answer": "<one of: Yes | Probably yes | Probably no | No | No information | Not applicable>",
        "evidence_status": "<direct|indirect|absent>",
        "supporting_text": "<verbatim quote or null>",
        "page": <page number or null>,
        "section": "<e.g. Methods, Results, or null>",
        "confidence": <0-1>,
        "reasoning": "<your reasoning, 1-3 sentences>"
      }
      // one object per signalling question listed for this domain below
    ]
  }
}
`.trim();

export function buildFrameworkPrompt(frameworkLabel: string, frameworkScope: string, domains: DomainQuestionSpec[]): string {
  const domainBlock = domains
    .map((d) => {
      const qs = d.questions.map((q) => `  - ${q.id}: ${q.text}`).join("\n");
      return `${d.key} - ${d.label}:\n${qs}`;
    })
    .join("\n\n");

  return `
You are assisting a systematic reviewer with a ${frameworkLabel} risk-of-bias assessment. ${frameworkScope}

Read the entire attached PDF (not just the abstract) and answer every signalling question below for the study it reports. Base every answer strictly on what the paper actually states.

${NO_HALLUCINATION_RULES}

DOMAINS AND SIGNALLING QUESTIONS TO ANSWER (answer every question for every domain listed):

${domainBlock}

${RESPONSE_FORMAT}
`.trim();
}
