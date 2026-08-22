// Run with: node --experimental-strip-types --test app/lib/extraction/deriveGenericIV.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveLogEffectAndSE } from "./deriveGenericIV.ts";

test("derives log(OR) and SE from a valid OR + 95% CI", () => {
  const result = deriveLogEffectAndSE({ effect_measure: "OR", estimate: 2.1, lower_ci: 1.4, upper_ci: 3.15 });
  assert.ok(result);
  assert.ok(Math.abs(result!.log_effect - Math.log(2.1)) < 1e-9);
  assert.ok(result!.se > 0);
});

test("derives for RR and HR too", () => {
  assert.ok(deriveLogEffectAndSE({ effect_measure: "RR", estimate: 1.5, lower_ci: 1.1, upper_ci: 2.0 }));
  assert.ok(deriveLogEffectAndSE({ effect_measure: "HR", estimate: 0.7, lower_ci: 0.5, upper_ci: 0.95 }));
});

test("never derives for MD/SMD (already a linear-scale measure, not ratio)", () => {
  assert.equal(deriveLogEffectAndSE({ effect_measure: "MD", estimate: 2, lower_ci: 1, upper_ci: 3 }), null);
  assert.equal(deriveLogEffectAndSE({ effect_measure: "SMD", estimate: 0.5, lower_ci: 0.1, upper_ci: 0.9 }), null);
});

test("never derives when estimate or CI is missing", () => {
  assert.equal(deriveLogEffectAndSE({ effect_measure: "OR", estimate: null, lower_ci: 1.4, upper_ci: 3.15 }), null);
  assert.equal(deriveLogEffectAndSE({ effect_measure: "OR", estimate: 2.1, lower_ci: null, upper_ci: 3.15 }), null);
});

test("never derives (never throws) for an invalid/inconsistent CI", () => {
  // lower >= upper
  assert.equal(deriveLogEffectAndSE({ effect_measure: "OR", estimate: 2.1, lower_ci: 3.15, upper_ci: 1.4 }), null);
  // estimate outside the CI
  assert.equal(deriveLogEffectAndSE({ effect_measure: "OR", estimate: 5, lower_ci: 1.4, upper_ci: 3.15 }), null);
});
