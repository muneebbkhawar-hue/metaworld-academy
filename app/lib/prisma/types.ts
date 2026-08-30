// PRISMA 2020 Flow Diagram Generator — shared data model.
//
// This tool is entirely client-side: no R backend, no AI/Gemini call, no
// server route. Every value here lives in React state (mirrored to
// localStorage for autosave) and is fed through calculations.ts (pure,
// unit-tested) to produce the numbers shown in the diagram.

export interface CountEntry {
  id: string;
  /** Display name — either a preset ("PubMed") or a user-typed custom name. */
  name: string;
  /** null = not yet entered (treated as 0 for math, but tracked separately so
   *  the UI can distinguish "blank" from "explicitly zero"). */
  count: number | null;
  /** True for a user-added custom row (a selected "Other"). */
  isCustom?: boolean;
}

export interface ExclusionReasonEntry {
  id: string;
  label: string;
  count: number | null;
  isCustom?: boolean;
}

export const PRESET_DATABASES = [
  "PubMed",
  "Embase",
  "Scopus",
  "Web of Science",
  "ScienceDirect",
  "Cochrane CENTRAL",
  "Google Scholar",
] as const;

export const PRESET_REGISTERS = ["ClinicalTrials.gov", "WHO ICTRP"] as const;

export const PRESET_EXCLUSION_REASONS = [
  "Wrong population",
  "Wrong intervention",
  "Wrong comparator",
  "Wrong outcome",
  "Wrong study design",
  "Wrong setting",
  "Wrong publication type",
  "Duplicate/overlapping publication",
  "Full text unavailable",
  "Ineligible study",
  "Protocol only",
  "Conference abstract only",
  "Insufficient data",
] as const;

export interface PrismaFormState {
  databases: CountEntry[];
  registers: CountEntry[];
  duplicatesRemoved: number | null;
  recordsExcluded: number | null; // manual, at the screening stage
  reportsNotRetrieved: number | null;
  exclusionReasons: ExclusionReasonEntry[];
  studiesIncluded: number | null;
  reportsOfIncludedStudies: number | null;
  /** PRISMA 2020 optionally distinguishes "reports" from "studies" (one study
   *  can have multiple linked reports) - many reviews don't need that split
   *  (one report per study). Off by default: the diagram then uses "Studies"
   *  wording throughout (Studies sought/not retrieved/assessed/excluded) and
   *  the diagram's final box shows only "Studies included in review", with
   *  no separate "Reports of included studies" line. On restores full
   *  PRISMA reports/studies terminology and the extra included-studies field. */
  distinguishReportsFromStudies: boolean;
}

export function emptyFormState(): PrismaFormState {
  return {
    databases: [],
    registers: [],
    duplicatesRemoved: null,
    recordsExcluded: null,
    reportsNotRetrieved: null,
    exclusionReasons: [],
    studiesIncluded: null,
    reportsOfIncludedStudies: null,
    distinguishReportsFromStudies: false,
  };
}

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationMessage {
  id: string;
  severity: ValidationSeverity;
  message: string;
}

export interface PrismaCalculations {
  databaseTotal: number;
  registerTotal: number;
  totalIdentified: number;
  recordsScreened: number;
  reportsSought: number;
  reportsAssessed: number;
  totalReportsExcluded: number;
}

export interface PrismaComputed {
  calc: PrismaCalculations;
  messages: ValidationMessage[];
  hasErrors: boolean;
}
