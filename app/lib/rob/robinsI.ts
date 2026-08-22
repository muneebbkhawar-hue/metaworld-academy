// Deterministic ROBINS-I decision engine.
//
// Source: Sterne JAC, Hernán MA, Reeves BC, et al. ROBINS-I: a tool for
// assessing risk of bias in non-randomised studies of interventions. BMJ
// 2016;355:i4919. As with rob2.ts, this is a careful, documented
// reconstruction of the official domain algorithms' logic and NOT a
// verbatim reproduction of the official Excel/Word tool - for anything
// that matters for publication, cross-check against the official ROBINS-I
// tool (linked in MethodologyPanel). The AI only answers signalling
// questions with evidence; judgments are computed here, deterministically.
import type { RobinsIJudgment, RoB2SignallingAnswer, SignallingQuestionRecord } from "./types";

export interface RobinsIDomainDef {
  key: string;
  label: string;
  questions: { id: string; text: string }[];
}

export const ROBINS_I_DOMAINS: RobinsIDomainDef[] = [
  {
    key: "D1", label: "Bias due to confounding",
    questions: [
      { id: "1.1", text: "Is there potential for confounding of the effect of intervention in this study?" },
      { id: "1.2", text: "Was the analysis based on splitting participants' follow-up time according to intervention received?" },
      { id: "1.3", text: "Were intervention discontinuations or switches likely to be related to factors that are prognostic for the outcome?" },
      { id: "1.4", text: "Did the authors use an appropriate analysis method that controlled for all the important confounding domains?" },
      { id: "1.5", text: "Were confounding domains that were controlled for measured validly and reliably by the variables available in this study?" },
      { id: "1.6", text: "Did the authors control for any post-intervention variables that could have been affected by the intervention?" },
      { id: "1.7", text: "Were there important confounding domains that were not controlled for?" },
    ],
  },
  {
    key: "D2", label: "Bias in selection of participants into the study",
    questions: [
      { id: "2.1", text: "Was selection of participants into the study (or into the analysis) based on participant characteristics observed after the start of intervention?" },
      { id: "2.2", text: "Were the post-intervention variables that influenced selection likely to be associated with intervention?" },
      { id: "2.3", text: "Were the post-intervention variables that influenced selection likely to be influenced by the outcome or a cause of the outcome?" },
      { id: "2.4", text: "Do start of follow-up and start of intervention coincide for most participants?" },
    ],
  },
  {
    key: "D3", label: "Bias in classification of interventions",
    questions: [
      { id: "3.1", text: "Were intervention groups clearly defined?" },
      { id: "3.2", text: "Was the information used to define intervention groups recorded at the start of the intervention?" },
      { id: "3.3", text: "Could classification of intervention status have been affected by knowledge of the outcome or risk of the outcome?" },
    ],
  },
  {
    key: "D4", label: "Bias due to deviations from intended interventions",
    questions: [
      { id: "4.1", text: "Were there deviations from the intended intervention beyond what would be expected in usual practice?" },
      { id: "4.2", text: "If Y/PY to 4.1: were these deviations unbalanced between groups and likely to have affected the outcome?" },
      { id: "4.3", text: "Was an appropriate analysis used to estimate the effect of starting and adhering to intervention?" },
      { id: "4.4", text: "If N/PN/NI to 4.3: was there potential for a substantial impact on the result of the failure to analyze participants in the group to which they were assigned?" },
    ],
  },
  {
    key: "D5", label: "Bias due to missing data",
    questions: [
      { id: "5.1", text: "Were outcome data available for all, or nearly all, participants?" },
      { id: "5.2", text: "Were participants excluded due to missing data on intervention status?" },
      { id: "5.3", text: "Were participants excluded due to missing data on other variables needed for the analysis?" },
      { id: "5.4", text: "If Y/PY to 5.2 or 5.3: is there evidence that results were robust to the presence of missing data?" },
    ],
  },
  {
    key: "D6", label: "Bias in measurement of outcomes",
    questions: [
      { id: "6.1", text: "Could the outcome measure have been influenced by knowledge of the intervention received?" },
      { id: "6.2", text: "Were outcome assessors aware of the intervention received by study participants?" },
      { id: "6.3", text: "Were the methods of outcome assessment comparable across intervention groups?" },
      { id: "6.4", text: "Were any systematic errors in measurement of the outcome related to intervention received?" },
    ],
  },
  {
    key: "D7", label: "Bias in selection of the reported result",
    questions: [
      { id: "7.1", text: "Is the reported effect estimate likely to be selected, on the basis of the results, from multiple outcome measurements within the outcome domain?" },
      { id: "7.2", text: "Is the reported effect estimate likely to be selected, on the basis of the results, from multiple analyses of the intervention-outcome relationship?" },
      { id: "7.3", text: "Is the reported effect estimate likely to be selected, on the basis of the results, from different subgroups?" },
    ],
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

function anyNI(qs: SignallingQuestionRecord[], ids: string[]): boolean {
  return ids.every((id) => bucket(answerFor(qs, id) ?? "No information") === "NI");
}

function domain1(qs: SignallingQuestionRecord[]): RobinsIJudgment {
  if (anyNI(qs, ["1.1", "1.4", "1.7"])) return "No information";
  const noConfounding = bucket(answerFor(qs, "1.1") ?? "No information") === "N";
  if (noConfounding) return "Low";
  const controlled = bucket(answerFor(qs, "1.4") ?? "No information") === "Y";
  const validMeasures = bucket(answerFor(qs, "1.5") ?? "No information") === "Y";
  const uncontrolledImportant = bucket(answerFor(qs, "1.7") ?? "No information") === "Y";
  const postInterventionAdjustment = bucket(answerFor(qs, "1.6") ?? "No information") === "Y";
  if (uncontrolledImportant || postInterventionAdjustment) return "Serious";
  if (controlled && validMeasures) return "Low";
  if (controlled && !validMeasures) return "Moderate";
  return "Serious";
}

function domain2(qs: SignallingQuestionRecord[]): RobinsIJudgment {
  const b1 = bucket(answerFor(qs, "2.1") ?? "No information");
  if (b1 === "N") return "Low";
  if (anyNI(qs, ["2.1", "2.2", "2.3"])) return "No information";
  const b2 = bucket(answerFor(qs, "2.2") ?? "No information");
  const b3 = bucket(answerFor(qs, "2.3") ?? "No information");
  if (b2 === "Y" && b3 === "Y") return "Serious";
  if (b2 === "Y" || b3 === "Y") return "Moderate";
  return "Low";
}

function domain3(qs: SignallingQuestionRecord[]): RobinsIJudgment {
  const b1 = bucket(answerFor(qs, "3.1") ?? "No information");
  const b2 = bucket(answerFor(qs, "3.2") ?? "No information");
  const b3 = bucket(answerFor(qs, "3.3") ?? "No information");
  if (anyNI(qs, ["3.1", "3.2", "3.3"])) return "No information";
  if (b1 === "Y" && b2 === "Y" && b3 === "N") return "Low";
  if (b3 === "Y") return "Serious";
  return "Moderate";
}

function domain4(qs: SignallingQuestionRecord[]): RobinsIJudgment {
  const b1 = bucket(answerFor(qs, "4.1") ?? "No information");
  if (b1 === "N") return "Low";
  if (anyNI(qs, ["4.1", "4.3"])) return "No information";
  const b2 = bucket(answerFor(qs, "4.2") ?? "No information");
  const b3 = bucket(answerFor(qs, "4.3") ?? "No information");
  const b4 = bucket(answerFor(qs, "4.4") ?? "No information");
  if (b2 === "Y" && b3 !== "Y") return "Serious";
  if (b3 === "Y") return "Low";
  if (b4 === "Y") return "Serious";
  return "Moderate";
}

function domain5(qs: SignallingQuestionRecord[]): RobinsIJudgment {
  const b1 = bucket(answerFor(qs, "5.1") ?? "No information");
  if (b1 === "Y") return "Low";
  if (anyNI(qs, ["5.1", "5.4"])) return "No information";
  const b4 = bucket(answerFor(qs, "5.4") ?? "No information");
  if (b4 === "Y") return "Moderate";
  return "Serious";
}

function domain6(qs: SignallingQuestionRecord[]): RobinsIJudgment {
  const b1 = bucket(answerFor(qs, "6.1") ?? "No information");
  if (b1 === "N") return "Low";
  if (anyNI(qs, ["6.1", "6.2", "6.4"])) return "No information";
  const b2 = bucket(answerFor(qs, "6.2") ?? "No information");
  const b4 = bucket(answerFor(qs, "6.4") ?? "No information");
  if (b4 === "Y") return "Serious";
  if (b2 === "N") return "Low";
  return "Moderate";
}

function domain7(qs: SignallingQuestionRecord[]): RobinsIJudgment {
  const b1 = bucket(answerFor(qs, "7.1") ?? "No information");
  const b2 = bucket(answerFor(qs, "7.2") ?? "No information");
  const b3 = bucket(answerFor(qs, "7.3") ?? "No information");
  if (anyNI(qs, ["7.1", "7.2", "7.3"])) return "No information";
  if (b1 === "N" && b2 === "N" && b3 === "N") return "Low";
  if (b1 === "Y" || b2 === "Y" || b3 === "Y") return "Serious";
  return "Moderate";
}

export const ROBINS_I_DOMAIN_FN: Record<string, (qs: SignallingQuestionRecord[]) => RobinsIJudgment> = {
  D1: domain1, D2: domain2, D3: domain3, D4: domain4, D5: domain5, D6: domain6, D7: domain7,
};

const ORDER: RobinsIJudgment[] = ["Low", "Moderate", "Serious", "Critical", "No information"];

// Worst-domain-wins per the official algorithm, EXCEPT that "No information"
// only wins the overall judgment when there is no worse (Low/Moderate/
// Serious/Critical) domain already present - an unassessable domain should
// not silently overrule a domain that WAS assessed as seriously biased.
export function robinsIOverall(domainJudgments: RobinsIJudgment[]): RobinsIJudgment {
  const rank: Record<RobinsIJudgment, number> = { Low: 0, Moderate: 1, Serious: 2, Critical: 3, "No information": -1 };
  const assessed = domainJudgments.filter((j) => j !== "No information");
  if (assessed.length === 0) return "No information";
  let worst: RobinsIJudgment = "Low";
  for (const j of assessed) if (rank[j] > rank[worst]) worst = j;
  return worst;
}

export { ORDER as ROBINS_I_JUDGMENT_ORDER };
