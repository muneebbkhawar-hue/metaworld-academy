import { test } from "node:test";
import assert from "node:assert/strict";
import { computePrisma, sumEntries, sumExclusionReasons } from "./calculations.ts";
import { emptyFormState, type PrismaFormState } from "./types.ts";

function baseState(overrides: Partial<PrismaFormState> = {}): PrismaFormState {
  return { ...emptyFormState(), ...overrides };
}

test("sumEntries totals database counts, treating null as 0", () => {
  const total = sumEntries([
    { id: "a", name: "PubMed", count: 1245 },
    { id: "b", name: "Embase", count: 983 },
    { id: "c", name: "Scopus", count: null },
  ]);
  assert.equal(total, 2228);
});

test("sumExclusionReasons totals across reasons", () => {
  const total = sumExclusionReasons([
    { id: "a", label: "Wrong population", count: 75 },
    { id: "b", label: "Wrong comparator", count: 34 },
  ]);
  assert.equal(total, 109);
});

test("full happy-path calculation matches expected PRISMA arithmetic", () => {
  const state = baseState({
    databases: [
      { id: "a", name: "PubMed", count: 281 },
      { id: "b", name: "Embase", count: 387 },
      { id: "c", name: "ScienceDirect", count: 587 },
    ],
    registers: [{ id: "d", name: "ClinicalTrials.gov", count: 128 }],
    duplicatesRemoved: 144,
    recordsExcluded: 995,
    reportsNotRetrieved: 0,
    exclusionReasons: [
      { id: "e1", label: "Wrong study design", count: 75 },
      { id: "e2", label: "Wrong comparator", count: 34 },
      { id: "e3", label: "Wrong outcome", count: 35 },
      { id: "e4", label: "Ineligible study", count: 18 },
      { id: "e5", label: "Conference abstract only", count: 44 },
      { id: "e6", label: "Insufficient data", count: 19 },
    ],
    studiesIncluded: 19,
    reportsOfIncludedStudies: 19,
  });
  const { calc, messages, hasErrors } = computePrisma(state);
  assert.equal(calc.databaseTotal, 1255);
  assert.equal(calc.registerTotal, 128);
  assert.equal(calc.totalIdentified, 1383);
  assert.equal(calc.recordsScreened, 1239);
  assert.equal(calc.reportsSought, 244);
  assert.equal(calc.reportsAssessed, 244);
  assert.equal(calc.totalReportsExcluded, 225);
  assert.equal(hasErrors, false);
  assert.equal(messages.some((m) => m.severity === "error"), false);
});

test("duplicates removed exceeding total identified is flagged as an error", () => {
  const state = baseState({
    databases: [{ id: "a", name: "PubMed", count: 1000 }],
    duplicatesRemoved: 1100,
  });
  const { messages, hasErrors } = computePrisma(state);
  assert.equal(hasErrors, true);
  const msg = messages.find((m) => m.id === "dup-exceeds-total");
  assert.ok(msg);
  assert.match(msg!.message, /1,000/);
});

test("records excluded exceeding records screened is flagged as an error", () => {
  const state = baseState({
    databases: [{ id: "a", name: "PubMed", count: 1000 }],
    duplicatesRemoved: 150, // screened = 850
    recordsExcluded: 900,
  });
  const { messages, hasErrors } = computePrisma(state);
  assert.equal(hasErrors, true);
  assert.ok(messages.find((m) => m.id === "recexcl-exceeds-screened"));
});

test("reports not retrieved exceeding reports sought is flagged as an error", () => {
  const state = baseState({
    databases: [{ id: "a", name: "PubMed", count: 500 }],
    recordsExcluded: 400, // sought = 100
    reportsNotRetrieved: 150,
  });
  const { messages, hasErrors } = computePrisma(state);
  assert.equal(hasErrors, true);
  assert.ok(messages.find((m) => m.id === "notretr-exceeds-sought"));
});

