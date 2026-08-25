// Parses and validates the uploaded/pasted diagnostic-accuracy sheet.
// Columns are read POSITIONALLY (Study_ID, TP, FP, FN, TN = columns 1-5),
// the same convention every other data-input tool in this app uses, so a
// renamed header never breaks import. Any columns beyond the first 5
// (Author, Year, Reference_Standard, etc.) are optional metadata and are
// not required or used in this version's statistical calculations.
//
// Missing-data recognition reuses the SAME token vocabulary
// (NA/N/A/NR/blank/etc., zero always valid) as the multi-outcome tools'
// wideFormatParser, via the shared missingData.ts helpers - "missing" means
// the same thing everywhere in this app.
import { isMissingToken, parseRequiredNumericField } from "../../../lib/multiOutcome/missingData.ts";
import type { DTARawRow, DTAValidationResult } from "./types.ts";

export function parseDTARows(headerRow: unknown[], dataRows: unknown[][]): DTARawRow[] {
  return dataRows
    .map((row, idx) => {
      const study = String(row[0] ?? "").trim();
      const num = (raw: unknown) => {
        const r = parseRequiredNumericField(raw);
        return r.value !== null ? r.value : NaN;
      };
      return { _rowIndex: idx, study, tp: num(row[1]), fp: num(row[2]), fn: num(row[3]), tn: num(row[4]) } as DTARawRow;
    })
    .filter((r) => r.study !== "" && !isMissingToken(r.study));
}

/**
 * Validates parsed rows and splits them into eligible/excluded, with a
 * human-readable reason for every exclusion. This mirrors (does not
 * replace) dta-api.R's own independent re-validation - the backend never
 * trusts this frontend check, but this gives the researcher fast feedback
 * before a network round trip and lets the eligible-only payload be sent.
 */
export function validateDTARows(rows: DTARawRow[]): DTAValidationResult {
  const eligible: DTARawRow[] = [];
  const excluded: DTAValidationResult["excluded"] = [];
  const seen = new Set<string>();

  for (const r of rows) {
    const key = r.study.toLowerCase();
    if (seen.has(key)) {
      excluded.push({ study: r.study, reason: "Duplicate Study_ID - only the first occurrence is used. Rename this study if it is genuinely a different study/threshold." });
      continue;
    }

    const problems: string[] = [];
    (["tp", "fp", "fn", "tn"] as const).forEach((field) => {
      const v = r[field];
      const label = field.toUpperCase();
      if (Number.isNaN(v)) problems.push(`${label} was not reported`);
      else if (v < 0) problems.push(`${label} cannot be negative`);
      else if (!Number.isInteger(v)) problems.push(`${label} must be a whole number (counts, not a proportion)`);
    });
    if (problems.length === 0 && r.tp + r.fp + r.fn + r.tn <= 0) problems.push("total sample size is 0");

    if (problems.length > 0) {
      excluded.push({ study: r.study, reason: `${problems.join("; ")}.` });
      continue;
    }
    seen.add(key);
    eligible.push(r);
  }

  return { eligible, excluded };
}
