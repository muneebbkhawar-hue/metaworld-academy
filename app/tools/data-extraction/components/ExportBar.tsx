"use client";

import { downloadCSVFile, downloadMultiSheetXLSX } from "@/app/lib/exportUtils";
import type { StudyExtraction, VariableDictionaryEntry, SameStudyConflict, CrossStudyWarning } from "@/app/lib/extraction/types";
import {
  buildStudyCharacteristicsSheet, buildBaselineCharacteristicsSheet, buildDichotomousSheet,
  buildContinuousSheet, buildGenericIVSheet, buildVariableDictionarySheet, buildEvidenceSheet, buildWarningsSheet,
} from "@/app/lib/extraction/workbookBuilder";

export default function ExportBar({
  projectName, studies, variables, conflicts, crossStudyWarnings, totalStudies,
}: {
  projectName: string;
  studies: StudyExtraction[];
  variables: { studyCharacteristics: VariableDictionaryEntry[]; baselineCharacteristics: VariableDictionaryEntry[] };
  conflicts: SameStudyConflict[];
  crossStudyWarnings: CrossStudyWarning[];
  totalStudies: number; // count of ALL uploaded studies (including still-queued/failed), for the partial-batch notice below
}) {
  const slug = (projectName || "extraction").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const recommended = { studyCharacteristics: variables.studyCharacteristics.filter((v) => v.recommended), baselineCharacteristics: variables.baselineCharacteristics.filter((v) => v.recommended) };

  function downloadExcel() {
    const sc = buildStudyCharacteristicsSheet(studies, recommended.studyCharacteristics);
    const bc = buildBaselineCharacteristicsSheet(studies, recommended.baselineCharacteristics);
    const dich = buildDichotomousSheet(studies);
    const cont = buildContinuousSheet(studies);
    const giv = buildGenericIVSheet(studies);
    const dict = buildVariableDictionarySheet([...variables.studyCharacteristics, ...variables.baselineCharacteristics]);
    const evid = buildEvidenceSheet(studies);
    const warn = buildWarningsSheet(studies, conflicts, crossStudyWarnings);

    downloadMultiSheetXLSX(`${slug}-extraction.xlsx`, [
      { name: "Study Characteristics", ...sc },
      { name: "Baseline Characteristics", ...bc },
      ...(dich.rows.length > 0 ? [{ name: "Outcomes - Dichotomous", ...dich }] : []),
      ...(cont.rows.length > 0 ? [{ name: "Outcomes - Continuous", ...cont }] : []),
      ...(giv.rows.length > 0 ? [{ name: "Outcomes - Generic IV", ...giv }] : []),
      { name: "Variable Dictionary", ...dict },
      { name: "Evidence & Provenance", ...evid },
      { name: "Warnings", ...warn },
    ]);
  }

  function downloadAllCSVs() {
    downloadCSVFile(`${slug}-study-characteristics.csv`, ...toArgs(buildStudyCharacteristicsSheet(studies, recommended.studyCharacteristics)));
    downloadCSVFile(`${slug}-baseline-characteristics.csv`, ...toArgs(buildBaselineCharacteristicsSheet(studies, recommended.baselineCharacteristics)));
    const dich = buildDichotomousSheet(studies); if (dich.rows.length > 0) downloadCSVFile(`${slug}-outcomes-dichotomous.csv`, ...toArgs(dich));
    const cont = buildContinuousSheet(studies); if (cont.rows.length > 0) downloadCSVFile(`${slug}-outcomes-continuous.csv`, ...toArgs(cont));
    const giv = buildGenericIVSheet(studies); if (giv.rows.length > 0) downloadCSVFile(`${slug}-outcomes-generic-iv.csv`, ...toArgs(giv));
    downloadCSVFile(`${slug}-variable-dictionary.csv`, ...toArgs(buildVariableDictionarySheet([...variables.studyCharacteristics, ...variables.baselineCharacteristics])));
    downloadCSVFile(`${slug}-evidence-provenance.csv`, ...toArgs(buildEvidenceSheet(studies)));
    downloadCSVFile(`${slug}-warnings.csv`, ...toArgs(buildWarningsSheet(studies, conflicts, crossStudyWarnings)));
  }

  function downloadEvidenceReport() {
    downloadCSVFile(`${slug}-evidence-report.csv`, ...toArgs(buildEvidenceSheet(studies)));
  }

  function downloadVariableDictionary() {
    downloadCSVFile(`${slug}-variable-dictionary.csv`, ...toArgs(buildVariableDictionarySheet([...variables.studyCharacteristics, ...variables.baselineCharacteristics])));
  }

  function downloadSummary() {
    const header = ["Metric", "Value"];
    const rows: (string | number)[][] = [
      ["Studies processed", studies.length],
      ["Study characteristics identified", variables.studyCharacteristics.length],
      ["Baseline variables identified", variables.baselineCharacteristics.length],
      ["Dichotomous outcome records", studies.reduce((s, st) => s + st.outcomes.dichotomous.length, 0)],
      ["Continuous outcome records", studies.reduce((s, st) => s + st.outcomes.continuous.length, 0)],
      ["Generic IV outcome records", studies.reduce((s, st) => s + st.outcomes.generic_iv.length, 0)],
      ["Same-study conflicts detected", conflicts.length],
      ["Cross-study warnings", crossStudyWarnings.length],
    ];
    downloadCSVFile(`${slug}-summary.csv`, header, rows);
  }

  const isPartial = studies.length < totalStudies;

  return (
    <div>
      <p className={`text-xs mb-3 ${isPartial ? "text-amber-300" : "text-emerald-300"}`}>
        {isPartial
          ? `Partial batch — ${studies.length} of ${totalStudies} studies completed. Export includes only completed studies; nothing is invented for the rest.`
          : `All ${totalStudies} studies completed.`}
      </p>
      <div className="flex flex-wrap gap-3">
        <button onClick={downloadExcel} className="px-4 py-2 rounded-lg text-white font-medium text-sm" style={{ backgroundImage: "var(--gradient-primary)" }}>Download Excel workbook</button>
        <button onClick={downloadAllCSVs} className="px-4 py-2 rounded-lg border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] hover:border-[var(--border-hover)]">Download all CSVs</button>
        <button onClick={downloadEvidenceReport} className="px-4 py-2 rounded-lg border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] hover:border-[var(--border-hover)]">Download evidence report</button>
        <button onClick={downloadVariableDictionary} className="px-4 py-2 rounded-lg border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] hover:border-[var(--border-hover)]">Download variable dictionary</button>
        <button onClick={downloadSummary} className="px-4 py-2 rounded-lg border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] hover:border-[var(--border-hover)]">Download summary</button>
      </div>
    </div>
  );
}

function toArgs(sheet: { header: string[]; rows: (string | number)[][] }): [string[], (string | number)[][]] {
  return [sheet.header, sheet.rows];
}
