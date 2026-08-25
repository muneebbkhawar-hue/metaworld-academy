import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDTARows, validateDTARows } from "./validation.ts";

function parse(rows: (string | number)[][]) {
  return parseDTARows(["Study_ID", "TP", "FP", "FN", "TN"], rows);
}

test("valid multi-study dataset: all studies eligible, none excluded", () => {
  const rows = parse([
    ["Study 1", 85, 10, 15, 90],
    ["Study 2", 70, 20, 30, 80],
    ["Study 3", 92, 8, 8, 92],
  ]);
  const { eligible, excluded } = validateDTARows(rows);
  assert.equal(eligible.length, 3);
  assert.equal(excluded.length, 0);
});

test("missing TP is excluded with a clear reason, other studies unaffected", () => {
  const rows = parse([
    ["Study 1", "", 10, 15, 90],
    ["Study 2", 70, 20, 30, 80],
  ]);
  const { eligible, excluded } = validateDTARows(rows);
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].study, "Study 2");
  assert.equal(excluded.length, 1);
  assert.match(excluded[0].reason, /TP was not reported/);
});

test("missing FP / FN / TN individually are each excluded with the specific reason", () => {
  const rows = parse([
    ["Study A", 10, "NA", 5, 20],
    ["Study B", 10, 5, "NR", 20],
    ["Study C", 10, 5, 5, "not reported"],
  ]);
  const { eligible, excluded } = validateDTARows(rows);
  assert.equal(eligible.length, 0);
  assert.equal(excluded.length, 3);
  assert.match(excluded[0].reason, /FP was not reported/);
  assert.match(excluded[1].reason, /FN was not reported/);
  assert.match(excluded[2].reason, /TN was not reported/);
});

test("blank cells are recognized as missing, not silently coerced to zero", () => {
  const rows = parse([["Study 1", 10, 5, "", 20]]);
  const { eligible, excluded } = validateDTARows(rows);
  assert.equal(eligible.length, 0);
  assert.equal(excluded.length, 1);
  assert.match(excluded[0].reason, /FN was not reported/);
});

test("negative values are rejected, not silently made positive", () => {
  const rows = parse([["Study 1", -5, 10, 15, 90]]);
  const { eligible, excluded } = validateDTARows(rows);
  assert.equal(eligible.length, 0);
  assert.match(excluded[0].reason, /cannot be negative/);
});

test("decimal (non-integer) values are rejected - diagnostic counts must be whole numbers", () => {
  const rows = parse([["Study 1", 10.5, 10, 15, 90]]);
  const { eligible, excluded } = validateDTARows(rows);
  assert.equal(eligible.length, 0);
  assert.match(excluded[0].reason, /whole number/);
});

test("zero cells are VALID data and are NOT excluded - only missing/negative/non-integer values are", () => {
  const rows = parse([["Study 1", 0, 3, 40, 97]]);
  const { eligible, excluded } = validateDTARows(rows);
  assert.equal(eligible.length, 1);
  assert.equal(excluded.length, 0);
  assert.equal(eligible[0].tp, 0);
});

test("duplicate Study_ID: only the first occurrence is eligible, the rest are excluded with a clear reason", () => {
  const rows = parse([
    ["Study 1", 85, 10, 15, 90],
    ["Study 1", 70, 20, 30, 80],
  ]);
  const { eligible, excluded } = validateDTARows(rows);
  assert.equal(eligible.length, 1);
  assert.equal(excluded.length, 1);
  assert.match(excluded[0].reason, /Duplicate Study_ID/);
});

test("total sample size of 0 (all four cells zero) is excluded", () => {
  const rows = parse([["Study 1", 0, 0, 0, 0]]);
  const { eligible, excluded } = validateDTARows(rows);
  assert.equal(eligible.length, 0);
  assert.match(excluded[0].reason, /total sample size is 0/);
});

test("NA/N/A/NR/blank/dash tokens are all recognized as missing", () => {
  const tokens = ["NA", "N/A", "NR", "Not reported", "not available", ""];
  for (const token of tokens) {
    const rows = parse([["Study X", token, 10, 15, 90]]);
    const { eligible, excluded } = validateDTARows(rows);
    assert.equal(eligible.length, 0, `expected "${token}" to be recognized as missing`);
    assert.match(excluded[0].reason, /TP was not reported/);
  }
});
