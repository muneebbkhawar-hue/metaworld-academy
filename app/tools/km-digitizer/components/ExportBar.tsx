"use client";

import { Download, FileJson, FileText } from "lucide-react";
import type { ProjectState } from "../lib/types";
import { exportReconstructedCSV, exportReconstructedXLSX, exportDigitizedPointsCSV, exportProjectJSON, exportPdfReport } from "../lib/exports";

interface Props {
  project: ProjectState;
}

export default function ExportBar({ project }: Props) {
  const hasReconstruction = project.reconstruction?.status === "success";
  const btnClass = "flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] hover:border-[var(--purple-bright)] transition disabled:opacity-40";

  return (
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={!hasReconstruction} onClick={() => exportReconstructedCSV(project)} className={btnClass}>
        <Download size={14} /> Reconstructed dataset (CSV)
      </button>
      <button type="button" disabled={!hasReconstruction} onClick={() => exportReconstructedXLSX(project)} className={btnClass}>
        <Download size={14} /> Reconstructed dataset (XLSX)
      </button>
      <button type="button" onClick={() => exportDigitizedPointsCSV(project)} className={btnClass}>
        <Download size={14} /> Digitized points (CSV)
      </button>
      <button type="button" onClick={() => exportPdfReport(project)} className={btnClass}>
        <FileText size={14} /> Full report (PDF)
      </button>
      <button type="button" onClick={() => exportProjectJSON(project)} className={btnClass}>
        <FileJson size={14} /> Save project (JSON)
      </button>
    </div>
  );
}
