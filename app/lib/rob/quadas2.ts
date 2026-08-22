// Deterministic QUADAS-2 decision engine.
//
// Source: Whiting PF, Rutjes AWS, Westwood ME, et al. QUADAS-2: A Revised
// Tool for the Quality Assessment of Diagnostic Accuracy Studies. Ann
// Intern Med 2011;155:529-536. As with rob2.ts/robinsI.ts, this is a
// careful, documented reconstruction of the official domain logic, not a
// verbatim reproduction - cross-check anything that matters for
// publication against the official QUADAS-2 tool (linked in
// MethodologyPanel). Risk of bias and applicability concerns are kept
// STRICTLY SEPARATE per the official framework and are never combined
// into a single score.
import type { Quadas2Judgment, RoB2SignallingAnswer, SignallingQuestionRecord } from "./types";

export interface Quadas2DomainDef {
  key: string;
  label: string;
  robQuestions: { id: string; text: string }[];
  applicabilityQuestion: { id: string; text: string } | null; // null for Flow & timing
}

export const QUADAS2_DOMAINS: Quadas2DomainDef[] = [
  {
    key: "D1", label: "Patient selection",
    robQuestions: [
      { id: "1.1", text: "Was a consecutive or random sample of patients enrolled?" },
      { id: "1.2", text: "Was a case-control design avoided?" },
      { id: "1.3", text: "Did the study avoid inappropriate exclusions?" },
    ],
    applicabilityQuestion: { id: "1.A", text: "Is there concern that the included patients do not match the review question?" },
  },
  {
    key: "D2", label: "Index test",
    robQuestions: [
      { id: "2.1", text: "Were the index test results interpreted without knowledge of the results of the reference standard?" },
      { id: "2.2", text: "If a threshold was used, was it pre-specified?" },
    ],
    applicabilityQuestion: { id: "2.A", text: "Is there concern that the index test, its conduct, or its interpretation differ from the review question?" },
  },
  {
    key: "D3", label: "Reference standard",
    robQuestions: [
      { id: "3.1", text: "Is the reference standard likely to correctly classify the target condition?" },
      { id: "3.2", text: "Were the reference standard results interpreted without knowledge of the results of the index test?" },
    ],
    applicabilityQuestion: { id: "3.A", text: "Is there concern that the target condition as defined by the reference standard does not match the review question?" },
  },
  {
    key: "D4", label: "Flow and timing",
    robQuestions: [
      { id: "4.1", text: "Was there an appropriate interval between index test and reference standard?" },
      { id: "4.2", text: "Did all patients receive a reference standard?" },
      { id: "4.3", text: "Did all patients receive the same reference standard?" },
      { id: "4.4", text: "Were all patients included in the analysis?" },
    ],
    applicabilityQuestion: null,
  },
];

function bucket(a: RoB2SignallingAnswer): "Y" | "N" | "NI" | "NA" {
  if (a === "Yes" || a === "Probably yes") return "Y";
  if (a === "No" || a === "Probably no") return "N";
  if (a === "Not applicable") return "NA";
  return "NI";
}

function answerFor(qs: SignallingQuestionRecord[], id: string): RoB2SignallingAnswer | null {
  const q = qs.find((x) => x.question_id === id);
  return (q?.answer as RoB2SignallingAnswer) ?? null;
}

// Standard QUADAS-2 convention: High if ANY signalling question in the
// domain flags a concern (answered No); Low only if ALL applicable
// signalling questions are answered Yes; Unclear otherwise (insufficient
// information to rule concern in or out).
export function judgeSignallingSet(qs: SignallingQuestionRecord[], ids: string[]): Quadas2Judgment {
  const answers = ids.map((id) => bucket(answerFor(qs, id) ?? "No information")).filter((b) => b !== "NA");
  if (answers.length === 0) return "Unclear";
  if (answers.some((b) => b === "N")) return "High";
  if (answers.every((b) => b === "Y")) return "Low";
  return "Unclear";
}

export function quadas2RobJudgment(domainKey: string, qs: SignallingQuestionRecord[]): Quadas2Judgment {
  const def = QUADAS2_DOMAINS.find((d) => d.key === domainKey)!;
  return judgeSignallingSet(qs, def.robQuestions.map((q) => q.id));
}

export function quadas2ApplicabilityJudgment(domainKey: string, qs: SignallingQuestionRecord[]): Quadas2Judgment | null {
  const def = QUADAS2_DOMAINS.find((d) => d.key === domainKey)!;
  if (!def.applicabilityQuestion) return null;
  // The applicability signalling question is phrased as a concern ("Is
  // there concern that...") so Yes=concern=High, No=no concern=Low.
  const a = answerFor(qs, def.applicabilityQuestion.id);
  if (!a) return "Unclear";
  const b = bucket(a);
  if (b === "Y") return "High";
  if (b === "N") return "Low";
  return "Unclear";
}

// Overall risk-of-bias judgment: worst-domain-wins across all 4 RoB
// domains (High if any High, Unclear if any Unclear and none High,
// otherwise Low) - per standard QUADAS-2 summary convention.
export function quadas2Overall(domainJudgments: Quadas2Judgment[]): Quadas2Judgment {
  if (domainJudgments.some((j) => j === "High")) return "High";
  if (domainJudgments.some((j) => j === "Unclear")) return "Unclear";
  return "Low";
}
