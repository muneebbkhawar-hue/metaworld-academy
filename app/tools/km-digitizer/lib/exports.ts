import jsPDF from "jspdf";
import { downloadCSVFile, downloadXLSXFile } from "@/app/lib/exportUtils";
import type { ProjectState } from "./types";

export function exportReconstructedCSV(project: ProjectState) {
  const rec = project.reconstruction;
  if (!rec || rec.status !== "success") return;
  const header = ["ID", "Group", "Time", "Event"];
  const rows: (string | number)[][] = [];
  for (const g of rec.groups) {
    if (g.status !== "success" || !g.ipd) continue;
    for (const row of g.ipd) rows.push([row.id, g.name, row.time, row.event]);
  }
  downloadCSVFile("km-digitizer-reconstructed-dataset.csv", header, rows);
}

export function exportReconstructedXLSX(project: ProjectState) {
  const rec = project.reconstruction;
  if (!rec || rec.status !== "success") return;
  const header = ["ID", "Group", "Time", "Event"];
  const rows: (string | number)[][] = [];
  for (const g of rec.groups) {
    if (g.status !== "success" || !g.ipd) continue;
    for (const row of g.ipd) rows.push([row.id, g.name, row.time, row.event]);
  }
  downloadXLSXFile("km-digitizer-reconstructed-dataset.xlsx", "Reconstructed pseudo-IPD", header, rows);
}

export function exportDigitizedPointsCSV(project: ProjectState) {
  const header = ["Group", "Time", "Survival"];
  const rows: (string | number)[][] = [];
  for (const g of project.groups) {
    for (const p of g.points) rows.push([g.name, p.time, p.survival]);
  }
  downloadCSVFile("km-digitizer-digitized-points.csv", header, rows);
}

export function exportProjectJSON(project: ProjectState) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `km-digitizer-project-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function exportPdfReport(project: ProjectState) {
  const rec = project.reconstruction;
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed; left:-99999px; top:0; width:700px; padding:24px; background:#ffffff; color:#111111; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:1.5;";

  const groupRows = project.groups
    .map(
      (g) =>
        `<tr><td>${g.name}</td><td>${g.points.length}</td><td>${g.censoring.length}</td></tr>`
    )
    .join("");

  const nriskRows = project.numbersAtRisk
    .map(
      (r) =>
        `<tr><td>${r.time}</td>${project.groups.map((g) => `<td>${r.valuesByGroupId[g.id] ?? "—"}</td>`).join("")}</tr>`
    )
    .join("");

  const reconstructedSummary = rec && rec.status === "success"
    ? rec.groups
        .map(
          (g) =>
            `<p><strong>${g.name}</strong>: ${g.mode === "reconstructed" ? "Reconstructed pseudo-IPD" : "Digitized curve only"}${
              g.km_summary ? ` — N=${g.km_summary.n}, events=${g.km_summary.events}, censored=${g.km_summary.censored}, median=${g.km_summary.median_estimable ? g.km_summary.median_survival_time : "not estimable"}` : ""
            }</p>`
        )
        .join("")
    : "<p>Not yet reconstructed.</p>";

  container.innerHTML = `
    <h1 style="font-size:18px;">Kaplan-Meier Curve Digitizer — Reconstruction Report</h1>
    <p style="color:#555;">Generated ${new Date().toLocaleString()}</p>

    <h2 style="font-size:14px;">Source figure</h2>
    <p>${project.sourceFile ? `${project.sourceFile.name}${project.sourceFile.pdfPageNumber ? ` (PDF page ${project.sourceFile.pdfPageNumber} of ${project.sourceFile.pdfPageCount})` : ""}` : "No source file recorded."}</p>

    <h2 style="font-size:14px;">Axis calibration</h2>
    <p>X-axis reference points: ${project.xCalibration.refs.length}. Y-axis reference points: ${project.yCalibration.refs.length}. Y-axis scale: ${project.yAxisScale}.</p>

    <h2 style="font-size:14px;">Groups &amp; digitization summary</h2>
    <table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse; width:100%;">
      <tr><th>Group</th><th>Digitized points</th><th>Censoring marks</th></tr>
      ${groupRows}
    </table>

    <h2 style="font-size:14px;">Numbers at risk</h2>
    ${project.numbersAtRiskEnabled && project.numbersAtRisk.length
      ? `<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse; width:100%;"><tr><th>Time</th>${project.groups.map((g) => `<th>${g.name}</th>`).join("")}</tr>${nriskRows}</table>`
      : "<p>Not provided.</p>"}

    <h2 style="font-size:14px;">Reconstruction</h2>
    <p>Method: ${rec?.method || "Not yet run."}</p>
    ${reconstructedSummary}

    <h2 style="font-size:14px;">Important warnings</h2>
    <ul>
      <li>Reconstructed data are estimates derived from a published figure, not original patient-level data.</li>
      <li>Reconstruction accuracy depends on the resolution and clarity of the source figure and the precision of digitization.</li>
      <li>Where a numbers-at-risk table was not available, only a digitized curve (not a reconstructed dataset) is reported for that group.</li>
    </ul>
  `;

  document.body.appendChild(container);
  try {
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    await pdf.html(container, { width: 500, windowWidth: 700, margin: [40, 40, 40, 40], autoPaging: "text" });
    pdf.save("km-digitizer-report.pdf");
  } finally {
    document.body.removeChild(container);
  }
}
