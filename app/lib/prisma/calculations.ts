// PRISMA 2020 calculation + validation engine — pure functions, no React,
// no DOM. Every derived number shown in the diagram is computed here, in
// one place, rather than scattered as inline arithmetic across components.
import type {
  CountEntry,
  ExclusionReasonEntry,
  PrismaCalculations,
  PrismaComputed,
  PrismaFormState,
  ValidationMessage,
} from "./types";

// A blank field is treated as 0 for arithmetic (so the diagram never shows
// NaN/undefined while the user is still typing) but is never silently
// "corrected" — validation still runs against whatever was actually typed.
function toNumber(v: number | null): number {
  return v === null || Number.isNaN(v) ? 0 : v;
}

export function sumEntries(entries: CountEntry[]): number {
  return entries.reduce((total, e) => total + toNumber(e.count), 0);
}

export function sumExclusionReasons(entries: ExclusionReasonEntry[]): number {
  return entries.reduce((total, e) => total + toNumber(e.count), 0);
}

function isNonNegativeInteger(v: number): boolean {
  return Number.isInteger(v) && v >= 0;
}

/** Checks a raw entered value (not the 0-substituted version) for basic validity. */
function checkFieldValidity(
  value: number | null,
  label: string,
  messages: ValidationMessage[],
  idPrefix: string
) {
  if (value === null) return; // blank is allowed, not an error
  if (Number.isNaN(value)) {
    messages.push({ id: `${idPrefix}-nan`, severity: "error", message: `${label} must be a number.` });
    return;
  }
  if (!Number.isInteger(value)) {
    messages.push({ id: `${idPrefix}-decimal`, severity: "error", message: `${label} must be a whole number (decimals are not valid record counts).` });
    return;
  }
  if (value < 0) {
    messages.push({ id: `${idPrefix}-negative`, severity: "error", message: `${label} cannot be negative.` });
  }
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function computePrisma(state: PrismaFormState): PrismaComputed {
  const messages: ValidationMessage[] = [];

  // --- Field-level validity (non-negative integers) ------------------------
  state.databases.forEach((d) => checkFieldValidity(d.count, `"${d.name || "Database"}" records identified`, messages, `db-${d.id}`));
  state.registers.forEach((r) => checkFieldValidity(r.count, `"${r.name || "Register"}" records identified`, messages, `reg-${r.id}`));
  checkFieldValidity(state.duplicatesRemoved, "Duplicate records removed", messages, "dup");
  checkFieldValidity(state.recordsExcluded, "Records excluded (screening)", messages, "recexcl");
  checkFieldValidity(state.reportsNotRetrieved, state.distinguishReportsFromStudies ? "Reports not retrieved" : "Studies not retrieved", messages, "notretr");
  state.exclusionReasons.forEach((r) => checkFieldValidity(r.count, `"${r.label || "Exclusion reason"}" count`, messages, `exclreason-${r.id}`));
  checkFieldValidity(state.studiesIncluded, "Studies included in review", messages, "studiesincl");
  if (state.distinguishReportsFromStudies) {
    checkFieldValidity(state.reportsOfIncludedStudies, "Reports of included studies", messages, "reportsincl");
  }

  // --- Core PRISMA arithmetic ------------------------------------------------
  const databaseTotal = sumEntries(state.databases);
  const registerTotal = sumEntries(state.registers);
  const totalIdentified = databaseTotal + registerTotal;

  const duplicatesRemoved = toNumber(state.duplicatesRemoved);
  const recordsScreened = Math.max(0, totalIdentified - duplicatesRemoved);

  const recordsExcluded = toNumber(state.recordsExcluded);
  const reportsSought = Math.max(0, recordsScreened - recordsExcluded);

  const reportsNotRetrieved = toNumber(state.reportsNotRetrieved);
  const reportsAssessed = Math.max(0, reportsSought - reportsNotRetrieved);

  const totalReportsExcluded = sumExclusionReasons(state.exclusionReasons);

  const calc: PrismaCalculations = {
    databaseTotal,
    registerTotal,
    totalIdentified,
    recordsScreened,
    reportsSought,
    reportsAssessed,
    totalReportsExcluded,
  };

  // Wording for messages only - the arithmetic above is identical either
  // way. "Reports" when the optional reports/studies duality is on,
  // "Studies" (the simplified default) when it's off.
  const term = state.distinguishReportsFromStudies ? "Reports" : "Studies";

  // --- Logical relationship validation --------------------------------------
  if (state.duplicatesRemoved !== null && isNonNegativeInteger(state.duplicatesRemoved) && state.duplicatesRemoved > totalIdentified) {
    messages.push({
      id: "dup-exceeds-total",
      severity: "error",
      message: `Duplicate records removed (${fmt(state.duplicatesRemoved)}) cannot exceed total records identified (${fmt(totalIdentified)}).`,
    });
  }

  if (state.recordsExcluded !== null && isNonNegativeInteger(state.recordsExcluded)) {
    const screenedBeforeExclusion = Math.max(0, totalIdentified - duplicatesRemoved);
    if (state.recordsExcluded > screenedBeforeExclusion) {
      messages.push({
        id: "recexcl-exceeds-screened",
        severity: "error",
        message: `Records excluded (${fmt(state.recordsExcluded)}) cannot exceed records screened (${fmt(screenedBeforeExclusion)}).`,
      });
    }
  }

  if (state.reportsNotRetrieved !== null && isNonNegativeInteger(state.reportsNotRetrieved)) {
    const soughtBeforeNotRetrieved = Math.max(0, recordsScreened - recordsExcluded);
    if (state.reportsNotRetrieved > soughtBeforeNotRetrieved) {
      messages.push({
        id: "notretr-exceeds-sought",
        severity: "error",
        message: `${term} not retrieved (${fmt(state.reportsNotRetrieved)}) cannot exceed ${term.toLowerCase()} sought for retrieval (${fmt(soughtBeforeNotRetrieved)}).`,
      });
    }
  }

  if (totalReportsExcluded > reportsAssessed) {
    messages.push({
      id: "exclreasons-exceed-assessed",
      severity: "error",
      message: `Total ${term.toLowerCase()} excluded, summed across reasons (${fmt(totalReportsExcluded)}), cannot exceed ${term.toLowerCase()} assessed for eligibility (${fmt(reportsAssessed)}).`,
    });
  }

  if (state.exclusionReasons.length === 0 && reportsAssessed > 0) {
    messages.push({
      id: "no-exclusion-reasons",
      severity: "info",
      message: `No exclusion reasons selected yet. If any ${term.toLowerCase()} were excluded at eligibility, add a reason so the diagram can show why.`,
    });
  }

  state.exclusionReasons.forEach((r) => {
    if (r.isCustom && r.count !== null && isNonNegativeInteger(r.count) && !r.label.trim()) {
      messages.push({ id: `exclreason-noname-${r.id}`, severity: "warning", message: "A custom exclusion reason has a count but no name — it will show as \"Other\" in the diagram." });
    }
  });

  // Studies vs. reports — PRISMA distinguishes the two; never force equality.
  // Only relevant when the reports/studies duality is actually turned on -
  // when off, "reports of included studies" isn't collected at all.
  if (state.distinguishReportsFromStudies && state.studiesIncluded !== null && state.reportsOfIncludedStudies !== null) {
    if (isNonNegativeInteger(state.studiesIncluded) && isNonNegativeInteger(state.reportsOfIncludedStudies)) {
      if (state.reportsOfIncludedStudies < state.studiesIncluded) {
        messages.push({
          id: "reports-below-studies",
          severity: "warning",
          message: `Reports of included studies (${fmt(state.reportsOfIncludedStudies)}) is lower than studies included (${fmt(state.studiesIncluded)}). Every included study normally has at least one report — double-check this is intentional.`,
        });
      } else if (state.reportsOfIncludedStudies > state.studiesIncluded) {
        messages.push({
          id: "reports-above-studies-info",
          severity: "info",
          message: "Reports of included studies exceeds studies included — this is expected when a study has multiple linked publications (e.g. a trial register entry plus a journal article).",
        });
      }
    }
  }

  // Soft cross-check only — never auto-fills, never overrides the user's entry.
  const expectedReportsIncluded = reportsAssessed - totalReportsExcluded;
  if (
    state.distinguishReportsFromStudies &&
    state.reportsOfIncludedStudies !== null &&
    isNonNegativeInteger(state.reportsOfIncludedStudies) &&
    expectedReportsIncluded >= 0 &&
    state.reportsOfIncludedStudies !== expectedReportsIncluded
  ) {
    messages.push({
      id: "reports-included-mismatch",
      severity: "info",
      message: `Reports assessed minus reports excluded = ${fmt(expectedReportsIncluded)}, but you entered ${fmt(state.reportsOfIncludedStudies)} for reports of included studies. This can be correct (e.g. reports excluded for other reasons later), but is worth double-checking.`,
    });
  }

  if (state.databases.length === 0 && state.registers.length === 0) {
    messages.push({ id: "no-sources", severity: "info", message: "No databases or registers selected yet. Select at least one source to begin." });
  }

  const hasErrors = messages.some((m) => m.severity === "error");
  return { calc, messages, hasErrors };
}
