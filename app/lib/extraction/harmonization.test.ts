// Run with: node --experimental-strip-types --test app/lib/extraction/harmonization.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVariableDictionary } from "./harmonization.ts";
import type { StudyExtraction, Evidence } from "./types.ts";

const ev = (): Evidence => ({ page: 1, location: null, quote: null, status: "reported", confidence: "High" });

function makeStudy(id: string, opts: Partial<StudyExtraction> = {}): StudyExtraction {
  return {
    study_id: id,
    filename: `${id}.pdf`,
    readable: true,
    readability_note: null,
    study: { suggested_study_id: id, first_author: null, year: null, journal: null, doi: null, title: null, citation: null, country: null, study_design: null },
    study_characteristics: [],
    arms: [{ arm_id: "exp", arm_name: "Drug A", arm_role: "experimental", sample_size: 50, evidence: ev() }, { arm_id: "ctrl", arm_name: "Placebo", arm_role: "control", sample_size: 50, evidence: ev() }],
    baseline_characteristics: [],
    outcomes: { dichotomous: [], continuous: [], generic_iv: [] },
    warnings: [],
    quality_flags: [],
    ...opts,
  };
}

test("frequency/threshold math: variable reported in 3/4 studies is 75%", () => {
  const studies = ["s1", "s2", "s3", "s4"].map((id, i) =>
    makeStudy(id, {
      baseline_characteristics: i < 3 ? [{ arm_id: null, variable_original_label: "Age, years", variable_canonical_name: "Age", value_type: "continuous", reported_value: "56", reported_unit: "years", standardized_value: null, standardized_unit: null, transformation: null, evidence: ev() }] : [],
    })
  );
  const dict = buildVariableDictionary(studies, 50);
  const age = dict.baselineCharacteristics.find((v) => v.canonical_variable === "Age");
  assert.ok(age);
  assert.equal(age!.reporting_count, 3);
  assert.equal(age!.reporting_pct, 75);
  assert.equal(age!.classification, "COMMON VARIABLE");
  assert.equal(age!.recommended, true);
});

test("below-threshold, non-moderator variable is classified RARE and not recommended", () => {
  const studies = ["s1", "s2", "s3", "s4"].map((id, i) =>
    makeStudy(id, {
      baseline_characteristics: i < 1 ? [{ arm_id: null, variable_original_label: "Left-handedness", variable_canonical_name: "Left-handedness", value_type: "categorical", reported_value: "5 (10%)", reported_unit: null, standardized_value: null, standardized_unit: null, transformation: null, evidence: ev() }] : [],
    })
  );
  const dict = buildVariableDictionary(studies, 50);
  const v = dict.baselineCharacteristics.find((e) => e.canonical_variable === "Left-handedness");
  assert.ok(v);
  assert.equal(v!.reporting_pct, 25);
  assert.equal(v!.classification, "RARE VARIABLE");
  assert.equal(v!.recommended, false);
});

test("potential-moderator variables (BMI) are flagged even below the reporting threshold", () => {
  const studies = ["s1", "s2", "s3", "s4"].map((id, i) =>
    makeStudy(id, {
      baseline_characteristics: i < 1 ? [{ arm_id: null, variable_original_label: "BMI", variable_canonical_name: "BMI", value_type: "continuous", reported_value: "27.3", reported_unit: "kg/m2", standardized_value: null, standardized_unit: null, transformation: null, evidence: ev() }] : [],
    })
  );
  const dict = buildVariableDictionary(studies, 50);
  const bmi = dict.baselineCharacteristics.find((e) => e.canonical_variable === "BMI");
  assert.ok(bmi);
  assert.equal(bmi!.reporting_pct, 25); // below the 50% threshold...
  assert.equal(bmi!.potential_moderator, true);
  assert.equal(bmi!.classification, "IMPORTANT POTENTIAL MODERATOR"); // ...but still flagged
  assert.equal(bmi!.recommended, true);
});

