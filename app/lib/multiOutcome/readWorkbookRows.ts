"use client";

// Reads an uploaded .xlsx/.xls/.csv file into a plain array-of-arrays,
// header rows included (unlike this project's older single-outcome
// upload handlers, which slice off row 0 - the multi-outcome parser needs
// all 3 header rows). Shared by Forest Plot / Funnel Plot / Sensitivity's
// multi-outcome upload panels.
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
          resolve(rows.filter((r) => r.some((c) => String(c ?? "").trim() !== "")));
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
