"use client";

// Generates the "Download Sample" workbooks demonstrating the multi-outcome
// wide-format extraction sheet - fictional studies/outcomes only, built
// with real merged headers (via XLSX's `!merges`) so the downloaded file
// visually matches the format users are expected to fill in, not just a
// flat table.
import * as XLSX from "xlsx";
import type { OutcomeDataType } from "./types";

interface OutcomeSpec {
  name: string;
  /** One row of values per fictional study, aligned to this outcome's block width - use "NA" to demonstrate the missing-data handling. */
  studyValues: (number | string)[][];
}

const DICH_OUTCOMES: OutcomeSpec[] = [
  {
    name: "Mortality",
    studyValues: [
      [5, 100, 9, 100],
      [3, 80, 6, 80],
      [0, 50, 1, 50], // 0 events - deliberately included to show zero is valid, not missing
      [7, 120, 11, 118],
      [4, 90, 8, 92],
    ],
  },
  {
    name: "Stroke",
    studyValues: [
      [2, 100, 3, 100],
      ["NA", 80, 2, 80], // demonstrates: this study is excluded from Stroke only, not from Mortality
      [1, 50, 1, 50],
      [3, 120, 4, 118],
      [1, 90, 2, 92],
    ],
  },
  {
    name: "Procedural Success",
    studyValues: [
      [92, 100, 85, 100],
      [76, 80, 70, 80],
      [48, 50, 44, 50],
      [110, 120, 100, 118],
      [85, 90, 80, 92],
    ],
  },
];

const CONT_OUTCOMES: OutcomeSpec[] = [
  {
    name: "Time to Hemostasis (min)",
    studyValues: [
      [5.2, 1.1, 40, 6.8, 1.4, 40],
      [4.8, 0.9, 35, "NR", 1.2, 35], // missing control mean - excluded from THIS outcome only
      [5.0, 1.0, 30, 6.5, 1.3, 30],
      [5.5, 1.2, 45, 7.0, 1.5, 45],
      [4.9, 1.0, 38, 6.6, 1.3, 38],
    ],
  },
  {
    name: "Access Time (min)",
    studyValues: [
      [12.1, 3.2, 40, 15.4, 3.8, 40],
      [11.5, 3.0, 35, 14.8, 3.5, 35],
      [12.8, 3.4, 30, 16.0, 3.9, 30],
      [11.9, 3.1, 45, 15.1, 3.7, 45],
      [12.3, 3.3, 38, 15.6, 3.6, 38],
    ],
  },
];

const STUDY_IDS = ["Smith 2019", "Chen 2020", "Garcia 2021", "Patel 2022", "Nguyen 2023"];

function buildWorkbook(outcomes: OutcomeSpec[], type: OutcomeDataType, expLabel: string, ctrlLabel: string): XLSX.WorkBook {
  const width = type === "dichotomous" ? 4 : 6;
  const valueLabels = type === "dichotomous" ? ["Events", "Total", "Events", "Total"] : ["Mean", "SD", "Total", "Mean", "SD", "Total"];

  const outcomeNameRow: (string | number)[] = ["Study ID"];
  const groupRow: (string | number)[] = [""];
  const valueTypeRow: (string | number)[] = [""];
  const merges: XLSX.Range[] = [];

  outcomes.forEach((outcome, oi) => {
    const startCol = 1 + oi * width;
    outcomeNameRow.push(outcome.name, ...Array(width - 1).fill(""));
    groupRow.push(expLabel, ...Array(width / 2 - 1).fill(""), ctrlLabel, ...Array(width / 2 - 1).fill(""));
    valueTypeRow.push(...valueLabels);
    merges.push({ s: { r: 0, c: startCol }, e: { r: 0, c: startCol + width - 1 } });
    merges.push({ s: { r: 1, c: startCol }, e: { r: 1, c: startCol + width / 2 - 1 } });
    merges.push({ s: { r: 1, c: startCol + width / 2 }, e: { r: 1, c: startCol + width - 1 } });
  });
  merges.push({ s: { r: 0, c: 0 }, e: { r: 2, c: 0 } }); // "Study ID" spans all 3 header rows

  const dataRows = STUDY_IDS.map((id, si) => {
    const row: (string | number)[] = [id];
    outcomes.forEach((outcome) => row.push(...outcome.studyValues[si]));
    return row;
  });

  const aoa = [outcomeNameRow, groupRow, valueTypeRow, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = merges;
  ws["!cols"] = [{ wch: 16 }, ...Array(outcomes.length * width).fill({ wch: 10 })];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, type === "dichotomous" ? "Dichotomous Outcomes" : "Continuous Outcomes");
  return wb;
}

export function downloadDichotomousSample(expLabel: string, ctrlLabel: string) {
  const wb = buildWorkbook(DICH_OUTCOMES, "dichotomous", expLabel || "Experimental", ctrlLabel || "Control");
  XLSX.writeFile(wb, "multi-outcome-dichotomous-sample.xlsx");
}

export function downloadContinuousSample(expLabel: string, ctrlLabel: string) {
  const wb = buildWorkbook(CONT_OUTCOMES, "continuous", expLabel || "Experimental", ctrlLabel || "Control");
  XLSX.writeFile(wb, "multi-outcome-continuous-sample.xlsx");
}
