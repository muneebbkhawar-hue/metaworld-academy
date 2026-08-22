// Shared CSV/XLSX export helpers. Originally defined only inside the NMA
// evidence components (evidenceTypes.ts); lifted here unchanged so the new
// Risk of Bias tool can reuse the exact same, already-working export logic
// instead of duplicating it. evidenceTypes.ts re-exports these so every
// existing NMA import keeps working without any change on that side.
import * as XLSX from "xlsx";

export function toCSV(header: string[], rows: (string | number)[][]): string {
  const esc = (c: string | number) => `"${String(c).replace(/"/g, '""')}"`;
  return [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

export function downloadCSVFile(filename: string, header: string[], rows: (string | number)[][]) {
  const csv = toCSV(header, rows);
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function downloadXLSXFile(filename: string, sheetName: string, header: string[], rows: (string | number)[][]) {
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

// Multi-sheet workbook builder - additive to the single-sheet
// downloadXLSXFile above (which stays unchanged for its existing callers).
// Used by the Meta-Analysis Data Extraction tool, whose brief explicitly
// requires one workbook with several distinct sheets (Study Characteristics,
// Baseline Characteristics, Outcomes, Variable Dictionary, Evidence, Warnings)
// rather than forcing incompatible structures into a single sheet.
export interface XLSXSheet {
  name: string;
  header: string[];
  rows: (string | number)[][];
}

export function downloadMultiSheetXLSX(filename: string, sheets: XLSXSheet[]) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    if (sheet.rows.length === 0 && sheet.header.length === 0) continue;
    const ws = XLSX.utils.aoa_to_sheet([sheet.header, ...sheet.rows]);
    // Excel sheet names: max 31 chars, no []:*?/\\
    const safeName = sheet.name.replace(/[[\]:*?/\\]/g, "").slice(0, 31) || "Sheet";
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  }
  if (wb.SheetNames.length === 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["No data"]]), "Sheet1");
  }
  XLSX.writeFile(wb, filename);
}
