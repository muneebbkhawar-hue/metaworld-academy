// Unit tests for the statistical-conversion calculation layer.
// Run with: node --experimental-strip-types --test app/lib/statConversions/conversions.test.ts
// (Node's native TypeScript support + built-in test runner - no test
// framework dependency needed for a set of pure-function unit tests.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { qnorm, zFor } from "./numeric.ts";
import {
  ConversionInputError,
  medianIQRToMeanSD,
  medianRangeToMeanSD,
  fiveNumberSummaryToMeanSD,
  meanSDToMedianIQR,
  ratioCIToLogSE,
  ciToSE,
  estimateSEToCI,
  sdToSE,
  seToSD,
} from "./conversions.ts";

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

// --- numeric.ts sanity checks ------------------------------------------
test("qnorm(0.5) is 0", () => {
  // Tolerance reflects the erfc() rational approximation used in the
  // Halley refinement step (max error ~1.5e-7), not a precision bug.
  assert.ok(Math.abs(qnorm(0.5)) < 1e-6);
});
test("qnorm(0.975) matches the well-known 1.959964 z-value", () => {
  assert.ok(Math.abs(qnorm(0.975) - 1.959964) < 1e-4);
});
test("qnorm rejects out-of-range probabilities", () => {
  assert.throws(() => qnorm(0));
  assert.throws(() => qnorm(1));
  assert.throws(() => qnorm(-0.1));
  assert.throws(() => qnorm(1.1));
});
test("zFor(0.95) matches 1.96 closely, zFor(0.99) is larger", () => {
  assert.ok(Math.abs(zFor(0.95) - 1.96) < 0.01);
  assert.ok(zFor(0.99) > zFor(0.95));
});

// --- A. Median + IQR -> Mean + SD ---------------------------------------
test("medianIQRToMeanSD: normal case produces sane, positive values", () => {
  const r = medianIQRToMeanSD(50, 40, 60, 100);
  assert.equal(r.certainty, "estimated");
  const mean = r.values.find((v) => v.label === "Estimated Mean")!.value;
  const sd = r.values.find((v) => v.label === "Estimated SD")!.value;
  assert.equal(mean, 50); // (40+50+60)/3
  assert.ok(sd > 0 && isFiniteNumber(sd));
});
test("medianIQRToMeanSD: Q1 > median is rejected", () => {
  assert.throws(() => medianIQRToMeanSD(50, 55, 60, 30), ConversionInputError);
});
test("medianIQRToMeanSD: median > Q3 is rejected", () => {
  assert.throws(() => medianIQRToMeanSD(50, 20, 45, 30), ConversionInputError);
});
test("medianIQRToMeanSD: n < 2 is rejected", () => {
  assert.throws(() => medianIQRToMeanSD(50, 40, 60, 1), ConversionInputError);
  assert.throws(() => medianIQRToMeanSD(50, 40, 60, 0), ConversionInputError);
});
test("medianIQRToMeanSD: non-integer n is rejected", () => {
  assert.throws(() => medianIQRToMeanSD(50, 40, 60, 10.5), ConversionInputError);
});
test("medianIQRToMeanSD: small n produces a warning, not an error", () => {
  const r = medianIQRToMeanSD(50, 40, 60, 10);
  assert.ok(r.warnings.some((w) => w.includes("n ≥ 25")));
});
test("medianIQRToMeanSD: Q1 == median == Q3 (zero-width IQR) does not produce NaN/Infinity", () => {
  const r = medianIQRToMeanSD(50, 50, 50, 30);
  const sd = r.values.find((v) => v.label === "Estimated SD")!.value;
  assert.equal(sd, 0);
});

