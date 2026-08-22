// Builds the sheet data (header + rows) for every export the tool offers -
// the 6-sheet Excel workbook (brief §27) plus the same data as individual
// CSVs (brief §28). Pure data-shaping, no DOM access, so it's shared
// unchanged between the "Download Excel" and "Download CSVs" buttons.
//
// OUTCOME SHEETS - a deliberate deviation from the brief's literal
// "Experimental Events/Total, Control Events/Total" column suggestion:
// since a study may have more than 2 arms (brief §19) and a reviewer's
// "control" may not always be readable arm-by-arm as one fixed pairing,
// each outcome record is kept as ONE ROW PER ARM (long/tidy format) with
// explicit Arm Name + Arm Role columns, rather than forcing every arm into
// 2 fixed columns. This never risks silently mispairing a multi-arm study's
// data, and a reviewer can still trivially pivot to the 2-column form in
// Excel for a simple 2-arm comparison by filtering Arm Role. Documented in
// DOCS.md.
import type { StudyExtraction, VariableDictionaryEntry, SameStudyConflict, CrossStudyWarning } from "./types";

function findArmName(study: StudyExtraction, armId: string): string {
  return study.arms.find((a) => a.arm_id === armId)?.arm_name ?? armId;
}
function findArmRole(study: StudyExtraction, armId: string): string {
  return study.arms.find((a) => a.arm_id === armId)?.arm_role ?? "other";
}

function evidenceCell(ev: { page: number | null; location: string | null; quote: string | null; status: string }) {
  return `${ev.status}${ev.page !== null ? ` (p.${ev.page}${ev.location ? `, ${ev.location}` : ""})` : ""}`;
}

// --- Wide-format Study Characteristics / Baseline Characteristics sheets --
function buildWideSheet(
  studies: StudyExtraction[],
  variables: VariableDictionaryEntry[],
  getValue: (study: StudyExtraction, canonicalKey: string) => string
): { header: string[]; rows: (string | number)[][] } {
  const header = ["Study ID", ...variables.map((v) => `${v.canonical_variable}${v.typical_unit ? ` (${v.typical_unit})` : ""}`)];
  const rows = studies.map((s) => [s.study_id, ...variables.map((v) => getValue(s, v.canonical_variable))]);
  return { header, rows };
}

export function buildStudyCharacteristicsSheet(studies: StudyExtraction[], variables: VariableDictionaryEntry[]): { header: string[]; rows: (string | number)[][] } {
  return buildWideSheet(studies, variables, (study, canonicalVar) => {
    const match = study.study_characteristics.find((c) => c.variable.trim().toLowerCase() === canonicalVar.trim().toLowerCase());
    if (!match) return "NR";
    return match.unit ? `${match.value} ${match.unit}` : match.value;
  });
}

export function buildBaselineCharacteristicsSheet(studies: StudyExtraction[], variables: VariableDictionaryEntry[]): { header: string[]; rows: (string | number)[][] } {
  const header = ["Study ID", "Arm", ...variables.map((v) => `${v.canonical_variable}${v.typical_unit ? ` (${v.typical_unit})` : ""}`)];
  const rows: (string | number)[][] = [];
  for (const s of studies) {
    // Group by arm_id (or "Overall" for arm_id=null) so each row is one
    // study+arm combination.
    const armIds = Array.from(new Set(s.baseline_characteristics.map((b) => b.arm_id))).sort((a, b) => (a ?? "").localeCompare(b ?? ""));
    const groups = armIds.length > 0 ? armIds : [null];
    for (const armId of groups) {
      const armLabel = armId === null ? "Overall" : findArmName(s, armId);
      const values = variables.map((v) => {
        const match = s.baseline_characteristics.find((b) => b.arm_id === armId && b.variable_canonical_name.trim().toLowerCase() === v.canonical_variable.trim().toLowerCase());
        if (!match) return "NR";
        const unit = match.reported_unit ? ` ${match.reported_unit}` : "";
        return `${match.reported_value}${unit}`;
      });
      rows.push([s.study_id, armLabel, ...values]);
    }
  }
  return { header, rows };
}

export function buildDichotomousSheet(studies: StudyExtraction[]) {
  const header = ["Study ID", "Outcome", "Timepoint", "Arm", "Arm Role", "Events", "Total", "Evidence"];
  const rows: (string | number)[][] = [];
  for (const s of studies) {
    for (const o of s.outcomes.dichotomous) {
      rows.push([s.study_id, o.outcome_name, o.timepoint ?? "", findArmName(s, o.arm_id), findArmRole(s, o.arm_id), o.events ?? "NR", o.total ?? "NR", evidenceCell(o.evidence)]);
    }
  }
  return { header, rows };
}

export function buildContinuousSheet(studies: StudyExtraction[]) {
  const header = ["Study ID", "Outcome", "Timepoint", "Arm", "Arm Role", "Mean", "SD", "Total", "Evidence"];
  const rows: (string | number)[][] = [];
  for (const s of studies) {
    for (const o of s.outcomes.continuous) {
      rows.push([s.study_id, o.outcome_name, o.timepoint ?? "", findArmName(s, o.arm_id), findArmRole(s, o.arm_id), o.mean ?? "NR", o.sd ?? "NR", o.total ?? "NR", evidenceCell(o.evidence)]);
    }
  }
  return { header, rows };
}

