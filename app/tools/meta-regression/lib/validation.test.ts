import { test } from "node:test";
import assert from "node:assert/strict";
import { groupByOutcome, findDuplicateStudyOutcomePairs, computeEligibilityPreview, validateModerators } from "./validation.ts";
import { SINGLE_OUTCOME_KEY } from "./types.ts";
import type { MetaRegDataRow, SelectedModerator } from "./types.ts";

function row(partial: Partial<MetaRegDataRow>): MetaRegDataRow {
  return { _rowIndex: 0, study: "Study", outcome: "", ...partial };
}

test("groupByOutcome: no Outcome column -> exactly one group under SINGLE_OUTCOME_KEY", () => {
  const rows = [row({ study: "A" }), row({ study: "B" })];
  const groups = groupByOutcome(rows);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, SINGLE_OUTCOME_KEY);
  assert.equal(groups[0].rows.length, 2);
});

test("groupByOutcome: long-format sheet groups rows by outcome, each study can appear in multiple groups", () => {
  const rows = [
    row({ study: "Smith 2020", outcome: "Mortality" }),
    row({ study: "Smith 2020", outcome: "Reintervention" }),
    row({ study: "Chen 2021", outcome: "Mortality" }),
  ];
  const groups = groupByOutcome(rows);
  assert.equal(groups.length, 2);
  const mortality = groups.find(g => g.key === "Mortality")!;
  const reintervention = groups.find(g => g.key === "Reintervention")!;
  assert.equal(mortality.rows.length, 2);
  assert.equal(reintervention.rows.length, 1);
});

test("groupByOutcome: a study missing from one outcome is not globally removed - it still appears in the outcome it has data for", () => {
  const rows = [
    row({ study: "A", outcome: "Mortality" }),
    row({ study: "A", outcome: "Stroke" }),
    row({ study: "B", outcome: "Mortality" }), // B has no Stroke row at all
  ];
  const groups = groupByOutcome(rows);
  const stroke = groups.find(g => g.key === "Stroke")!;
  const mortality = groups.find(g => g.key === "Mortality")!;
  assert.equal(stroke.rows.length, 1);
  assert.equal(mortality.rows.length, 2);
});

test("findDuplicateStudyOutcomePairs: flags an exact repeated (study, outcome) pair, not the same study under different outcomes", () => {
  const rows = [
    row({ study: "Smith 2020", outcome: "Mortality" }),
    row({ study: "Smith 2020", outcome: "Mortality" }), // true duplicate
    row({ study: "Smith 2020", outcome: "Stroke" }), // NOT a duplicate - different outcome
  ];
  const dups = findDuplicateStudyOutcomePairs(rows);
  assert.equal(dups.length, 1);
  assert.match(dups[0], /Smith 2020 \/ Mortality/);
});

test("findDuplicateStudyOutcomePairs: no duplicates in a clean single-outcome sheet", () => {
  const rows = [row({ study: "A" }), row({ study: "B" }), row({ study: "C" })];
  assert.equal(findDuplicateStudyOutcomePairs(rows).length, 0);
});

test("computeEligibilityPreview: excludes a study missing the selected moderator, keeps the rest", () => {
  const rows: MetaRegDataRow[] = [
    row({ study: "A", event_e: 5, n_e: 100, event_c: 9, n_c: 100, moderators: { Age: "65" } }),
    row({ study: "B", event_e: 3, n_e: 80, event_c: 6, n_c: 80, moderators: { Age: "71" } }),
    row({ study: "C", event_e: 4, n_e: 90, event_c: 7, n_c: 90 }), // no Age at all
  ];
  const mods: SelectedModerator[] = [{ name: "Age", type: "continuous", reference: null }];
  const preview = computeEligibilityPreview(rows, "dichotomous", mods);
  assert.equal(preview.total, 3);
  assert.equal(preview.includedCount, 2);
  assert.equal(preview.excluded.length, 1);
  assert.equal(preview.excluded[0].study, "C");
  assert.match(preview.excluded[0].reason, /Age/);
});

test("computeEligibilityPreview: zero events is never treated as missing/excluded", () => {
  const rows: MetaRegDataRow[] = [
    row({ study: "A", event_e: 0, n_e: 50, event_c: 1, n_c: 50, moderators: { Age: "40" } }),
  ];
  const mods: SelectedModerator[] = [{ name: "Age", type: "continuous", reference: null }];
  const preview = computeEligibilityPreview(rows, "dichotomous", mods);
  assert.equal(preview.includedCount, 1);
  assert.equal(preview.excluded.length, 0);
});

test("computeEligibilityPreview: different moderator selections produce different eligibility sets", () => {
  const rows: MetaRegDataRow[] = [
    row({ study: "A", event_e: 5, n_e: 100, event_c: 9, n_c: 100, moderators: { Age: "65", Followup: "12" } }),
    row({ study: "B", event_e: 3, n_e: 80, event_c: 6, n_c: 80, moderators: { Followup: "24" } }), // missing Age only
  ];
  const byAge = computeEligibilityPreview(rows, "dichotomous", [{ name: "Age", type: "continuous", reference: null }]);
  const byFollowup = computeEligibilityPreview(rows, "dichotomous", [{ name: "Followup", type: "continuous", reference: null }]);
  assert.equal(byAge.includedCount, 1);
  assert.equal(byFollowup.includedCount, 2);
});

test("validateModerators: requires at least one moderator selected", () => {
  const errors = validateModerators([row({ study: "A" })], []);
  assert.ok(errors.some(e => /at least one moderator/.test(e)));
});