// --- B. Median + Range -> Mean + SD --------------------------------------
test("medianRangeToMeanSD: normal case", () => {
  const r = medianRangeToMeanSD(50, 20, 80, 50);
  const mean = r.values.find((v) => v.label === "Estimated Mean")!.value;
  const sd = r.values.find((v) => v.label === "Estimated SD")!.value;
  assert.equal(mean, (20 + 2 * 50 + 80) / 4);
  assert.ok(sd > 0 && isFiniteNumber(sd));
});
test("medianRangeToMeanSD: min > median rejected, median > max rejected", () => {
  assert.throws(() => medianRangeToMeanSD(50, 55, 80, 30), ConversionInputError);
  assert.throws(() => medianRangeToMeanSD(50, 20, 45, 30), ConversionInputError);
});
test("medianRangeToMeanSD: min == max == median (no spread) does not produce NaN", () => {
  const r = medianRangeToMeanSD(10, 10, 10, 20);
  const sd = r.values.find((v) => v.label === "Estimated SD")!.value;
  assert.equal(sd, 0);
});

// --- C. Five-number summary -> Mean + SD ---------------------------------
test("fiveNumberSummaryToMeanSD: normal case, correctly ordered", () => {
  const r = fiveNumberSummaryToMeanSD(10, 30, 50, 70, 100, 60);
  for (const v of r.values) assert.ok(isFiniteNumber(v.value));
  const sd = r.values.find((v) => v.label === "Estimated SD")!.value;
  assert.ok(sd > 0);
});
test("fiveNumberSummaryToMeanSD: out-of-order five-number summary rejected", () => {
  assert.throws(() => fiveNumberSummaryToMeanSD(10, 70, 50, 30, 100, 60), ConversionInputError); // Q1 > median
  assert.throws(() => fiveNumberSummaryToMeanSD(50, 30, 20, 70, 100, 60), ConversionInputError); // min > Q1
  assert.throws(() => fiveNumberSummaryToMeanSD(10, 30, 50, 70, 60, 60), ConversionInputError); // Q3 > max
});
test("fiveNumberSummaryToMeanSD: missing value rejected", () => {
  assert.throws(() => fiveNumberSummaryToMeanSD(10, 30, NaN, 70, 100, 60), ConversionInputError);
});

// --- D. Mean + SD -> Median + IQR -----------------------------------------
test("meanSDToMedianIQR: SD=0 gives IQR=0 and median=mean, not NaN", () => {
  const r = meanSDToMedianIQR(100, 0, 20);
  const median = r.values.find((v) => v.label === "Estimated Median")!.value;
  const iqr = r.values.find((v) => v.label === "Estimated IQR")!.value;
  assert.equal(median, 100);
  assert.equal(iqr, 0);
});
test("meanSDToMedianIQR: negative SD rejected", () => {
  assert.throws(() => meanSDToMedianIQR(100, -5, 20), ConversionInputError);
});
test("meanSDToMedianIQR: always labeled assumption-based with the normality warning", () => {
  const r = meanSDToMedianIQR(50, 10, 30);
  assert.equal(r.certainty, "assumption-based");
  assert.ok(r.warnings.some((w) => w.toLowerCase().includes("normal")));
});
test("meanSDToMedianIQR: IQR ≈ 1.349 * SD", () => {
  const r = meanSDToMedianIQR(0, 10, 30);
  const iqr = r.values.find((v) => v.label === "Estimated IQR")!.value;
  assert.ok(Math.abs(iqr - 1.349 * 10) < 0.01);
});

