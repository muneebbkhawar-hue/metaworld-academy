// Statistical conversion calculation layer - deliberately separated from
// any UI code. Every function here is a pure function: given validated
// inputs, it returns a result with full floating-point precision (rounding
// for display happens only in the UI layer). Each result is labeled with
// its ConversionCertainty so the UI can never present an estimate as exact.
//
// SOURCES (preserved here and surfaced in the UI's "Method" section - never
// fabricated):
//   - Wan X, Wang W, Liu J, Tong T. Estimating the sample mean and standard
//     deviation from the sample size, median, range and/or interquartile
//     range. BMC Med Res Methodol. 2014;14:135. (median/range/IQR -> mean/SD)
//   - Normal-distribution relationship between SD and IQR (IQR = 2 * z_0.75 * SD,
//     z_0.75 = qnorm(0.75) ≈ 0.6744898) for the mean/SD -> median/IQR
//     approximation - a direct property of the normal distribution, not a
//     separate published "method" to cite.
//   - Standard CI/SE relationships (Higgins & Green, Cochrane Handbook,
//     section 6.3): SE = (upper - lower) / (2 * z), and the analogous
//     log-scale relationship for ratio measures (OR/RR/HR).
import { qnorm, zFor, round } from "./numeric.ts";

export type ConversionCertainty = "exact" | "estimated" | "assumption-based";

export interface ConversionResult {
  certainty: ConversionCertainty;
  method: string;
  reference: string;
  assumptions: string[];
  warnings: string[];
  values: { label: string; value: number; decimals?: number }[];
}

export class ConversionInputError extends Error {}

function requirePositive(name: string, v: number) {
  if (!Number.isFinite(v) || v <= 0) throw new ConversionInputError(`${name} must be a positive number.`);
}
function requireNonNegative(name: string, v: number) {
  if (!Number.isFinite(v) || v < 0) throw new ConversionInputError(`${name} must be zero or a positive number.`);
}
function requireInteger(name: string, v: number) {
  if (!Number.isFinite(v) || !Number.isInteger(v)) throw new ConversionInputError(`${name} must be a whole number.`);
}

// --- A. Median + IQR -> Mean + SD (Wan 2014, IQR-only estimator) ----------
export function medianIQRToMeanSD(median: number, q1: number, q3: number, n: number): ConversionResult {
  requireInteger("Sample size (n)", n);
  if (n < 2) throw new ConversionInputError("Sample size (n) must be at least 2.");
  if (!Number.isFinite(median) || !Number.isFinite(q1) || !Number.isFinite(q3)) throw new ConversionInputError("Median, Q1, and Q3 are all required.");
  if (q1 > median) throw new ConversionInputError("Q1 cannot be greater than the median.");
  if (median > q3) throw new ConversionInputError("The median cannot be greater than Q3.");

  const mean = (q1 + median + q3) / 3;
  const z = qnorm((0.75 * n - 0.125) / (n + 0.25));
  const sd = (q3 - q1) / (2 * z);

  const warnings: string[] = [];
  if (n < 25) warnings.push("Wan et al. (2014) note this estimator is most reliable for n ≥ 25; treat the result with additional caution for smaller samples.");
  if (sd < 0) throw new ConversionInputError("Computed SD is negative - check that Q1 ≤ median ≤ Q3 and n is correct.");

  return {
    certainty: "estimated",
    method: "Wan et al. (2014) IQR-based estimator (their Method 3 / C3, using n, Q1, median, Q3 only).",
    reference: "Wan X, Wang W, Liu J, Tong T. BMC Med Res Methodol. 2014;14:135.",
    assumptions: ["The underlying distribution is assumed to be approximately normal (or not heavily skewed) for the estimate to be reliable.", "Q1 and Q3 are the true sample lower/upper quartiles."],
    warnings,
    values: [
      { label: "Estimated Mean", value: mean },
      { label: "Estimated SD", value: sd },
    ],
  };
}

// --- B. Median + Range -> Mean + SD (Wan 2014, range-only estimator) -----
export function medianRangeToMeanSD(median: number, min: number, max: number, n: number): ConversionResult {
  requireInteger("Sample size (n)", n);
  if (n < 2) throw new ConversionInputError("Sample size (n) must be at least 2.");
  if (!Number.isFinite(median) || !Number.isFinite(min) || !Number.isFinite(max)) throw new ConversionInputError("Median, minimum, and maximum are all required.");
  if (min > median) throw new ConversionInputError("The minimum cannot be greater than the median.");
  if (median > max) throw new ConversionInputError("The median cannot be greater than the maximum.");

  const mean = (min + 2 * median + max) / 4;
  const z = qnorm((n - 0.375) / (n + 0.25));
  const sd = (max - min) / (2 * z);

  const warnings: string[] = [
    "Range-based SD estimates are the least precise of the three Wan (2014) methods, especially for larger n where the range is dominated by extreme values - prefer the IQR or five-number-summary methods when Q1/Q3 are available.",
  ];
  if (n < 25) warnings.push("Wan et al. (2014) note this estimator is most reliable for n ≥ 25; treat the result with additional caution for smaller samples.");
  if (sd < 0) throw new ConversionInputError("Computed SD is negative - check that min ≤ median ≤ max and n is correct.");

  return {
    certainty: "estimated",
    method: "Wan et al. (2014) range-based estimator (their Method 1 / C1, using n, min, median, max only).",
    reference: "Wan X, Wang W, Liu J, Tong T. BMC Med Res Methodol. 2014;14:135.",
    assumptions: ["The underlying distribution is assumed to be approximately normal (or not heavily skewed) for the estimate to be reliable.", "Min and max are the true sample minimum and maximum (not, e.g., 5th/95th percentiles)."],
    warnings,
    values: [
      { label: "Estimated Mean", value: mean },
      { label: "Estimated SD", value: sd },
    ],
  };
}