test("over-harmonization guard: differently-labeled/defined variables are never merged", () => {
  const studies = [
    makeStudy("s1", { baseline_characteristics: [{ arm_id: null, variable_original_label: "Current smoker", variable_canonical_name: "Current smoker", value_type: "categorical", reported_value: "10 (20%)", reported_unit: null, standardized_value: null, standardized_unit: null, transformation: null, evidence: ev() }] }),
    makeStudy("s2", { baseline_characteristics: [{ arm_id: null, variable_original_label: "Ever smoker", variable_canonical_name: "Ever smoker", value_type: "categorical", reported_value: "18 (36%)", reported_unit: null, standardized_value: null, standardized_unit: null, transformation: null, evidence: ev() }] }),
  ];
  const dict = buildVariableDictionary(studies, 50);
  const names = dict.baselineCharacteristics.map((e) => e.canonical_variable);
  assert.ok(names.includes("Current smoker"));
  assert.ok(names.includes("Ever smoker"));
  assert.equal(dict.baselineCharacteristics.length, 2, "distinct variable definitions must remain distinct entries, never merged");
});

test("include-all threshold (null) recommends every variable regardless of %", () => {
  const studies = ["s1", "s2", "s3", "s4"].map((id, i) =>
    makeStudy(id, {
      baseline_characteristics: i < 1 ? [{ arm_id: null, variable_original_label: "Rare lab value", variable_canonical_name: "Rare lab value", value_type: "continuous", reported_value: "1.2", reported_unit: null, standardized_value: null, standardized_unit: null, transformation: null, evidence: ev() }] : [],
    })
  );
  const dict = buildVariableDictionary(studies, null);
  const v = dict.baselineCharacteristics.find((e) => e.canonical_variable === "Rare lab value");
  assert.ok(v);
  assert.equal(v!.recommended, true);
});

test("conflicting units across studies are flagged, not silently picked", () => {
  const studies = [
    makeStudy("s1", { baseline_characteristics: [{ arm_id: null, variable_original_label: "Weight", variable_canonical_name: "Weight", value_type: "continuous", reported_value: "70", reported_unit: "kg", standardized_value: null, standardized_unit: null, transformation: null, evidence: ev() }] }),
    makeStudy("s2", { baseline_characteristics: [{ arm_id: null, variable_original_label: "Weight", variable_canonical_name: "Weight", value_type: "continuous", reported_value: "154", reported_unit: "lb", standardized_value: null, standardized_unit: null, transformation: null, evidence: ev() }] }),
  ];
  const dict = buildVariableDictionary(studies, 50);
  const w = dict.baselineCharacteristics.find((e) => e.canonical_variable === "Weight");
  assert.ok(w);
  assert.equal(w!.conflicting_units, true);
  assert.equal(w!.typical_unit, null);
});

test("mixed effect measures for the same outcome name produce a cross-study warning", () => {
  const studies = [
    makeStudy("s1", { outcomes: { dichotomous: [], continuous: [], generic_iv: [{ outcome_name: "Mortality", timepoint: "30 days", effect_measure: "OR", effect_measure_other_label: null, estimate: 2, lower_ci: 1.2, upper_ci: 3.3, se_reported: null, derived_log_effect: null, derived_se: null, evidence: ev() }] } }),
    makeStudy("s2", { outcomes: { dichotomous: [], continuous: [], generic_iv: [{ outcome_name: "Mortality", timepoint: "30 days", effect_measure: "RR", effect_measure_other_label: null, estimate: 1.5, lower_ci: 1.1, upper_ci: 2, se_reported: null, derived_log_effect: null, derived_se: null, evidence: ev() }] } }),
  ];
  const dict = buildVariableDictionary(studies, 50);
  assert.ok(dict.warnings.some((w) => /Mortality/.test(w.warning) && /OR/.test(w.warning) && /RR/.test(w.warning)));
});
