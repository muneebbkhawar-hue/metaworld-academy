import { ROB2_DOMAINS } from "@/app/lib/rob/rob2";
import { buildFrameworkPrompt } from "./shared";

export const ROB2_PROMPT = buildFrameworkPrompt(
  "RoB 2 (Cochrane risk-of-bias tool for randomized trials)",
  "This tool assumes the standard RoB 2 estimand: the effect of assignment to intervention (intention-to-treat). Only apply this if the paper is an individually-, cluster-, or crossover-randomized trial.",
  ROB2_DOMAINS
);
