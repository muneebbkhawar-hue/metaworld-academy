// Cross-study variable-frequency analysis and harmonization - deterministic
// TypeScript, not AI (see the architecture note in
// app/tools/data-extraction/DOCS.md for why: grouping is more reliable and
// reviewable as pure code operating on the AI's own consistent
// variable_canonical_name output than as a second freeform "harmonize
// these N studies" AI call, and it avoids over-harmonization - only
// EXACT/near-exact canonical-name matches are grouped, never fuzzy NLP
// merging, per the brief's explicit "current smoker" vs "ever smoker"
// example).
import type { StudyExtraction, VariableDictionaryEntry, VariableCategory, CrossStudyWarning } from "./types";

// Variables commonly valuable as subgroup/meta-regression moderators - these
// get flagged as "IMPORTANT POTENTIAL MODERATOR" even below the reporting
// threshold, per the brief's explicit BMI example (4/10 studies, 40%, still
// flagged). Matched as a case-insensitive substring of the canonical name -
// deliberately a fixed, reviewable whitelist rather than an AI guess.
const MODERATOR_KEYWORDS = [
  "age", "sex", "bmi", "body mass index", "smoking", "smoker", "diabetes", "hypertension",
  "comorbidit", "disease duration", "disease severity", "baseline severity", "prior treatment",
  "previous surgery", "ethnicity", "race", "weight", "height", "renal function", "cardiac",
];

function isModeratorCandidate(canonicalName: string): boolean {
  const lower = canonicalName.toLowerCase();
  return MODERATOR_KEYWORDS.some((k) => lower.includes(k));
}

function normalizeCanonical(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// A variable that already clears the reporting threshold is classified as
// COMMON (its `potential_moderator` flag is still preserved separately so
// the UI can show both facts) - the moderator classification exists
// specifically to RESCUE a variable that would otherwise be dismissed as
// rare, per the brief's explicit BMI example (40%, below a 50% threshold,
// still flagged).
function classify(reportingPct: number, thresholdPct: number, potentialModerator: boolean): VariableCategory {
  if (reportingPct >= thresholdPct) return "COMMON VARIABLE";
  if (potentialModerator) return "IMPORTANT POTENTIAL MODERATOR";
  return "RARE VARIABLE";
}

export interface HarmonizationResult {
  studyCharacteristics: VariableDictionaryEntry[];
  baselineCharacteristics: VariableDictionaryEntry[];
  warnings: CrossStudyWarning[];
}

/** thresholdPct: 0-100, or null for "include all" (still computed/shown,
 * just defaults every variable's `recommended` to true regardless of %). */
export function buildVariableDictionary(studies: StudyExtraction[], thresholdPct: number | null): HarmonizationResult {
  const total = studies.length;
  const effectiveThreshold = thresholdPct ?? 0;

  // --- Study characteristics (grouped by their own "variable" field - the
  // AI doesn't emit a separate canonical name for these since they are
  // already free-text labels the reviewer defines; grouped by exact
  // normalized label, matching the "never over-merge" principle). ---
  const scGroups = new Map<string, { originalLabels: Set<string>; studies: Set<string>; units: Set<string> }>();
  for (const s of studies) {
    for (const c of s.study_characteristics) {
      const key = normalizeCanonical(c.variable);
      if (!scGroups.has(key)) scGroups.set(key, { originalLabels: new Set(), studies: new Set(), units: new Set() });
      const g = scGroups.get(key)!;
      g.originalLabels.add(c.variable);
      g.studies.add(s.study_id);
      if (c.unit) g.units.add(c.unit);
    }
  }
  const studyCharacteristics: VariableDictionaryEntry[] = Array.from(scGroups.entries()).map(([key, g]) => {
    const pct = total > 0 ? (g.studies.size / total) * 100 : 0;
    const moderator = isModeratorCandidate(key);
    return {
      canonical_variable: [...g.originalLabels][0] ?? key,
      category: "study_characteristic",
      original_labels: [...g.originalLabels],
      studies_reporting: [...g.studies],
      studies_total: total,
      reporting_count: g.studies.size,
      reporting_pct: Math.round(pct * 10) / 10,
      typical_unit: g.units.size === 1 ? [...g.units][0] : null,
      recommended: thresholdPct === null || pct >= effectiveThreshold || moderator,
      potential_moderator: moderator,
      classification: classify(pct, effectiveThreshold, moderator),
      conflicting_units: g.units.size > 1,
      notes: g.units.size > 1 ? [`Reported in ${g.units.size} different units across studies: ${[...g.units].join(", ")}.`] : [],
    };
  });

  // --- Baseline characteristics: grouped by AI-provided canonical name
  // (exact/near-exact match only). ---
  const bcGroups = new Map<string, { originalLabels: Set<string>; canonicalDisplay: string; studies: Set<string>; units: Set<string> }>();
  for (const s of studies) {
    for (const b of s.baseline_characteristics) {
      const key = normalizeCanonical(b.variable_canonical_name);
      if (!bcGroups.has(key)) bcGroups.set(key, { originalLabels: new Set(), canonicalDisplay: b.variable_canonical_name, studies: new Set(), units: new Set() });
      const g = bcGroups.get(key)!;
      g.originalLabels.add(b.variable_original_label);
      g.studies.add(s.study_id);
      if (b.reported_unit) g.units.add(b.reported_unit);
    }
  }
  const baselineCharacteristics: VariableDictionaryEntry[] = Array.from(bcGroups.entries()).map(([key, g]) => {
    const pct = total > 0 ? (g.studies.size / total) * 100 : 0;
    const moderator = isModeratorCandidate(key);
    return {
      canonical_variable: g.canonicalDisplay,
      category: "baseline_characteristic",
      original_labels: [...g.originalLabels],
      studies_reporting: [...g.studies],
      studies_total: total,
      reporting_count: g.studies.size,
      reporting_pct: Math.round(pct * 10) / 10,
      typical_unit: g.units.size === 1 ? [...g.units][0] : null,
      recommended: thresholdPct === null || pct >= effectiveThreshold || moderator,
      potential_moderator: moderator,
      classification: classify(pct, effectiveThreshold, moderator),
      conflicting_units: g.units.size > 1,
      notes: g.units.size > 1 ? [`Reported in ${g.units.size} different units across studies: ${[...g.units].join(", ")}.`] : [],
    };
  });

  // --- Cross-study warnings: mixed effect measures for the same outcome
  // name (regardless of timepoint - a mix is worth flagging either way). ---
  const warnings: CrossStudyWarning[] = [];
  const effectMeasuresByOutcome = new Map<string, { display: string; measures: Set<string> }>();
  for (const s of studies) {
    for (const o of s.outcomes.generic_iv) {
      const key = normalizeCanonical(o.outcome_name);
      if (!effectMeasuresByOutcome.has(key)) effectMeasuresByOutcome.set(key, { display: o.outcome_name, measures: new Set() });
      effectMeasuresByOutcome.get(key)!.measures.add(o.effect_measure === "Other" ? (o.effect_measure_other_label ?? "Other") : o.effect_measure);
    }
  }
  for (const { display, measures } of effectMeasuresByOutcome.values()) {
    if (measures.size > 1) {
      warnings.push({
        study_id: null,
        warning: `"${display}" is reported using ${measures.size} different effect measures across studies: ${[...measures].join(", ")}. These are not interchangeable and should not be pooled without an explicit, statistically valid conversion.`,
        severity: "high",
        suggested_action: "Review each study's reported effect measure individually before deciding whether/how to combine them.",
      });
    }
  }

  return { studyCharacteristics, baselineCharacteristics, warnings };
}
