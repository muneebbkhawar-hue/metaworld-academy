// Same-study conflicting-value detection - e.g. Table 1 says N=120 but the
// Methods text says N=118. Never resolved automatically; always surfaced so
// a human reviewer decides, per the brief's explicit example.
import type { StudyExtraction, SameStudyConflict } from "./types";
import { firstNumber } from "./unitConversion.ts";

const SAMPLE_SIZE_LABELS = /sample size|number randomi[sz]ed|n randomi[sz]ed|total (enrolled|randomi[sz]ed)/i;

export function detectSameStudyConflicts(study: StudyExtraction): SameStudyConflict[] {
  const conflicts: SameStudyConflict[] = [];

  // 1. Duplicate (arm_id, original label) baseline entries with differing
  // reported values - the AI may extract the same variable twice from two
  // different tables/passages with inconsistent numbers.
  const seen = new Map<string, { value: string; page: number | null; location: string | null }[]>();
  for (const b of study.baseline_characteristics) {
    const key = `${b.arm_id ?? "overall"}::${b.variable_original_label.trim().toLowerCase()}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push({ value: b.reported_value, page: b.evidence.page, location: b.evidence.location });
  }
  for (const [key, entries] of seen) {
    const distinctValues = new Set(entries.map((e) => e.value.trim()));
    if (distinctValues.size > 1) {
      const [, variable] = key.split("::");
      conflicts.push({
        study_id: study.study_id,
        variable,
        values: entries.map((e) => ({ value: e.value, source_page: e.page, source_location: e.location })),
        severity: "medium",
        suggested_action: "Two or more different values were extracted for the same variable/arm - check the source PDF and select the correct one.",
      });
    }
  }

  // 2. Sum of arm sample sizes vs. a study-level "sample size / number
  // randomized" characteristic, when both are present.
  const armSum = study.arms.reduce((sum, a) => (a.sample_size !== null ? sum + a.sample_size : sum), 0);
  const armsAllKnown = study.arms.every((a) => a.sample_size !== null) && study.arms.length > 0;
  if (armsAllKnown) {
    for (const c of study.study_characteristics) {
      if (SAMPLE_SIZE_LABELS.test(c.variable)) {
        const n = firstNumber(c.value);
        if (n !== null && n !== armSum) {
          conflicts.push({
            study_id: study.study_id,
            variable: `${c.variable} vs. sum of arm sample sizes`,
            values: [
              { value: `${c.value} (as "${c.variable}")`, source_page: c.evidence.page, source_location: c.evidence.location },
              { value: `${armSum} (sum of extracted arm sample sizes: ${study.arms.map((a) => `${a.arm_name}=${a.sample_size}`).join(", ")})`, source_page: null, source_location: null },
            ],
            severity: "high",
            suggested_action: "The reported overall sample size does not match the sum of extracted per-arm sample sizes - verify against the source PDF (this may indicate exclusions, a misread arm, or a genuine extraction error).",
          });
        }
      }
    }
  }

  return conflicts;
}
