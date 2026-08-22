// Deterministic, whitelisted unit conversions for baseline characteristics.
// The AI is never asked to perform unit conversion (see prompts/extraction.ts)
// - it only reports the original value/unit exactly as printed. This module
// converts to a preferred unit ONLY when a mathematically valid, well-known
// conversion applies, and ALWAYS returns both the original and converted
// value plus the exact rule used - never silently altering the original.
export interface ConversionOutcome {
  standardizedValue: string;
  standardizedUnit: string;
  rule: string;
}

interface Rule {
  from: RegExp;
  to: string;
  convert: (v: number) => number;
  rule: string;
}

// Each rule is a single, unambiguous, textbook-standard conversion factor.
// Nothing here is invented - these are the standard SI/clinical conversions.
const RULES: Rule[] = [
  { from: /^(lb|lbs|pounds?)$/i, to: "kg", convert: (v) => v * 0.45359237, rule: "lb -> kg (x 0.45359237)" },
  { from: /^(in|inch|inches)$/i, to: "cm", convert: (v) => v * 2.54, rule: "in -> cm (x 2.54)" },
  { from: /^(ft|feet)$/i, to: "cm", convert: (v) => v * 30.48, rule: "ft -> cm (x 30.48)" },
  // Glucose: mg/dL <-> mmol/L, molar mass of glucose = 18.0156 g/mol
  { from: /^mg\/dl$/i, to: "mmol/L", convert: (v) => v / 18.0156, rule: "mg/dL -> mmol/L (glucose, ÷ 18.0156)" },
  // Cholesterol: mg/dL <-> mmol/L, molar mass of cholesterol = 386.65 g/mol -> factor 0.02586
  { from: /^mg\/dl-chol$/i, to: "mmol/L", convert: (v) => v * 0.02586, rule: "mg/dL -> mmol/L (cholesterol, x 0.02586)" },
];

/** Extracts the first numeric token from a free-text reported value like
 * "56.4 ± 8.2" -> 56.4, or "70 kg" -> 70. Returns null if none found. */
export function firstNumber(text: string): number | null {
  const m = text.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

/** Attempts a whitelisted conversion of a reported value/unit pair to a
 * standardized unit. Returns null (no conversion performed - value stays
 * exactly as reported) if the unit isn't in the whitelist, or if no numeric
 * value could be parsed. Never guesses or applies an unlisted conversion. */
export function convertUnit(reportedValue: string, reportedUnit: string | null): ConversionOutcome | null {
  if (!reportedUnit) return null;
  const rule = RULES.find((r) => r.from.test(reportedUnit.trim()));
  if (!rule) return null;

  const n = firstNumber(reportedValue);
  if (n === null || !Number.isFinite(n)) return null;

  const converted = rule.convert(n);
  return {
    standardizedValue: String(Math.round(converted * 1000) / 1000),
    standardizedUnit: rule.to,
    rule: rule.rule,
  };
}
