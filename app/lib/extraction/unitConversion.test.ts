// Run with: node --experimental-strip-types --test app/lib/extraction/unitConversion.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { convertUnit, firstNumber } from "./unitConversion.ts";

test("firstNumber extracts the first numeric token from free text", () => {
  assert.equal(firstNumber("56.4 ± 8.2"), 56.4);
  assert.equal(firstNumber("70 kg"), 70);
  assert.equal(firstNumber("-4.5"), -4.5);
  assert.equal(firstNumber("no numbers here"), null);
});

test("convertUnit: valid whitelisted conversion (lb -> kg)", () => {
  const result = convertUnit("154", "lb");
  assert.ok(result);
  assert.equal(result!.standardizedUnit, "kg");
  assert.ok(Math.abs(parseFloat(result!.standardizedValue) - 69.853) < 0.01);
  assert.match(result!.rule, /lb -> kg/);
});

test("convertUnit: valid whitelisted conversion (in -> cm)", () => {
  const result = convertUnit("70", "in");
  assert.ok(result);
  assert.equal(result!.standardizedUnit, "cm");
  assert.ok(Math.abs(parseFloat(result!.standardizedValue) - 177.8) < 0.01);
});

test("convertUnit: unrecognized unit returns null (never guesses)", () => {
  assert.equal(convertUnit("56.4", "years"), null);
  assert.equal(convertUnit("56.4", "some made up unit"), null);
});

test("convertUnit: null unit returns null", () => {
  assert.equal(convertUnit("56.4", null), null);
});

test("convertUnit: unit recognized but no parseable number returns null (never silently drops data)", () => {
  assert.equal(convertUnit("not a number", "lb"), null);
});

test("convertUnit: original value is never mutated by the caller's inspection of the result", () => {
  const original = "154";
  convertUnit(original, "lb");
  assert.equal(original, "154");
});
