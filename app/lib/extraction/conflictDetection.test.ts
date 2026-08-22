// Run with: node --experimental-strip-types --test app/lib/extraction/conflictDetection.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectSameStudyConflicts } from "./conflictDetection.ts";
import type { StudyExtraction, Evidence } from "./types.ts";

const ev = (page: number): Evidence => ({ page, location: null, quote: null, status: "reported", confidence: "High" });

function baseStudy(): StudyExtraction {
  return {
    study_id: "Smith_2022",
    filename: "smith.pdf",
    readable: true,
    readability_note: null,
    study: { suggested_study_id: "Smith_2022", first_author: "Smith", year: 2022, journal: null, doi: null, title: null, citation: null, country: null, study_design: null },
    study_characteristics: [],
    arms: [{ arm_id: "exp", arm_name: "Drug A", arm_role: "experimental", sample_size: 60, evidence: ev(1) }, { arm_id: "ctrl", arm_name: "Placebo", arm_role: "control", sample_size: 60, evidence: ev(1) }],
    baseline_characteristics: [],
    outcomes: { dichotomous: [], continuous: [], generic_iv: [] },
    warnings: [],
    quality_flags: [],
  };
}

test("no conflicts for consistent data", () => {
  const study = baseStudy();
  study.study_characteristics = [{ variable: "Sample size", value: "120", unit: null, evidence: ev(1) }];
  assert.deepEqual(detectSameStudyConflicts(study), []);
});

test("detects mismatched sample size vs. sum of arm sizes", () => {
  const study = baseStudy();
  study.study_characteristics = [{ variable: "Number randomized", value: "118", unit: null, evidence: ev(2) }];
  const conflicts = detectSameStudyConflicts(study);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].severity, "high");
  assert.match(conflicts[0].variable, /Number randomized/);
});

test("detects duplicate baseline entries with differing values (e.g. Table 1 vs. text)", () => {
  const study = baseStudy();
  study.baseline_characteristics = [
    { arm_id: "exp", variable_original_label: "Mean age", variable_canonical_name: "Age", value_type: "continuous", reported_value: "56.4", reported_unit: "years", standardized_value: null, standardized_unit: null, transformation: null, evidence: { ...ev(4), location: "Table 1" } },
    { arm_id: "exp", variable_original_label: "Mean age", variable_canonical_name: "Age", value_type: "continuous", reported_value: "58.1", reported_unit: "years", standardized_value: null, standardized_unit: null, transformation: null, evidence: { ...ev(5), location: "Results text" } },
  ];
  const conflicts = detectSameStudyConflicts(study);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].values.length, 2);
  assert.equal(conflicts[0].severity, "medium");
});

test("does not flag arm size mismatch when an arm's sample size is unknown (never guesses)", () => {
  const study = baseStudy();
  study.arms[1].sample_size = null;
  study.study_characteristics = [{ variable: "Sample size", value: "999", unit: null, evidence: ev(1) }];
  assert.deepEqual(detectSameStudyConflicts(study), []);
});