test("summed exclusion reasons exceeding reports assessed is flagged as an error", () => {
  const state = baseState({
    databases: [{ id: "a", name: "PubMed", count: 100 }],
    exclusionReasons: [
      { id: "e1", label: "Wrong outcome", count: 60 },
      { id: "e2", label: "Wrong comparator", count: 60 },
    ],
  });
  const { calc, messages, hasErrors } = computePrisma(state);
  assert.equal(calc.reportsAssessed, 100);
  assert.equal(hasErrors, true);
  assert.ok(messages.find((m) => m.id === "exclreasons-exceed-assessed"));
});

test("negative values are rejected", () => {
  const state = baseState({ duplicatesRemoved: -5 });
  const { messages, hasErrors } = computePrisma(state);
  assert.equal(hasErrors, true);
  assert.ok(messages.find((m) => m.id === "dup-negative"));
});

test("decimal values are rejected", () => {
  const state = baseState({ duplicatesRemoved: 4.5 });
  const { messages, hasErrors } = computePrisma(state);
  assert.equal(hasErrors, true);
  assert.ok(messages.find((m) => m.id === "dup-decimal"));
});

test("blank numeric fields do not error and are treated as 0 for math", () => {
  const state = baseState({
    databases: [{ id: "a", name: "PubMed", count: null }],
  });
  const { calc, hasErrors } = computePrisma(state);
  assert.equal(calc.totalIdentified, 0);
  assert.equal(hasErrors, false);
});

test("zero values are valid and produce zero totals without error", () => {
  const state = baseState({
    databases: [{ id: "a", name: "PubMed", count: 0 }],
    duplicatesRemoved: 0,
    recordsExcluded: 0,
    reportsNotRetrieved: 0,
    studiesIncluded: 0,
    reportsOfIncludedStudies: 0,
  });
  const { calc, hasErrors } = computePrisma(state);
  assert.equal(calc.totalIdentified, 0);
  assert.equal(calc.recordsScreened, 0);
  assert.equal(hasErrors, false);
});

test("large values compute without overflow or error", () => {
  const state = baseState({
    databases: [{ id: "a", name: "PubMed", count: 999999 }],
    duplicatesRemoved: 100000,
  });
  const { calc, hasErrors } = computePrisma(state);
  assert.equal(calc.totalIdentified, 999999);
  assert.equal(calc.recordsScreened, 899999);
  assert.equal(hasErrors, false);
});

test("reports of included studies below studies included produces a warning, not an error (when the reports/studies duality is on)", () => {
  const state = baseState({ distinguishReportsFromStudies: true, studiesIncluded: 10, reportsOfIncludedStudies: 5 });
  const { messages, hasErrors } = computePrisma(state);
  assert.equal(hasErrors, false);
  const msg = messages.find((m) => m.id === "reports-below-studies");
  assert.ok(msg);
  assert.equal(msg!.severity, "warning");
});

test("reports of included studies above studies included produces an info message, not an error or warning (when the reports/studies duality is on)", () => {
  const state = baseState({ distinguishReportsFromStudies: true, studiesIncluded: 10, reportsOfIncludedStudies: 15 });
  const { messages, hasErrors } = computePrisma(state);
  assert.equal(hasErrors, false);
  const msg = messages.find((m) => m.id === "reports-above-studies-info");
  assert.ok(msg);
  assert.equal(msg!.severity, "info");
});

test("reports/studies cross-check messages are suppressed when the duality is off (the new default)", () => {
  const state = baseState({ distinguishReportsFromStudies: false, studiesIncluded: 10, reportsOfIncludedStudies: 5 });
  const { messages } = computePrisma(state);
  assert.equal(messages.find((m) => m.id === "reports-below-studies"), undefined);
  assert.equal(messages.find((m) => m.id === "reports-above-studies-info"), undefined);
  assert.equal(messages.find((m) => m.id === "reports-included-mismatch"), undefined);
});

test("no exclusion reasons selected while reports were assessed produces an info nudge", () => {
  const state = baseState({ databases: [{ id: "a", name: "PubMed", count: 50 }] });
  const { messages } = computePrisma(state);
  assert.ok(messages.find((m) => m.id === "no-exclusion-reasons"));
});
