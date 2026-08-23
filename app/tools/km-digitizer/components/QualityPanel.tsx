"use client";

import { CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import type { ProjectState } from "../lib/types";
import { isCalibrationComplete } from "../lib/calibration";

interface Props {
  project: ProjectState;
}

function Row({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done ? <CheckCircle2 size={15} className="text-green-500 shrink-0" /> : <Circle size={15} className="text-[var(--text-secondary)] shrink-0" />}
      <span className={done ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}>{label}</span>
    </div>
  );
}

export default function QualityPanel({ project }: Props) {
  const xDone = isCalibrationComplete(project.xCalibration);
  const yDone = isCalibrationComplete(project.yCalibration);
  const groupsDigitized = project.groups.filter((g) => g.points.length >= 2);
  const totalCensoring = project.groups.reduce((s, g) => s + g.censoring.length, 0);
  const reconstructed = project.reconstruction?.status === "success";

  const warnings: string[] = [];
  if (reconstructed) {
    warnings.push("Reconstructed data are estimates derived from the digitized figure, not original patient-level data.");
    const anyCurveOnly = project.reconstruction!.groups.some((g) => g.mode === "curve_only");
    if (anyCurveOnly) warnings.push("One or more groups have no numbers-at-risk table, so only the digitized curve is available for them (no reconstructed pseudo-IPD).");
    warnings.push("Reconstruction accuracy depends on the resolution and clarity of the source figure and the precision of digitization.");
  }

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Calibration</h3>
        <Row done={xDone} label="X-axis calibrated" />
        <Row done={yDone} label="Y-axis calibrated" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Digitization</h3>
        {project.groups.map((g) => (
          <Row key={g.id} done={g.points.length >= 2} label={`${g.name}: ${g.points.length} point${g.points.length === 1 ? "" : "s"}`} />
        ))}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Censoring</h3>
        <Row done={totalCensoring > 0} label={totalCensoring > 0 ? `${totalCensoring} censoring mark${totalCensoring === 1 ? "" : "s"} entered` : "No censoring marks entered"} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Numbers at risk</h3>
        <Row done={project.numbersAtRiskEnabled && project.numbersAtRisk.length > 0} label={project.numbersAtRiskEnabled ? "Entered" : "Not entered"} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Reconstruction</h3>
        <Row done={reconstructed} label={reconstructed ? "Completed" : "Not yet run"} />
      </div>
      {warnings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Warnings</h3>
          <div className="flex flex-col gap-1.5">
            {warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-500 flex items-start gap-2">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" /> {w}
              </p>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-[var(--text-secondary)] pt-2 border-t border-[var(--border-subtle)]">
        {groupsDigitized.length} of {project.groups.length} group{project.groups.length === 1 ? "" : "s"} digitized.
      </p>
    </div>
  );
}
