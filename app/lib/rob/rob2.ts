// Deterministic RoB 2 decision engine.
//
// Source: Sterne JAC, Savović J, Page MJ, et al. RoB 2: a revised tool for
// assessing risk of bias in randomised trials. BMJ 2019;366:l4898, and the
// accompanying RoB 2 guidance document / Excel tool (current version dated
// 22 August 2019, per riskofbias.info). This implements the "effect of
// assignment to intervention" (intention-to-treat) estimand algorithm,
// which is the default and by far the most commonly used RoB 2 estimand -
// the alternative "effect of adherence" algorithm is NOT implemented here
// and is out of scope for this tool. This mapping is a careful, documented
// reconstruction of the official algorithm's logic, not a verbatim copy of
// the Excel tool's macros - for any case that matters for publication,
// cross-check the specific domain against the official RoB 2 Excel tool
// (see MethodologyPanel for the link). This is stated plainly in the UI so
// nobody mistakes this implementation for a certified, byte-for-byte
// reproduction.
//
// The AI never proposes a domain or overall judgment. It only answers the
// signalling questions below (with evidence); mapAnswer()/domain algorithms
// here compute the judgment deterministically and reproducibly from those
// answers - the same answers always produce the same judgment.
import type { RoB2Judgment, RoB2SignallingAnswer, SignallingQuestionRecord } from "./types";

export interface RoB2DomainDef {
  key: string;
  label: string;
  questions: { id: string; text: string }[];
}

export const ROB2_DOMAINS: RoB2DomainDef[] = [
  {
    key: "D1", label: "Bias arising from the randomization process",
    questions: [
      { id: "1.1", text: "Was the allocation sequence random?" },
      { id: "1.2", text: "Was the allocation sequence concealed until participants were enrolled and assigned to interventions?" },
      { id: "1.3", text: "Did baseline differences between intervention groups suggest a problem with the randomization process?" },
    ],
  },
  {
    key: "D2", label: "Bias due to deviations from intended interventions",
    questions: [
      { id: "2.1", text: "Were participants aware of their assigned intervention during the trial?" },
      { id: "2.2", text: "Were carers and people delivering the interventions aware of participants' assigned intervention during the trial?" },
      { id: "2.3", text: "If Y/PY/NI to 2.1 or 2.2: Were there deviations from the intended intervention that arose because of the trial context?" },
      { id: "2.4", text: "If Y/PY to 2.3: Were these deviations likely to have affected the outcome?" },
      { id: "2.5", text: "If Y/PY/NI to 2.4: Were these deviations from intended intervention balanced between groups?" },
      { id: "2.6", text: "Was an appropriate analysis used to estimate the effect of assignment to intervention?" },
      { id: "2.7", text: "If N/PN/NI to 2.6: Was there potential for a substantial impact (on the result) of the failure to analyze participants in the group to which they were randomized?" },
    ],
  },
  {
    key: "D3", label: "Bias due to missing outcome data",
    questions: [
      { id: "3.1", text: "Were data for this outcome available for all, or nearly all, participants randomized?" },
      { id: "3.2", text: "If N/PN/NI to 3.1: Is there evidence that the result was not biased by missing outcome data?" },
      { id: "3.3", text: "If N/PN to 3.2: Could missingness in the outcome depend on its true value?" },
      { id: "3.4", text: "If Y/PY/NI to 3.3: Is it likely that missingness in the outcome depended on its true value?" },
    ],
  },
  {
    key: "D4", label: "Bias in measurement of the outcome",
    questions: [
      { id: "4.1", text: "Was the method of measuring the outcome inappropriate?" },
      { id: "4.2", text: "Could measurement or ascertainment of the outcome have differed between intervention groups?" },
      { id: "4.3", text: "If N/PN/NI to 4.1 and 4.2: Were outcome assessors aware of the intervention received by study participants?" },
      { id: "4.4", text: "If Y/PY/NI to 4.3: Could assessment of the outcome have been influenced by knowledge of intervention received?" },
      { id: "4.5", text: "If Y/PY/NI to 4.4: Is it likely that assessment of the outcome was influenced by knowledge of intervention received?" },
    ],
  },
  {
    key: "D5", label: "Bias in selection of the reported result",
    questions: [
      { id: "5.1", text: "Were the data that produced this result analyzed in accordance with a pre-specified analysis plan that was finalized before unblinded outcome data were available for analysis?" },
      { id: "5.2", text: "Is the numerical result being assessed likely to have been selected, on the basis of the results, from multiple eligible outcome measurements within the outcome domain?" },
      { id: "5.3", text: "Is the numerical result being assessed likely to have been selected, on the basis of the results, from multiple eligible analyses of the data?" },
    ],
  },
];

