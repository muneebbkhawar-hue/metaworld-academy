"use client";

// Reads an uploaded .xlsx/.xls/.csv file into a plain array-of-arrays,
// header rows included (unlike this project's older single-outcome
// upload handlers, which slice off row 0 - the multi-outcome parser needs
// all 3 header rows). Shared by Forest Plot / Funnel Plot / Sensitivity's
// multi-outcome upload panels.
//
// Rows are NOT filtered for blankness here, even though a fully blank row
// is harmless in most sheets (every consumer already skips blank DATA rows
// on its own - see wideFormatParser.ts's `if (!studyId) continue` and
// flatSheetParser.ts's `if (!outcomeName) continue`). Blanket-filtering
// blank rows at this shared layer previously caused a real bug: generic
// inverse variance sheets have no experimental/control split, so their
// group-label header row (row 2 of the 3-row header) is intentionally
// left entirely blank - filtering it out here silently shifted every row
// below it up by one, making the parser read the first DATA row as if it
// were the value-type header row (and reporting its data, e.g. "NA", as a
// bogus "column header" in the mismatch warning).
import * as XLSX from "xlsx";

export function readWorkbookRows(file: File): Promise<unknown[][]> {
  return new Promise((resolve, reject) => {
    const isXlsx = /\.xlsx?$/i.test(file.name);
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = (event) => {
      try {
        if (isXlsx) {
          const wb = XLSX.read(event.target?.result, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
          resolve(rows);
        } else {
          const text = String(event.target?.result ?? "");
          const rows = text.split(/\r?\n/).filter((l) => l.trim() !== "").map((line) => line.split(","));
          resolve(rows);
        }
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Could not parse this file."));
      }
    };
    if (isXlsx) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  });
}
