// Framework compatibility gate - a CRITICAL safety check that runs before
// any risk-of-bias assessment is performed. If the detected study design
// is incompatible with the selected framework, the assessment MUST NOT
// proceed; the study is rejected with a clear explanation and a
// recommended alternative framework instead.
import type { CompatibilityResult, Framework, StudyDesign } from "./types";

const RANDOMIZED_DESIGNS: StudyDesign[] = [
  "Randomized controlled trial",
  "Cluster randomized trial",
  "Crossover randomized trial",
];

const NON_RANDOMIZED_INTERVENTION_DESIGNS: StudyDesign[] = [
  "Non-randomized study of interventions",
  "Cohort study",
  "Case-control study",
];

export function checkCompatibility(design: StudyDesign, designConfidence: number, framework: Framework): CompatibilityResult {
  // Low-confidence classification: never silently proceed - the caller
  // (route.ts) treats this as "needs human confirmation" before any
  // framework-specific work happens, per brief §6/§15.
  if (designConfidence < 0.5) {
    return {
      compatible: false,
      reason: "Study design could not be determined with sufficient confidence. Please verify the study design before continuing.",
      recommended_framework: null,
    };
  }

  if (framework === "RoB2") {
    if (RANDOMIZED_DESIGNS.includes(design)) {
      return { compatible: true, reason: "This paper appears to be a randomized trial, which RoB 2 is designed to assess.", recommended_framework: null };
    }
    if (NON_RANDOMIZED_INTERVENTION_DESIGNS.includes(design)) {
      return {
        compatible: false,
        reason: "This paper appears to be a non-randomized study. RoB 2 is intended for randomized trials. Consider ROBINS-I if the study evaluates an intervention.",
        recommended_framework: "ROBINS-I",
      };
    }
    if (design === "Diagnostic accuracy study") {
      return {
        compatible: false,
        reason: "This paper appears to be a diagnostic accuracy study. RoB 2 is intended for randomized trials; QUADAS-2 is the appropriate framework for diagnostic accuracy studies.",
        recommended_framework: "QUADAS-2",
      };
    }
    return {
      compatible: false,
      reason: `This paper was classified as "${design}", which does not match a randomized-trial design. RoB 2 is intended for randomized trials.`,
      recommended_framework: null,
    };
  }

  if (framework === "ROBINS-I") {
    if (RANDOMIZED_DESIGNS.includes(design)) {
      return {
        compatible: false,
        reason: "This paper appears to be a randomized trial. RoB 2 is the appropriate framework for randomized trials.",
        recommended_framework: "RoB2",
      };
    }
    if (NON_RANDOMIZED_INTERVENTION_DESIGNS.includes(design)) {
      return { compatible: true, reason: "This paper appears to be a non-randomized study of an intervention, which ROBINS-I is designed to assess.", recommended_framework: null };
    }
    if (design === "Diagnostic accuracy study") {
      return {
        compatible: false,
        reason: "This paper appears to be a diagnostic accuracy study rather than a non-randomized intervention study. QUADAS-2 is the appropriate framework.",
        recommended_framework: "QUADAS-2",
      };
    }
    // Observational but not clearly an intervention-effect design (e.g.
    // cross-sectional, unclear) - flag for human review rather than guess.
    return {
      compatible: false,
      reason: `This paper was classified as "${design}". ROBINS-I applies to non-randomized studies that evaluate an intervention's effect - this classification does not clearly meet that scope. Human review is required before proceeding.`,
      recommended_framework: null,
    };
  }

  // QUADAS-2
  if (design === "Diagnostic accuracy study") {
    return { compatible: true, reason: "This paper appears to be a diagnostic accuracy study, which QUADAS-2 is designed to assess.", recommended_framework: null };
  }
  if (RANDOMIZED_DESIGNS.includes(design)) {
    return {
      compatible: false,
      reason: "This paper appears to be a randomized trial rather than a diagnostic accuracy study. QUADAS-2 should not be applied. RoB 2 is the appropriate framework.",
      recommended_framework: "RoB2",
    };
  }
  if (NON_RANDOMIZED_INTERVENTION_DESIGNS.includes(design)) {
    return {
      compatible: false,
      reason: "This paper does not appear to be a diagnostic accuracy study. QUADAS-2 should not be applied automatically. ROBINS-I may be appropriate if this is a non-randomized intervention study.",
      recommended_framework: "ROBINS-I",
    };
  }
  return {
    compatible: false,
    reason: `This paper does not appear to be a diagnostic accuracy study (classified as "${design}"). QUADAS-2 should not be applied.`,
    recommended_framework: null,
  };
}