// Y/PY collapse to "favorable"; N/PN collapse to "unfavorable"; NI is its
// own category; NA is treated as not-applicable (skipped).
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

function domain1(qs: SignallingQuestionRecord[]): RoB2Judgment {
  const b1 = bucket(answerFor(qs, "1.1") ?? "No information");
  const b2 = bucket(answerFor(qs, "1.2") ?? "No information");
  const b3 = bucket(answerFor(qs, "1.3") ?? "No information");
  if (b3 === "Y") return "High risk of bias"; // baseline imbalance suggests a problem
  if (b1 === "Y" && b2 === "Y" && (b3 === "N" || b3 === "NA")) return "Low risk of bias";
  if ((b1 === "N" || b2 === "N") && (b3 === "N" || b3 === "NA")) return "High risk of bias";
  return "Some concerns";
}

function domain2(qs: SignallingQuestionRecord[]): RoB2Judgment {
  const b23 = bucket(answerFor(qs, "2.3") ?? "No information");
  const b24 = bucket(answerFor(qs, "2.4") ?? "No information");
  const b25 = bucket(answerFor(qs, "2.5") ?? "No information");
  const b26 = bucket(answerFor(qs, "2.6") ?? "No information");
  const b27 = bucket(answerFor(qs, "2.7") ?? "No information");
  if (b23 === "N" || b23 === "NA") {
    // No deviations that arose because of the trial context - risk depends
    // only on whether an appropriate (ITT-consistent) analysis was used.
    return b26 === "Y" ? "Low risk of bias" : b27 === "Y" ? "High risk of bias" : "Some concerns";
  }
  if (b24 === "N" || b24 === "NA") {
    return b26 === "Y" ? "Low risk of bias" : "Some concerns";
  }
  // Deviations occurred and likely affected the outcome.
  if (b25 === "Y") return b26 === "Y" ? "Some concerns" : "High risk of bias"; // balanced across groups
  return "High risk of bias"; // unbalanced deviations that affected the outcome
}

function domain3(qs: SignallingQuestionRecord[]): RoB2Judgment {
  const b1 = bucket(answerFor(qs, "3.1") ?? "No information");
  const b2 = bucket(answerFor(qs, "3.2") ?? "No information");
  const b4 = bucket(answerFor(qs, "3.4") ?? "No information");
  if (b1 === "Y") return "Low risk of bias";
  if (b2 === "Y") return "Low risk of bias"; // evidence the result wasn't biased by missingness
  if (b4 === "Y") return "High risk of bias";
  if (b4 === "N") return "Some concerns";
  return "Some concerns";
}

function domain4(qs: SignallingQuestionRecord[]): RoB2Judgment {
  const b1 = bucket(answerFor(qs, "4.1") ?? "No information");
  const b2 = bucket(answerFor(qs, "4.2") ?? "No information");
  if (b1 === "Y" || b2 === "Y") return "High risk of bias";
  const b3 = bucket(answerFor(qs, "4.3") ?? "No information");
  if (b3 === "N") return "Low risk of bias";
  const b5 = bucket(answerFor(qs, "4.5") ?? "No information");
  if (b5 === "Y") return "High risk of bias";
  if (b5 === "N") return "Low risk of bias";
  return "Some concerns";
}

function domain5(qs: SignallingQuestionRecord[]): RoB2Judgment {
  const b1 = bucket(answerFor(qs, "5.1") ?? "No information");
  const b2 = bucket(answerFor(qs, "5.2") ?? "No information");
  const b3 = bucket(answerFor(qs, "5.3") ?? "No information");
  if (b1 === "Y" && b2 !== "Y" && b3 !== "Y") return "Low risk of bias";
  if (b2 === "Y" || b3 === "Y") return "High risk of bias";
  return "Some concerns";
}

export const ROB2_DOMAIN_FN: Record<string, (qs: SignallingQuestionRecord[]) => RoB2Judgment> = {
  D1: domain1, D2: domain2, D3: domain3, D4: domain4, D5: domain5,
};

// Overall judgment: worst-domain-wins, per the official RoB 2 algorithm -
// High if any domain is High, Some concerns if any domain has Some concerns
// (and none High), otherwise Low.
export function rob2Overall(domainJudgments: RoB2Judgment[]): RoB2Judgment {
  if (domainJudgments.some((j) => j === "High risk of bias")) return "High risk of bias";
  if (domainJudgments.some((j) => j === "Some concerns")) return "Some concerns";
  return "Low risk of bias";
}
