import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGradeFlatSheet } from "./flatSheetParser.ts";

const HEADER = ["Outcome", "Effect (95% CI)", "Study Design", "k (Studies)", "n (Participants)", "I2 (%)", "Risk of Bias", "Publication Bias", "Indirectness Override"];

test("parses multiple valid outcome rows", () => {
  const result = parseGradeFlatSheet([
    HEADER,
    ["Mortality", "RR 0.8 (0.6-0.9)", "RCT", 10, 2000, 20, "Not serious", "Undetected", ""],
    ["Bleeding", "RR 1.1 (0.9-1.3)", "RCT", 8, 1500, 45, "Serious", "Suspected", ""],
  ]);
  assert.equal(result.fatalErrors.length, 0);
  assert.equal(result.rows.length, 2);
  assert.equal(result.excluded.length, 0);
  assert.equal(result.rows[0].outcome, "Mortality");
  assert.equal(result.rows[1].riskOfBias, "Serious");
});

test("zero k/n/i2 is valid, never treated as missing", () => {
  const result = parseGradeFlatSheet([
    HEADER,
    ["Rare event", "RR 1.0 (0.5-2.0)", "RCT", 3, 0, 0, "Not serious", "Undetected", ""],
  ]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].n, 0);
  assert.equal(result.rows[0].i2, 0);
});

test("recognizes NA/NR/blank tokens and excludes only that outcome with a reason", () => {
  const result = parseGradeFlatSheet([
    HEADER,
    ["Mortality", "RR 0.8 (0.6-0.9)", "RCT", 10, 2000, 20, "Not serious", "Undetected", ""],
    ["Missing effect", "NR", "RCT", 5, 900, 30, "Not serious", "Undetected", ""],
    ["Missing n", "RR 1.2", "RCT", 5, "", 30, "Not serious", "Undetected", ""],
  ]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].outcome, "Mortality");
  assert.equal(result.excluded.length, 2);
  assert.match(result.excluded[0].reason, /effect estimate/);
  assert.match(result.excluded[1].reason, /n \(participants\)/);
});

test("invalid enum values (risk of bias / study design) are excluded with a clear reason", () => {
  const result = parseGradeFlatSheet([
    HEADER,
    ["Bad design", "RR 0.8", "Cohort", 5, 900, 20, "Not serious", "Undetected", ""],
    ["Bad rob", "RR 0.8", "RCT", 5, 900, 20, "Kinda bad", "Undetected", ""],
  ]);
  assert.equal(result.rows.length, 0);
  assert.equal(result.excluded.length, 2);
  assert.match(result.excluded[0].reason, /study design/);
  assert.match(result.excluded[1].reason, /risk of bias/);
});

test("blank trailing rows are skipped silently, not reported as excluded", () => {
  const result = parseGradeFlatSheet([
    HEADER,
    ["Mortality", "RR 0.8 (0.6-0.9)", "RCT", 10, 2000, 20, "Not serious", "Undetected", ""],
    ["", "", "", "", "", "", "", "", ""],
  ]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.excluded.length, 0);
});

test("indirectness override column is optional and parses when present", () => {
  const result = parseGradeFlatSheet([
    HEADER,
    ["Surrogate outcome", "MD 4.2 (1.1-7.3)", "Observational", 5, 890, 33, "Serious", "Undetected", "Serious"],
  ]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].indirectnessOverride, "Serious");
});

test("missing required columns produces a fatal error, not a crash", () => {
  const result = parseGradeFlatSheet([["Outcome", "Effect"], ["Mortality", "RR 0.8"]]);
  assert.equal(result.rows.length, 0);
  assert.ok(result.fatalErrors.length > 0);
});

test("fewer than 2 rows (no data rows) produces a fatal error, not a crash", () => {
  const result = parseGradeFlatSheet([HEADER]);
  assert.equal(result.rows.length, 0);
  assert.ok(result.fatalErrors.length > 0);
});
