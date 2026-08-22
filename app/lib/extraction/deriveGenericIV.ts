// Deterministic derivation of log-effect + SE for generic inverse-variance
// outcomes. Reuses the SAME exact, already-tested formula from the
// Statistical Conversions tool (app/lib/statConversions/conversions.ts,
// conversion E: OR/RR/HR + 95% CI -> log effect + SE) rather than
// re-implementing it - one source of truth for this formula across the app.
// Never invoked for MD/SMD (already on a linear, not ratio, scale) or when
// estimate/CI are missing or invalid.
import { ratioCIToLogSE, ConversionInputError, type RatioMeasure } from "../statConversions/conversions.ts";
import type { GenericIVOutcomeRecord } from "./types";

export function deriveLogEffectAndSE(record: Pick<GenericIVOutcomeRecord, "effect_measure" | "estimate" | "lower_ci" | "upper_ci">): { log_effect: number; se: number } | null {
  const { effect_measure, estimate, lower_ci, upper_ci } = record;
  if (effect_measure !== "OR" && effect_measure !== "RR" && effect_measure !== "HR") return null;
  if (estimate === null || lower_ci === null || upper_ci === null) return null;

  try {
    const result = ratioCIToLogSE(effect_measure as RatioMeasure, estimate, lower_ci, upper_ci);
    const logEffect = result.values.find((v) => v.label.startsWith("log("))?.value;
    const se = result.values.find((v) => v.label === "SE of log effect")?.value;
    if (logEffect === undefined || se === undefined) return null;
    return { log_effect: logEffect, se };
  } catch (err) {
    // Invalid/inconsistent CI (e.g. lower >= upper, estimate outside CI) -
    // deliberately not derived rather than silently producing a bad value.
    if (err instanceof ConversionInputError) return null;
    throw err;
  }
}
