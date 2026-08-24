"use client";

// Downloadable sample sheet demonstrating GRADE's flat, one-row-per-outcome
// batch format - fictional outcomes only. Deliberately includes an NR cell
// and a blank cell to demonstrate the missing-data handling described in
// flatSheetParser.ts (that row gets excluded with a clear reason, the rest
// of the batch still runs).
import * as XLSX from "xlsx";

const HEADER = ["Outcome", "Effect (95% CI)", "Study Design", "k (Studies)", "n (Participants)", "I2 (%)", "Risk of Bias", "Publication Bias", "Indirectness Override"];

const ROWS: (string | number)[][] = [
  ["All-cause mortality", "RR 0.82 (0.71 to 0.95)", "RCT", 12, 3450, 25, "Not serious", "Undetected", ""],
  ["Major bleeding", "RR 1.15 (0.90 to 1.47)", "RCT", 9, 2600, 42, "Serious", "Undetected", ""],
  ["Stroke", "RR 0.76 (0.55 to 1.05)", "RCT", 8, 2100, 61, "Not serious", "Suspected", ""],
  ["Reintervention", "NR", "RCT", 6, "NA", 18, "Not serious", "Undetected", ""], // deliberately missing effect/n - excluded from THIS outcome only
  ["Quality of life (surrogate)", "MD 4.2 (1.1 to 7.3)", "Observational", 5, 890, 33, "Serious", "Undetected", "Serious"],
];

export function downloadGradeSample() {
  const ws = XLSX.utils.aoa_to_sheet([HEADER, ...ROWS]);
  ws["!cols"] = HEADER.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "GRADE Outcomes");
  XLSX.writeFile(wb, "grade-multi-outcome-sample.xlsx");
}
