// Frontend pre-flight validation. This intentionally mirrors (but does not
// replace) the authoritative validation inside metareg-api.R - the backend
// re-validates everything independently since it must stay safe even if
// this frontend check is bypassed (e.g. a direct API call). This file only
// gives the researcher fast, clear feedback before a network round trip.

import type { MetaRegDataRow, SelectedModerator, OutcomeType } from './types';

export function validateRows(rows: MetaRegDataRow[], outcomeType: OutcomeType): string[] {
  const errors: string[] = [];
  if (rows.length === 0) return ["No rows found. Upload or paste data first."];

  const studyNames = rows.map(r => r.study.trim());
  if (studyNames.some(s => s === "")) errors.push("One or more rows are missing a study ID.");
  const seen = new Map<string, number>();
  studyNames.forEach(s => seen.set(s, (seen.get(s) ?? 0) + 1));
  const dups = Array.from(seen.entries()).filter(([, c]) => c > 1).map(([s]) => s);
  if (dups.length > 0) errors.push(`Duplicated study identifiers: ${dups.join(", ")}. Each row must be a distinct study.`);

  if (outcomeType === "dichotomous") {
    rows.forEach(r => {
      if (r.event_e === undefined || Number.isNaN(r.event_e) || r.event_c === undefined || Number.isNaN(r.event_c)) errors.push(`${r.study || "A row"}: missing/invalid event count.`);
      if (!r.n_e || r.n_e <= 0 || !r.n_c || r.n_c <= 0) errors.push(`${r.study || "A row"}: Total (N) must be positive for both groups.`);
    });
  } else if (outcomeType === "continuous") {
    rows.forEach(r => {
      if (r.mean_e === undefined || Number.isNaN(r.mean_e) || r.mean_c === undefined || Number.isNaN(r.mean_c)) errors.push(`${r.study || "A row"}: missing/invalid mean.`);
      if (!r.sd_e || r.sd_e <= 0 || !r.sd_c || r.sd_c <= 0) errors.push(`${r.study || "A row"}: SD must be greater than 0 for both groups.`);
      if (!r.n_e || r.n_e <= 0 || !r.n_c || r.n_c <= 0) errors.push(`${r.study || "A row"}: Total (N) must be positive for both groups.`);
    });
  } else {
    rows.forEach(r => {
      if (r.te === undefined || Number.isNaN(r.te)) errors.push(`${r.study || "A row"}: missing/invalid effect estimate.`);
      if (!r.se || r.se <= 0) errors.push(`${r.study || "A row"}: SE must be a positive number.`);
    });
  }
  return Array.from(new Set(errors)); // de-duplicate repeated per-row messages of the same kind
}

export function validateModerators(rows: MetaRegDataRow[], moderators: SelectedModerator[]): string[] {
  const errors: string[] = [];
  if (moderators.length === 0) errors.push("Select at least one moderator - this tool is for meta-regression, not an ordinary pooled estimate.");

  const names = moderators.map(m => m.name);
  if (new Set(names).size !== names.length) errors.push("The same moderator cannot be selected twice.");

  moderators.forEach(mod => {
    const values = rows.map(r => r.moderators?.[mod.name]).filter((v): v is string => v !== undefined && v !== "");
    const missing = rows.length - values.length;
    if (values.length === 0) { errors.push(`Moderator "${mod.name}" has no data in any study.`); return; }
    if (mod.type === "continuous") {
      const nums = values.map(Number).filter(Number.isFinite);
      if (nums.length < values.length) errors.push(`Moderator "${mod.name}" is set to continuous but contains non-numeric values - change its type to categorical or fix the data.`);
      else if (new Set(nums).size < 2) errors.push(`Moderator "${mod.name}" has no variation across studies with data (constant value) - it cannot be modeled.`);
    } else {
      const distinct = new Set(values);
      if (distinct.size < 2) errors.push(`Moderator "${mod.name}" has fewer than 2 categories among studies with data - it cannot be modeled.`);
      if (mod.reference && !distinct.has(mod.reference)) errors.push(`Reference category "${mod.reference}" for "${mod.name}" does not occur in the data.`);
    }
    if (missing > 0 && missing === rows.length) errors.push(`Moderator "${mod.name}" is missing for every study.`);
  });

  const usableRows = rows.filter(r => moderators.every(m => {
    const v = r.moderators?.[m.name];
    return v !== undefined && v !== "";
  }));
  if (usableRows.length > 0 && usableRows.length <= moderators.length + 1) {
    errors.push(`Only ${usableRows.length} studies have complete data for all selected moderators, which is not enough to fit ${moderators.length} moderator(s) plus an intercept. Select fewer moderators or use a dataset with more complete studies.`);
  }
  return errors;
}