// --- E. OR/RR/HR + CI -> log effect + SE ----------------------------------
test("ratioCIToLogSE: textbook OR example", () => {
  const r = ratioCIToLogSE("OR", 2.5, 1.2, 5.0);
  const logEffect = r.values.find((v) => v.label === "log(OR)")!.value;
  const se = r.values.find((v) => v.label.includes("SE"))!.value;
  assert.ok(Math.abs(logEffect - Math.log(2.5)) < 1e-9);
  assert.ok(Math.abs(se - (Math.log(5.0) - Math.log(1.2)) / (2 * 1.96)) < 1e-9);
});
test("ratioCIToLogSE: non-positive effect/CI values rejected", () => {
  assert.throws(() => ratioCIToLogSE("RR", 0, 1.2, 5.0), ConversionInputError);
  assert.throws(() => ratioCIToLogSE("RR", 1.5, -1, 5.0), ConversionInputError);
  assert.throws(() => ratioCIToLogSE("RR", 1.5, 1.2, 0), ConversionInputError);
});
test("ratioCIToLogSE: lower >= upper rejected", () => {
  assert.throws(() => ratioCIToLogSE("HR", 1.5, 5.0, 1.2), ConversionInputError);
  assert.throws(() => ratioCIToLogSE("HR", 1.5, 2.0, 2.0), ConversionInputError);
});
test("ratioCIToLogSE: effect outside its own CI is rejected", () => {
  assert.throws(() => ratioCIToLogSE("OR", 10, 1.2, 5.0), ConversionInputError);
});

// --- F. CI -> SE ------------------------------------------------------------
test("ciToSE: standard 95% example", () => {
  const r = ciToSE(10, 5, 15);
  const se = r.values[0].value;
  assert.ok(Math.abs(se - 10 / (2 * 1.959964)) < 1e-3);
});
test("ciToSE: lower >= upper rejected", () => {
  assert.throws(() => ciToSE(10, 15, 5), ConversionInputError);
});
test("ciToSE: 90% and 99% produce different SEs for the same interval", () => {
  const se90 = ciToSE(10, 5, 15, 0.9).values[0].value;
  const se99 = ciToSE(10, 5, 15, 0.99).values[0].value;
  assert.notEqual(se90, se99);
  assert.ok(se99 < se90); // wider z for 99% -> smaller implied SE for the same interval width
});

// --- G. Estimate + SE -> CI --------------------------------------------------
test("estimateSEToCI: symmetric around the estimate", () => {
  const r = estimateSEToCI(10, 2);
  const lower = r.values[0].value;
  const upper = r.values[1].value;
  assert.ok(Math.abs((lower + upper) / 2 - 10) < 1e-9);
});
test("estimateSEToCI: SE=0 collapses to a point (no NaN/Infinity)", () => {
  const r = estimateSEToCI(10, 0);
  assert.equal(r.values[0].value, 10);
  assert.equal(r.values[1].value, 10);
});
test("estimateSEToCI: negative SE rejected", () => {
  assert.throws(() => estimateSEToCI(10, -1), ConversionInputError);
});

// --- H. SD + n -> SE ----------------------------------------------------------
test("sdToSE: n=1 gives SE=SD", () => {
  const r = sdToSE(5, 1);
  assert.equal(r.values[0].value, 5);
});
test("sdToSE: n=0 or negative n rejected", () => {
  assert.throws(() => sdToSE(5, 0), ConversionInputError);
  assert.throws(() => sdToSE(5, -3), ConversionInputError);
});
test("sdToSE: negative SD rejected", () => {
  assert.throws(() => sdToSE(-5, 10), ConversionInputError);
});
test("sdToSE: SD=0 gives SE=0", () => {
  const r = sdToSE(0, 10);
  assert.equal(r.values[0].value, 0);
});

// --- I. SE + n -> SD ----------------------------------------------------------
test("seToSD is the exact inverse of sdToSE for a range of n", () => {
  for (const n of [1, 2, 5, 30, 1000]) {
    const sd = 12.34;
    const se = sdToSE(sd, n).values[0].value;
    const sdBack = seToSD(se, n).values[0].value;
    assert.ok(Math.abs(sdBack - sd) < 1e-9, `n=${n}: expected ${sd}, got ${sdBack}`);
  }
});
test("seToSD: negative SE or invalid n rejected", () => {
  assert.throws(() => seToSD(-1, 10), ConversionInputError);
  assert.throws(() => seToSD(1, 0), ConversionInputError);
});