export function buildGenericIVSheet(studies: StudyExtraction[]) {
  const header = ["Study ID", "Outcome", "Timepoint", "Effect Measure", "Effect Estimate", "Lower 95% CI", "Upper 95% CI", "SE (reported)", "Log Effect (derived)", "SE (derived)", "Evidence"];
  const rows: (string | number)[][] = [];
  for (const s of studies) {
    for (const o of s.outcomes.generic_iv) {
      const measure = o.effect_measure === "Other" ? o.effect_measure_other_label ?? "Other" : o.effect_measure;
      rows.push([
        s.study_id, o.outcome_name, o.timepoint ?? "", measure,
        o.estimate ?? "NR", o.lower_ci ?? "NR", o.upper_ci ?? "NR", o.se_reported ?? "NR",
        o.derived_log_effect ?? "", o.derived_se ?? "", evidenceCell(o.evidence),
      ]);
    }
  }
  return { header, rows };
}

export function buildVariableDictionarySheet(entries: VariableDictionaryEntry[]) {
  const header = ["Canonical Variable", "Category", "Original Labels", "Studies Reporting", "Reporting %", "Typical Unit", "Recommended", "Potential Moderator", "Classification", "Notes"];
  const rows = entries.map((e) => [
    e.canonical_variable,
    e.category === "study_characteristic" ? "Study Characteristic" : "Baseline Characteristic",
    e.original_labels.join("; "),
    `${e.reporting_count}/${e.studies_total}`,
    e.reporting_pct,
    e.typical_unit ?? "",
    e.recommended ? "Yes" : "No",
    e.potential_moderator ? "Yes" : "No",
    e.classification,
    e.notes.join(" "),
  ]);
  return { header, rows };
}

export function buildEvidenceSheet(studies: StudyExtraction[]) {
  const header = ["Study ID", "Section", "Variable", "Value", "Page", "Table/Figure", "Evidence Quote", "Status", "Confidence", "Quote Verified"];
  const rows: (string | number)[][] = [];
  const verifiedCell = (v: boolean | null | undefined) => (v === null || v === undefined ? "N/A" : v ? "Yes" : "NOT VERIFIED");

  for (const s of studies) {
    for (const c of s.study_characteristics) rows.push([s.study_id, "Study characteristic", c.variable, c.value, c.evidence.page ?? "", c.evidence.location ?? "", c.evidence.quote ?? "", c.evidence.status, c.evidence.confidence, verifiedCell(c.evidence.quote_verified)]);
    for (const b of s.baseline_characteristics) rows.push([s.study_id, "Baseline characteristic", `${b.variable_original_label} (${b.arm_id ?? "overall"})`, b.reported_value, b.evidence.page ?? "", b.evidence.location ?? "", b.evidence.quote ?? "", b.evidence.status, b.evidence.confidence, verifiedCell(b.evidence.quote_verified)]);
    for (const o of s.outcomes.dichotomous) rows.push([s.study_id, "Dichotomous outcome", `${o.outcome_name} / ${o.timepoint ?? "n/a"} / ${findArmName(s, o.arm_id)}`, `${o.events ?? "NR"}/${o.total ?? "NR"}`, o.evidence.page ?? "", o.evidence.location ?? "", o.evidence.quote ?? "", o.evidence.status, o.evidence.confidence, verifiedCell(o.evidence.quote_verified)]);
    for (const o of s.outcomes.continuous) rows.push([s.study_id, "Continuous outcome", `${o.outcome_name} / ${o.timepoint ?? "n/a"} / ${findArmName(s, o.arm_id)}`, `${o.mean ?? "NR"} ± ${o.sd ?? "NR"} (n=${o.total ?? "NR"})`, o.evidence.page ?? "", o.evidence.location ?? "", o.evidence.quote ?? "", o.evidence.status, o.evidence.confidence, verifiedCell(o.evidence.quote_verified)]);
    for (const o of s.outcomes.generic_iv) rows.push([s.study_id, "Generic IV outcome", `${o.outcome_name} / ${o.timepoint ?? "n/a"}`, `${o.effect_measure}=${o.estimate ?? "NR"} [${o.lower_ci ?? "NR"}, ${o.upper_ci ?? "NR"}]`, o.evidence.page ?? "", o.evidence.location ?? "", o.evidence.quote ?? "", o.evidence.status, o.evidence.confidence, verifiedCell(o.evidence.quote_verified)]);
  }
  return { header, rows };
}

export function buildWarningsSheet(studies: StudyExtraction[], conflicts: SameStudyConflict[], crossStudyWarnings: CrossStudyWarning[]) {
  const header = ["Study", "Warning", "Severity", "Suggested Action"];
  const rows: (string | number)[][] = [];
  for (const s of studies) {
    for (const w of s.warnings) rows.push([s.study_id, w, "medium", "Review against the source PDF."]);
    for (const q of s.quality_flags) rows.push([s.study_id, q, "medium", "Review the flagged evidence item(s)."]);
  }
  for (const c of conflicts) rows.push([c.study_id, `Conflicting values for "${c.variable}": ${c.values.map((v) => v.value).join(" vs. ")}`, c.severity, c.suggested_action]);
  for (const w of crossStudyWarnings) rows.push([w.study_id ?? "(cross-study)", w.warning, w.severity, w.suggested_action]);
  return { header, rows };
}
