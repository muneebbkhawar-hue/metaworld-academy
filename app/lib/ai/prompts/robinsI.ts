import { ROBINS_I_DOMAINS } from "@/app/lib/rob/robinsI";
import { buildFrameworkPrompt } from "./shared";

export const ROBINS_I_PROMPT = buildFrameworkPrompt(
  "ROBINS-I (Cochrane risk-of-bias tool for non-randomized studies of interventions)",
  "Only apply this if the paper is a non-randomized study evaluating the effect of an intervention (e.g. a cohort or case-control design). Do not assume every observational study is eligible - it must specifically evaluate an intervention's effect.",
  ROBINS_I_DOMAINS
);
