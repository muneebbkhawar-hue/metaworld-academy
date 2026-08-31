import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveEffect, describeUnresolvedReason, emptyHRRow, type HRStudyRow } from "./conversion.ts";

function row(overrides: Partial<HRStudyRow> = {}): HRStudyRow {
  return { ...emptyHRRow("t"), ...overrides };
}

test("direct ln(HR) + SE(lnHR) is used as-is, not re-derived", () => {
  const r = row({ lnHR: -0.4308, seLnHR: 0.1879, hr: 0.99, ciLower: 0.1, ciUpper: 0.2 }); // HR/CI deliberately inconsistent
  const d = deriveEffect(r);
  assert.ok(d);
  assert.equal(d!.source, "direct");
  assert.equal(d!.te, -0.4308);
  assert.equal(d!.se, 0.1879);
});

test("HR + 95% CI derives ln(HR) and SE via the Cochrane formula", () => {
  // HR = 0.65, 95% CI [0.45, 0.94] - a textbook example.
  const r = row({ hr: 0.65, ciLower: 0.45, ciUpper: 0.94 });
  const d = deriveEffect(r);
  assert.ok(d);
  assert.equal(d!.source, "derived-from-ci");
  assert.ok(Math.abs(d!.te - Math.log(0.65)) < 1e-9);
  const expectedSE = (Math.log(0.94) - Math.log(0.45)) / (2 * 1.959963984540054);
  assert.ok(Math.abs(d!.se - expectedSE) < 1e-9);
  assert.ok(d!.se > 0.15 && d!.se < 0.25); // sanity band
});

test("a row with neither direct values nor a complete CI is unresolved", () => {
  const r = row({ hr: 0.65 }); // no CI, no direct values
  assert.equal(deriveEffect(r), null);
  assert.match(describeUnresolvedReason(r)!, /HR, 95% CI Lower, and 95% CI Upper/);
});

test("HR <= 0 is rejected with a clear reason", () => {
  const r = row({ hr: -1, ciLower: 0.4, ciUpper: 0.9 });
  assert.equal(deriveEffect(r), null);
  assert.match(describeUnresolvedReason(r)!, /HR must be a positive number/);
});

test("CI Upper <= CI Lower is rejected with a clear reason", () => {
  const r = row({ hr: 0.6, ciLower: 0.9, ciUpper: 0.5 });
  assert.equal(deriveEffect(r), null);
  assert.match(describeUnresolvedReason(r)!, /95% CI Upper must be greater/);
});

test("CI Lower <= 0 is rejected (log of non-positive is undefined)", () => {
  const r = row({ hr: 0.6, ciLower: 0, ciUpper: 0.9 });
  assert.equal(deriveEffect(r), null);
});

test("only one of ln(HR)/SE(lnHR) filled in, with no CI fallback, is unresolved with a specific reason", () => {
  const r = row({ lnHR: -0.4 });
  assert.equal(deriveEffect(r), null);
  assert.match(describeUnresolvedReason(r)!, /ln\(HR\) and SE\(ln HR\) must both be filled in/);
});

test("a fully blank row is unresolved with the generic guidance message", () => {
  const r = row();
  assert.equal(deriveEffect(r), null);
  assert.match(describeUnresolvedReason(r)!, /Enter either ln\(HR\)/);
});

test("SE(lnHR) of zero or negative (direct path) is rejected, not silently accepted", () => {
  const r = row({ lnHR: -0.2, seLnHR: 0 });
  assert.equal(deriveEffect(r), null);
});

test("a fully resolved row returns null for describeUnresolvedReason", () => {
  const r = row({ hr: 1.2, ciLower: 0.9, ciUpper: 1.6 });
  assert.equal(describeUnresolvedReason(r), null);
});