// --- C. Five-number summary -> Mean + SD (Wan 2014, combined estimator) --
export function fiveNumberSummaryToMeanSD(min: number, q1: number, median: number, q3: number, max: number, n: number): ConversionResult {
  requireInteger("Sample size (n)", n);
  if (n < 2) throw new ConversionInputError("Sample size (n) must be at least 2.");
  for (const [name, v] of [["Minimum", min], ["Q1", q1], ["Median", median], ["Q3", q3], ["Maximum", max]] as [string, number][]) {
    if (!Number.isFinite(v)) throw new ConversionInputError(`${name} is required.`);
  }
  if (min > q1) throw new ConversionInputError("The minimum cannot be greater than Q1.");
  if (q1 > median) throw new ConversionInputError("Q1 cannot be greater than the median.");
  if (median > q3) throw new ConversionInputError("The median cannot be greater than Q3.");
  if (q3 > max) throw new ConversionInputError("Q3 cannot be greater than the maximum.");

  const mean = (min + 2 * q1 + 2 * median + 2 * q3 + max) / 8;
  const zRange = qnorm((n - 0.375) / (n + 0.25));
  const zIqr = qnorm((0.75 * n - 0.125) / (n + 0.25));
  const sdFromRange = (max - min) / (2 * zRange);
  const sdFromIqr = (q3 - q1) / (2 * zIqr);
  const sd = 0.5 * (sdFromRange + sdFromIqr);

  const warnings: string[] = [];
  if (n < 25) warnings.push("Wan et al. (2014) note this estimator is most reliable for n ≥ 25; treat the result with additional caution for smaller samples.");
  if (sd < 0) throw new ConversionInputError("Computed SD is negative - check the five-number summary is correctly ordered and n is correct.");

  return {
    certainty: "estimated",
    method: "Wan et al. (2014) combined range-and-IQR estimator (their Method 2 / C2, averaging the range-based and IQR-based SD estimates).",
    reference: "Wan X, Wang W, Liu J, Tong T. BMC Med Res Methodol. 2014;14:135.",
    assumptions: ["The underlying distribution is assumed to be approximately normal (or not heavily skewed) for the estimate to be reliable.", "Min, Q1, median, Q3, and max form a genuine five-number summary (min ≤ Q1 ≤ median ≤ Q3 ≤ max)."],
    warnings,
    values: [
      { label: "Estimated Mean", value: mean },
      { label: "Estimated SD", value: sd },
    ],
  };
}

// --- D. Mean + SD -> Median + IQR (normal-distribution approximation) ----
export function meanSDToMedianIQR(mean: number, sd: number, n: number): ConversionResult {
  requireInteger("Sample size (n)", n);
  if (n < 1) throw new ConversionInputError("Sample size (n) must be at least 1.");
  if (!Number.isFinite(mean)) throw new ConversionInputError("Mean is required.");
  requireNonNegative("SD", sd);

  const z75 = qnorm(0.75); // ≈ 0.6744898
  const q1 = mean - z75 * sd;
  const q3 = mean + z75 * sd;
  const iqr = q3 - q1;

  return {
    certainty: "assumption-based",
    method: "Normal-distribution approximation: median ≈ mean; Q1/Q3 ≈ mean ∓ z₀.₇₅·SD (z₀.₇₅ = Φ⁻¹(0.75) ≈ 0.6745), so IQR ≈ 1.349 × SD.",
    reference: "Direct property of the normal distribution (not a separate empirical method).",
    assumptions: ["The underlying distribution is assumed to be approximately normal.", "Mean and SD alone do not uniquely determine the median and IQR for a non-normal distribution - this is an approximation, not a derivation."],
    warnings: ["Mean and SD do not uniquely determine median and IQR. This conversion assumes an approximately normal distribution and should not be used for visibly skewed data."],
    values: [
      { label: "Estimated Median", value: mean },
      { label: "Estimated Q1", value: q1 },
      { label: "Estimated Q3", value: q3 },
      { label: "Estimated IQR", value: iqr },
    ],
  };
}

