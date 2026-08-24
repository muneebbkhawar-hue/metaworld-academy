// Parses a wide-format, multi-outcome extraction sheet (3 header rows,
// grouped outcome blocks) into per-outcome eligible/excluded study lists.
//
// SHEET SHAPE (dichotomous - 4 data columns per outcome):
//   Row 0: Study ID | <Outcome 1 name> |    |    |    | <Outcome 2 name> | ...
//   Row 1:           | <Exp label>     |    | <Ctrl label> |            | ...
//   Row 2:           | Events | Total  | Events | Total    |            | ...
//   Row 3+: data rows
//
// SHEET SHAPE (continuous - 6 data columns per outcome):
//   Row 2: Mean | SD | Total | Mean | SD | Total | ...
//
// Merged cells frequently do NOT survive Excel/CSV parsing (SheetJS's
// sheet_to_json only ever puts a value in the merge's top-left cell,
// leaving the rest blank) - so row 0 and row 1 are reconstructed via a
// left-to-right forward-fill: a blank cell inherits the last non-blank
// value seen in that row. This is the standard, robust technique for this
// exact situation and does not require merge metadata to be present at all.
import type { ContStudyRow, DetectedOutcome, DichStudyRow, ExcludedStudy, OutcomeDataType, OutcomeStudyRow, ParseResult } from "./types.ts";
import { parseRequiredNumericField } from "./missingData.ts";

const BLOCK_WIDTH: Record<OutcomeDataType, number> = { dichotomous: 4, continuous: 6 };

function forwardFill(row: unknown[]): string[] {
  const out: string[] = [];
  let last = "";
  for (const cell of row) {
    const s = String(cell ?? "").trim();
    if (s !== "") last = s;
    out.push(last);
  }
  return out;
}

interface OutcomeBlock {
  name: string;
  startCol: number; // inclusive, 0-indexed within the row (Study ID is column 0, blocks start at column 1)
  width: number;
}

function detectBlocks(outcomeRow: string[], width: number, totalCols: number): OutcomeBlock[] {
  const blocks: OutcomeBlock[] = [];
  let col = 1;
  while (col < totalCols) {
    const name = outcomeRow[col]?.trim();
    if (name) {
      blocks.push({ name, startCol: col, width });
    }
    col += width;
  }
  return blocks;
}

function studyIdOf(row: unknown[]): string {
  return String(row[0] ?? "").trim();
}

/**
 * @param rows Raw sheet rows as returned by XLSX.utils.sheet_to_json(sheet, {header:1, raw:true, defval:""}) - row 0 is the outcome-name header row, NOT a data row. Do not slice off a header row before calling this - it expects all 3 header rows plus data.
 */
