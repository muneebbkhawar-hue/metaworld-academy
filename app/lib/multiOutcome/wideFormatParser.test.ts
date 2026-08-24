import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWideFormatWorkbook } from "./wideFormatParser.ts";
import type { DichStudyRow, ContStudyRow } from "./types.ts";

// ---- Dichotomous ----------------------------------------------------------

function dichRows(): unknown[][] {
  return [
    ["Study ID", "Mortality", "", "", "", "Stroke", "", "", ""],
    ["", "DRA", "", "TRA", "", "DRA", "", "TRA", ""],
    ["", "Events", "Total", "Events", "Total", "Events", "Total", "Events", "Total"],
    ["Study A", 5, 100, 8, 100, 2, 100, 3, 100],
    ["Study B", 3, 80, 6, 80, "NA", 80, 4, 80],
    ["Study C", 0, 50, 1, 50, 1, 50, "NR", 50],
  ];
}

test("detects 2 dichotomous outcomes with correct block boundaries", () => {
  const result = parseWideFormatWorkbook(dichRows(), "dichotomous", "DRA", "TRA");
  assert.equal(result.fatalErrors.length, 0);
  assert.equal(result.outcomes.length, 2);
  assert.equal(result.outcomes[0].name, "Mortality");
  assert.equal(result.outcomes[1].name, "Stroke");
});

test("all 3 studies eligible for Mortality (complete data)", () => {
  const result = parseWideFormatWorkbook(dichRows(), "dichotomous", "DRA", "TRA");
  const mortality = result.outcomes[0];
  assert.equal(mortality.eligibleStudies.length, 3);
  assert.equal(mortality.excludedStudies.length, 0);
});

test("Study B excluded from Stroke only (NA), Study C excluded from Stroke only (NR) - Mortality unaffected", () => {
  const result = parseWideFormatWorkbook(dichRows(), "dichotomous", "DRA", "TRA");
  const stroke = result.outcomes[1];
  assert.equal(stroke.eligibleStudies.length, 1);
  assert.equal(stroke.excludedStudies.length, 2);
  assert.deepEqual(
    stroke.excludedStudies.map((e) => e.study).sort(),
    ["Study B", "Study C"]
  );
  // Mortality (outcome 0) must still have all 3 - missing data in Stroke must not remove a study from Mortality.
  const mortality = result.outcomes[0];
  assert.ok(mortality.eligibleStudies.some((s) => (s as DichStudyRow).study === "Study B"));
  assert.ok(mortality.eligibleStudies.some((s) => (s as DichStudyRow).study === "Study C"));
});

test("zero events is retained as valid, not treated as missing", () => {
  const result = parseWideFormatWorkbook(dichRows(), "dichotomous", "DRA", "TRA");
  const mortality = result.outcomes[0];
  const studyC = mortality.eligibleStudies.find((s) => (s as DichStudyRow).study === "Study C") as DichStudyRow;
  assert.ok(studyC, "Study C should be eligible for Mortality");
  assert.equal(studyC.event_e, 0);
});

test("recognizes common missing tokens: NA, NR, blank, dash", () => {
  const rows: unknown[][] = [
    ["Study ID", "Outcome1", "", "", ""],
    ["", "Exp", "", "Ctrl", ""],
    ["", "Events", "Total", "Events", "Total"],
    ["S1", "NA", 100, 5, 100],
    ["S2", 5, "N/A", 5, 100],
    ["S3", 5, 100, "", 100],
    ["S4", 5, 100, 5, "-"],
    ["S5", 5, 100, 5, 100],
  ];
  const result = parseWideFormatWorkbook(rows, "dichotomous", "Exp", "Ctrl");
  const outcome = result.outcomes[0];
  assert.equal(outcome.eligibleStudies.length, 1);
  assert.equal(outcome.excludedStudies.length, 4);
});

test("duplicate Study ID within an outcome is excluded with a clear reason, first occurrence kept", () => {
  const rows: unknown[][] = [
    ["Study ID", "Outcome1", "", "", ""],
    ["", "Exp", "", "Ctrl", ""],
    ["", "Events", "Total", "Events", "Total"],
    ["Study A", 5, 100, 8, 100],
    ["Study A", 6, 100, 9, 100],
  ];
  const result = parseWideFormatWorkbook(rows, "dichotomous", "Exp", "Ctrl");
  const outcome = result.outcomes[0];
  assert.equal(outcome.eligibleStudies.length, 1);
  assert.equal(outcome.excludedStudies.length, 1);
  assert.match(outcome.excludedStudies[0].reason, /Duplicate/);
});

