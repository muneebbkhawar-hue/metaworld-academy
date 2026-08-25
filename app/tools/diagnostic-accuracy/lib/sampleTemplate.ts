"use client";

// Downloadable sample templates - realistic fictional diagnostic-accuracy
// data across multiple studies, with deliberate variation in sensitivity/
// specificity, one zero-cell study (to demonstrate the tool's documented
// zero-cell/continuity-correction handling), and one NA row (to demonstrate
// exclusion-with-reason). The default sample is designed to run
// successfully end to end.
import * as XLSX from "xlsx";

const HEADER = ["Study_ID", "TP", "FP", "FN", "TN", "Author", "Year", "Reference_Standard"];

const ROWS: (string | number)[][] = [
  ["Study 1", 85, 10, 15, 90, "Smith", 2018, "Histopathology"],
  ["Study 2", 70, 20, 30, 80, "Chen", 2019, "Histopathology"],
  ["Study 3", 92, 8, 8, 92, "Garcia", 2020, "Clinical follow-up"],
  ["Study 4", 78, 15, 22, 85, "Patel", 2021, "Histopathology"],
  ["Study 5", 88, 5, 12, 95, "Nguyen", 2021, "Histopathology"],
  ["Study 6", 65, 25, 35, 75, "Kowalski", 2022, "Clinical follow-up"],
  ["Study 7", 0, 3, 40, 97, "Ahmed", 2022, "Histopathology"], // zero-cell (TP=0) - demonstrates continuity correction / undefined-DOR handling
  ["Study 8", "NA", 12, 18, 88, "Lopez", 2023, "Histopathology"], // TP not reported - excluded, demonstrates missing-data handling
];

export function downloadDTASampleCSV() {
  const csv = [HEADER, ...ROWS].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "diagnostic-accuracy-sample.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

export function downloadDTASampleXLSX() {
  const ws = XLSX.utils.aoa_to_sheet([HEADER, ...ROWS]);
  ws["!cols"] = HEADER.map(() => ({ wch: 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Diagnostic Accuracy Data");
  XLSX.writeFile(wb, "diagnostic-accuracy-sample.xlsx");
}