export function parseWideFormatWorkbook(rows: unknown[][], type: OutcomeDataType, expLabel: string, ctrlLabel: string): ParseResult {
  const warnings: string[] = [];
  const fatalErrors: string[] = [];

  if (rows.length < 4) {
    return { outcomes: [], fatalErrors: ["The sheet needs at least 3 header rows and 1 data row."], warnings };
  }

  const [outcomeNameRowRaw, groupRowRaw, valueTypeRowRaw, ...dataRows] = rows;
  const totalCols = Math.max(outcomeNameRowRaw.length, groupRowRaw.length, valueTypeRowRaw.length);
  const outcomeNameRow = forwardFill(outcomeNameRowRaw);
  const groupRow = forwardFill(groupRowRaw);
  const valueTypeRow = (valueTypeRowRaw ?? []).map((c) => String(c ?? "").trim().toLowerCase());

  const width = BLOCK_WIDTH[type];
  const blocks = detectBlocks(outcomeNameRow, width, totalCols);

  if (blocks.length === 0) {
    return {
      outcomes: [],
      fatalErrors: [
        `No outcome columns were detected. Expected column A to be "Study ID" followed by groups of ${width} columns per outcome (${type === "dichotomous" ? "Events/Total × 2 groups" : "Mean/SD/Total × 2 groups"}).`,
      ],
      warnings,
    };
  }

  const expectedLabels = type === "dichotomous" ? ["events", "total", "events", "total"] : ["mean", "sd", "total", "mean", "sd", "total"];

  const outcomes: DetectedOutcome[] = blocks.map((block) => {
    // Loose validation of row 3's labels - warn, don't fail, since real-world
    // sheets vary in exact wording ("Event(s)", "N", "Sample Size", etc.).
    for (let i = 0; i < width; i++) {
      const cell = valueTypeRow[block.startCol + i] || "";
      const expected = expectedLabels[i];
      if (!cell.includes(expected)) {
        warnings.push(`"${block.name}": column ${block.startCol + i + 1} header ("${valueTypeRowRaw[block.startCol + i] ?? ""}") doesn't clearly say "${expected}" - verify the sheet matches the expected format.`);
        break; // one warning per block is enough
      }
    }

    const eligibleStudies: OutcomeStudyRow[] = [];
    const excludedStudies: ExcludedStudy[] = [];
    const seenStudyIds = new Set<string>();

    for (const row of dataRows) {
      const studyId = studyIdOf(row);
      if (!studyId) continue; // a fully blank row (common trailing rows in real workbooks) - not an error, just skip

      if (seenStudyIds.has(studyId.toLowerCase())) {
        excludedStudies.push({ study: studyId, reason: "Duplicate Study ID within this outcome - only the first occurrence is used." });
        continue;
      }
      seenStudyIds.add(studyId.toLowerCase());

      if (type === "dichotomous") {
        const eE = parseRequiredNumericField(row[block.startCol]);
        const nE = parseRequiredNumericField(row[block.startCol + 1]);
        const eC = parseRequiredNumericField(row[block.startCol + 2]);
        const nC = parseRequiredNumericField(row[block.startCol + 3]);
        const missingFields: string[] = [];
        if (eE.missing || eE.invalid) missingFields.push(`${expLabel} events`);
        if (nE.missing || nE.invalid) missingFields.push(`${expLabel} total`);
        if (eC.missing || eC.invalid) missingFields.push(`${ctrlLabel} events`);
        if (nC.missing || nC.invalid) missingFields.push(`${ctrlLabel} total`);
        if (missingFields.length > 0) {
          excludedStudies.push({ study: studyId, reason: `Missing/invalid: ${missingFields.join(", ")}` });
        } else {
          eligibleStudies.push({ study: studyId, event_e: eE.value!, n_e: nE.value!, event_c: eC.value!, n_c: nC.value! } as DichStudyRow);
        }
      } else {
        const mE = parseRequiredNumericField(row[block.startCol]);
        const sE = parseRequiredNumericField(row[block.startCol + 1]);
        const nE = parseRequiredNumericField(row[block.startCol + 2]);
        const mC = parseRequiredNumericField(row[block.startCol + 3]);
        const sC = parseRequiredNumericField(row[block.startCol + 4]);
        const nC = parseRequiredNumericField(row[block.startCol + 5]);
        const missingFields: string[] = [];
        if (mE.missing || mE.invalid) missingFields.push(`${expLabel} mean`);
        if (sE.missing || sE.invalid) missingFields.push(`${expLabel} SD`);
        if (nE.missing || nE.invalid) missingFields.push(`${expLabel} total`);
        if (mC.missing || mC.invalid) missingFields.push(`${ctrlLabel} mean`);
        if (sC.missing || sC.invalid) missingFields.push(`${ctrlLabel} SD`);
        if (nC.missing || nC.invalid) missingFields.push(`${ctrlLabel} total`);
        if (missingFields.length > 0) {
          excludedStudies.push({ study: studyId, reason: `Missing/invalid: ${missingFields.join(", ")}` });
        } else {
          eligibleStudies.push({ study: studyId, n_e: nE.value!, mean_e: mE.value!, sd_e: sE.value!, n_c: nC.value!, mean_c: mC.value!, sd_c: sC.value! } as ContStudyRow);
        }
      }
    }

    return {
      name: block.name,
      type,
      eligibleStudies,
      excludedStudies,
      totalStudies: eligibleStudies.length + excludedStudies.length,
    };
  });

  // Also report the group labels actually found, in case they differ
  // wildly from what the user typed in (e.g. sheet says "DRA"/"TRA" but the
  // user typed "Drug-Coated Balloon"/"Standard Balloon") - informational
  // only, never blocks parsing, since the block-position-based parser
  // above doesn't actually depend on these matching.
  const firstBlock = blocks[0];
  const foundExp = groupRow[firstBlock.startCol];
  const foundCtrl = groupRow[firstBlock.startCol + width / 2];
  if (foundExp && expLabel && foundExp.toLowerCase() !== expLabel.toLowerCase()) {
    warnings.push(`Sheet's experimental-group column header says "${foundExp}", but you entered "${expLabel}" as the label - results will use "${expLabel}".`);
  }
  if (foundCtrl && ctrlLabel && foundCtrl.toLowerCase() !== ctrlLabel.toLowerCase()) {
    warnings.push(`Sheet's control-group column header says "${foundCtrl}", but you entered "${ctrlLabel}" as the label - results will use "${ctrlLabel}".`);
  }

  return { outcomes, fatalErrors, warnings };
}