// ---- Continuous -------------------------------------------------------------

function contRows(): unknown[][] {
  return [
    ["Study ID", "Hospital Stay", "", "", "", "", "", "Procedure Time", "", "", "", "", ""],
    ["", "DCB", "", "", "Balloon", "", "", "DCB", "", "", "Balloon", "", ""],
    ["", "Mean", "SD", "Total", "Mean", "SD", "Total", "Mean", "SD", "Total", "Mean", "SD", "Total"],
    ["Trial 1", 5.2, 1.1, 40, 6.8, 1.4, 40, 45, 5, 40, 52, 6, 40],
    ["Trial 2", 4.8, 0.9, 35, "NR", 1.2, 35, 40, 4, 35, 48, 5, 35],
  ];
}

test("detects 2 continuous outcomes and parses Mean/SD/Total correctly", () => {
  const result = parseWideFormatWorkbook(contRows(), "continuous", "DCB", "Balloon");
  assert.equal(result.outcomes.length, 2);
  const hospitalStay = result.outcomes[0];
  assert.equal(hospitalStay.eligibleStudies.length, 1); // Trial 2 missing control mean for Hospital Stay
  assert.equal(hospitalStay.excludedStudies.length, 1);
  const procTime = result.outcomes[1];
  assert.equal(procTime.eligibleStudies.length, 2); // both complete for Procedure Time
});

test("continuous eligible study has correctly mapped fields", () => {
  const result = parseWideFormatWorkbook(contRows(), "continuous", "DCB", "Balloon");
  const trial1 = result.outcomes[0].eligibleStudies[0] as ContStudyRow;
  assert.equal(trial1.study, "Trial 1");
  assert.equal(trial1.mean_e, 5.2);
  assert.equal(trial1.sd_e, 1.1);
  assert.equal(trial1.n_e, 40);
  assert.equal(trial1.mean_c, 6.8);
  assert.equal(trial1.sd_c, 1.4);
  assert.equal(trial1.n_c, 40);
});

// ---- Edge cases -------------------------------------------------------------

test("no outcome blocks detected produces a fatal error, not a crash", () => {
  const rows: unknown[][] = [
    ["Study ID"],
    [""],
    [""],
    ["Study A"],
  ];
  const result = parseWideFormatWorkbook(rows, "dichotomous", "Exp", "Ctrl");
  assert.equal(result.outcomes.length, 0);
  assert.ok(result.fatalErrors.length > 0);
});

test("too few rows produces a fatal error, not a crash", () => {
  const result = parseWideFormatWorkbook([["Study ID"]], "dichotomous", "Exp", "Ctrl");
  assert.ok(result.fatalErrors.length > 0);
});

test("blank trailing rows are skipped, not treated as an excluded study", () => {
  const rows: unknown[][] = [
    ["Study ID", "Outcome1", "", "", ""],
    ["", "Exp", "", "Ctrl", ""],
    ["", "Events", "Total", "Events", "Total"],
    ["Study A", 5, 100, 8, 100],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
  ];
  const result = parseWideFormatWorkbook(rows, "dichotomous", "Exp", "Ctrl");
  const outcome = result.outcomes[0];
  assert.equal(outcome.totalStudies, 1);
});

test("group-label mismatch between sheet and user input produces a warning, not a fatal error", () => {
  const rows: unknown[][] = [
    ["Study ID", "Outcome1", "", "", ""],
    ["", "GroupX", "", "GroupY", ""],
    ["", "Events", "Total", "Events", "Total"],
    ["Study A", 5, 100, 8, 100],
    ["Study B", 3, 90, 6, 90],
  ];
  const result = parseWideFormatWorkbook(rows, "dichotomous", "DRA", "TRA");
  assert.equal(result.fatalErrors.length, 0);
  assert.ok(result.warnings.some((w) => w.includes("GroupX")));
});