// --- E. OR/RR/HR + 95% CI -> log effect + SE ------------------------------
export type RatioMeasure = "OR" | "RR" | "HR";
export function ratioCIToLogSE(measure: RatioMeasure, effect: number, lowerCI: number, upperCI: number): ConversionResult {
  for (const [name, v] of [["Effect estimate", effect], ["Lower 95% CI", lowerCI], ["Upper 95% CI", upperCI]] as [string, number][]) {
    requirePositive(name, v);
  }
  if (lowerCI >= upperCI) throw new ConversionInputError("The lower confidence limit must be less than the upper confidence limit.");
  if (effect < lowerCI || effect > upperCI) throw new ConversionInputError("The effect estimate should normally fall between the lower and upper confidence limits - please check the values entered.");

  const logEffect = Math.log(effect);
  const logLower = Math.log(lowerCI);
  const logUpper = Math.log(upperCI);
  const se = (logUpper - logLower) / (2 * 1.96);

  return {
    certainty: "exact",
    method: `log(${measure}) and its SE derived directly from the 95% CI on the log scale: SE = [ln(upper) − ln(lower)] / (2 × 1.96).`,
    reference: "Cochrane Handbook for Systematic Reviews of Interventions, section 6.3 (converting between statistics for meta-analysis).",
    assumptions: ["The reported 95% CI was itself calculated on the log scale and is symmetric on that scale (standard for OR/RR/HR)."],
    warnings: [],
    values: [
      { label: `log(${measure})`, value: logEffect },
      { label: "SE of log effect", value: se },
      { label: "Lower log CI", value: logLower },
      { label: "Upper log CI", value: logUpper },
    ],
  };
}

// --- F. 95% CI -> SE -------------------------------------------------------
export function ciToSE(estimate: number, lowerCI: number, upperCI: number, confidenceLevel = 0.95): ConversionResult {
  if (!Number.isFinite(estimate)) throw new ConversionInputError("Estimate is required.");
  if (!Number.isFinite(lowerCI) || !Number.isFinite(upperCI)) throw new ConversionInputError("Both confidence limits are required.");
  if (lowerCI >= upperCI) throw new ConversionInputError("The lower confidence limit must be less than the upper confidence limit.");
  const z = zFor(confidenceLevel);
  const se = (upperCI - lowerCI) / (2 * z);

  return {
    certainty: "exact",
    method: `SE = (upper − lower) / (2 × z), z = ${round(z, 4)} for a ${round(confidenceLevel * 100, 1)}% CI.`,
    reference: "Cochrane Handbook for Systematic Reviews of Interventions, section 6.3.",
    assumptions: ["The interval is a standard symmetric Wald-type CI on the scale entered (e.g., already log-transformed for ratio measures)."],
    warnings: [],
    values: [{ label: "SE", value: se }],
  };
}

// --- G. Estimate + SE -> CI -------------------------------------------------
export function estimateSEToCI(estimate: number, se: number, confidenceLevel = 0.95): ConversionResult {
  if (!Number.isFinite(estimate)) throw new ConversionInputError("Estimate is required.");
  requireNonNegative("SE", se);
  const z = zFor(confidenceLevel);
  const lower = estimate - z * se;
  const upper = estimate + z * se;

  return {
    certainty: "exact",
    method: `CI = estimate ± z × SE, z = ${round(z, 4)} for a ${round(confidenceLevel * 100, 1)}% CI.`,
    reference: "Cochrane Handbook for Systematic Reviews of Interventions, section 6.3.",
    assumptions: ["A normal (Wald-type) sampling distribution for the estimate is assumed."],
    warnings: [],
    values: [
      { label: `Lower ${round(confidenceLevel * 100, 1)}% CI`, value: lower },
      { label: `Upper ${round(confidenceLevel * 100, 1)}% CI`, value: upper },
    ],
  };
}

// --- H. SD + n -> SE --------------------------------------------------------
export function sdToSE(sd: number, n: number): ConversionResult {
  requireNonNegative("SD", sd);
  requireInteger("Sample size (n)", n);
  requirePositive("Sample size (n)", n);
  const se = sd / Math.sqrt(n);
  return {
    certainty: "exact",
    method: "SE = SD / √n.",
    reference: "Standard statistical definition of the standard error of the mean.",
    assumptions: [],
    warnings: [],
    values: [{ label: "SE", value: se }],
  };
}

// --- I. SE + n -> SD --------------------------------------------------------
export function seToSD(se: number, n: number): ConversionResult {
  requireNonNegative("SE", se);
  requireInteger("Sample size (n)", n);
  requirePositive("Sample size (n)", n);
  const sd = se * Math.sqrt(n);
  return {
    certainty: "exact",
    method: "SD = SE × √n.",
    reference: "Standard statistical definition of the standard error of the mean, rearranged.",
    assumptions: [],
    warnings: [],
    values: [{ label: "SD", value: sd }],
  };
}
