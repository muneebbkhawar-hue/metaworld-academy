"use client";

// Kaplan-Meier Curve Digitizer & Survival Data Reconstruction - orchestrator page.
//
// Pipeline: upload figure (client-side only, never leaves the browser) ->
// calibrate X/Y axes (deterministic linear pixel<->data mapping, see
// lib/calibration.ts - NO AI/LLM involved anywhere in this tool) -> define
// groups -> digitize points by clicking -> optional censoring marks ->
// optional numbers-at-risk table -> POST the small structured digitization
// data (never the image) to km-digitizer-api.R's /reconstruct, which runs
// the published Guyot et al. (2012) algorithm via the IPDfromKM R package
// -> visual validation (digitized points vs. reconstructed KM curve) ->
// export.
//
// Undo/redo: a simple linear history of ProjectState snapshots, pushed on
// every mutating action - the same "just resnapshot the whole state"
// approach is simple, correct, and entirely sufficient at this project's
// scale (a KM figure has at most a few hundred points).
import { useCallback, useMemo, useRef, useState } from "react";
import { Undo2, Redo2, RotateCcw } from "lucide-react";
import NavComp from "@/app/components/Nav";
import Footer from "@/app/components/Footer";
import FadeIn from "@/app/components/FadeIn";
import {
  emptyProject,
  newId,
  GROUP_COLORS,
  type ProjectState,
  type WizardStep,
  type SourceFileMeta,
  type Group,
  type NumbersAtRiskRow,
} from "./lib/types";
import { xMapFromCalibration, yMapFromCalibration, pixelToData, isCalibrationComplete } from "./lib/calibration";
import { reconstructSurvivalData } from "./lib/reconstructionClient";
import DigitizeCanvas, { type CanvasMode } from "./components/DigitizeCanvas";
import UploadStep from "./components/UploadStep";
import GroupsPanel from "./components/GroupsPanel";
import NumbersAtRiskPanel from "./components/NumbersAtRiskPanel";
import ReconstructPanel from "./components/ReconstructPanel";
import QualityPanel from "./components/QualityPanel";
import ExportBar from "./components/ExportBar";

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "upload", label: "1. Upload" },
  { key: "calibrate-x", label: "2. Calibrate X" },
  { key: "calibrate-y", label: "3. Calibrate Y" },
  { key: "groups", label: "4. Groups" },
  { key: "digitize", label: "5. Digitize" },
  { key: "censoring", label: "6. Censoring" },
  { key: "nrisk", label: "7. Numbers at risk" },
  { key: "reconstruct", label: "8. Reconstruct" },
  { key: "export", label: "9. Export" },
];

const MAX_HISTORY = 150;

export default function KMDigitizerPage() {
  const [history, setHistory] = useState<ProjectState[]>([emptyProject()]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const project = history[historyIndex];

  const [step, setStep] = useState<WizardStep>("upload");
  const [pendingCalibValue, setPendingCalibValue] = useState<{ pixel: { x: number; y: number } } | null>(null);
  const [calibInput, setCalibInput] = useState("");
  const [reconstructing, setReconstructing] = useState(false);
  const editModeRef = useRef(false);
  const [editMode, setEditMode] = useState(false);

  const commit = useCallback((next: ProjectState) => {
    setHistory((h) => {
      const truncated = h.slice(0, historyIndex + 1);
      const updated = [...truncated, { ...next, updatedAt: new Date().toISOString() }];
      return updated.length > MAX_HISTORY ? updated.slice(updated.length - MAX_HISTORY) : updated;
    });
    setHistoryIndex((i) => Math.min(i + 1, MAX_HISTORY - 1));
  }, [historyIndex]);

  const undo = () => setHistoryIndex((i) => Math.max(0, i - 1));
  const redo = () => setHistoryIndex((i) => Math.min(history.length - 1, i + 1));
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const activeGroup = useMemo(() => project.groups.find((g) => g.id === project.activeGroupId) || null, [project]);

  // ---- Upload ----------------------------------------------------------
  function handleUploaded(meta: SourceFileMeta, dataUrl: string, width: number, height: number) {
    const firstGroup: Group = { id: newId(), name: "Group 1", color: GROUP_COLORS[0], visible: true, points: [], censoring: [] };
    commit({
      ...emptyProject(),
      sourceFile: meta,
      imageDataUrl: dataUrl,
      imageWidth: width,
      imageHeight: height,
      groups: [firstGroup],
      activeGroupId: firstGroup.id,
    });
    setStep("calibrate-x");
  }

  // ---- Calibration -------------------------------------------------------
  function handleCalibrationClick(pixel: { x: number; y: number }) {
    const axis = step === "calibrate-x" ? "x" : "y";
    const cal = axis === "x" ? project.xCalibration : project.yCalibration;
    if (cal.refs.length >= 2) return; // fully calibrated - use "Restart calibration" to redo
    setPendingCalibValue({ pixel });
    setCalibInput("");
  }

  function confirmCalibrationValue() {
    if (!pendingCalibValue) return;
    const value = Number(calibInput);
    if (Number.isNaN(value)) return;
    const axis = step === "calibrate-x" ? "x" : "y";
    const cal = axis === "x" ? project.xCalibration : project.yCalibration;
    const nextCal = { refs: [...cal.refs, { pixel: pendingCalibValue.pixel, value }] };
    commit({ ...project, [axis === "x" ? "xCalibration" : "yCalibration"]: nextCal });
    setPendingCalibValue(null);
    setCalibInput("");
  }

  function restartCalibration(axis: "x" | "y") {
    commit({ ...project, [axis === "x" ? "xCalibration" : "yCalibration"]: { refs: [] } });
    setPendingCalibValue(null);
  }

  // ---- Groups --------------------------------------------------------------
  function addGroup() {
    const g: Group = { id: newId(), name: `Group ${project.groups.length + 1}`, color: GROUP_COLORS[project.groups.length % GROUP_COLORS.length], visible: true, points: [], censoring: [] };
    commit({ ...project, groups: [...project.groups, g], activeGroupId: g.id });
  }
  function renameGroup(id: string, name: string) {
    commit({ ...project, groups: project.groups.map((g) => (g.id === id ? { ...g, name } : g)) });
  }
  function toggleGroupVisible(id: string) {
    commit({ ...project, groups: project.groups.map((g) => (g.id === id ? { ...g, visible: !g.visible } : g)) });
  }
  function deleteGroup(id: string) {
    const remaining = project.groups.filter((g) => g.id !== id);
    commit({
      ...project,
      groups: remaining,
      activeGroupId: project.activeGroupId === id ? remaining[0]?.id ?? null : project.activeGroupId,
      numbersAtRisk: project.numbersAtRisk.map((r) => ({
        ...r,
        valuesByGroupId: Object.fromEntries(Object.entries(r.valuesByGroupId).filter(([groupId]) => groupId !== id)),
      })),
    });
  }
  function selectGroup(id: string) {
    commit({ ...project, activeGroupId: id });
  }

  // ---- Digitization / censoring ------------------------------------------
  const xMap = useMemo(() => xMapFromCalibration(project.xCalibration), [project.xCalibration]);
  const yMap = useMemo(() => yMapFromCalibration(project.yCalibration), [project.yCalibration]);

  function handleDigitizeClick(pixel: { x: number; y: number }) {
    if (!activeGroup || !xMap || !yMap) return;
    const { time, survival } = pixelToData(pixel, xMap, yMap, project.yAxisScale);
    const point = { id: newId(), time, survival, pixel };
    commit({ ...project, groups: project.groups.map((g) => (g.id === activeGroup.id ? { ...g, points: [...g.points, point] } : g)) });
  }

  function handleCensoringClick(pixel: { x: number; y: number }) {
    if (!activeGroup || !xMap || !yMap) return;
    const { time, survival } = pixelToData(pixel, xMap, yMap, project.yAxisScale);
    const mark = { id: newId(), time, survival, pixel };
    commit({ ...project, groups: project.groups.map((g) => (g.id === activeGroup.id ? { ...g, censoring: [...g.censoring, mark] } : g)) });
  }

  function handlePointDrag(id: string, pixel: { x: number; y: number }, kind: "curve" | "censor") {
    if (!xMap || !yMap) return;
    const { time, survival } = pixelToData(pixel, xMap, yMap, project.yAxisScale);
    commit({
      ...project,
      groups: project.groups.map((g) => ({
        ...g,
        points: kind === "curve" ? g.points.map((p) => (p.id === id ? { ...p, time, survival, pixel } : p)) : g.points,
        censoring: kind === "censor" ? g.censoring.map((c) => (c.id === id ? { ...c, time, survival, pixel } : c)) : g.censoring,
      })),
    });
  }

  function handlePointDelete(id: string, kind: "curve" | "censor") {
    commit({
      ...project,
      groups: project.groups.map((g) => ({
        ...g,
        points: kind === "curve" ? g.points.filter((p) => p.id !== id) : g.points,
        censoring: kind === "censor" ? g.censoring.filter((c) => c.id !== id) : g.censoring,
      })),
    });
  }

  function clearActiveGroupPoints() {
    if (!activeGroup) return;
    commit({ ...project, groups: project.groups.map((g) => (g.id === activeGroup.id ? { ...g, points: [], censoring: [] } : g)) });
  }

  // ---- Numbers at risk -----------------------------------------------------
  function setNumbersAtRisk(rows: NumbersAtRiskRow[]) {
    commit({ ...project, numbersAtRisk: rows });
  }
  function setNumbersAtRiskEnabled(enabled: boolean) {
    commit({ ...project, numbersAtRiskEnabled: enabled });
  }

  // ---- Reconstruction -------------------------------------------------------
  async function runReconstruction() {
    setReconstructing(true);
    const result = await reconstructSurvivalData(project.groups, project.numbersAtRiskEnabled ? project.numbersAtRisk : [], project.yAxisScale);
    commit({ ...project, reconstruction: result, reconstructionAccepted: false });
    setReconstructing(false);
  }
  function acceptReconstruction() {
    commit({ ...project, reconstructionAccepted: true });
    setStep("export");
  }
  function editDigitization() {
    commit({ ...project, reconstruction: null });
    setStep("digitize");
  }

  const canRunReconstruction = isCalibrationComplete(project.xCalibration) && isCalibrationComplete(project.yCalibration) && project.groups.every((g) => g.points.length >= 2);

  // ---- Canvas mode mapping --------------------------------------------------
  const canvasMode: CanvasMode = editMode
    ? "edit"
    : step === "calibrate-x"
    ? "calibrate-x"
    : step === "calibrate-y"
    ? "calibrate-y"
    : step === "digitize"
    ? "digitize"
    : step === "censoring"
    ? "censoring"
    : "view";

  const visibleCurvePoints = project.groups.filter((g) => g.visible).flatMap((g) => g.points.map((p) => ({ id: p.id, pixel: p.pixel, color: g.color })));
  const activeGroupPointIds = new Set(activeGroup?.points.map((p) => p.id) ?? []);
  const censorMarks = project.groups.filter((g) => g.visible).flatMap((g) => g.censoring.map((c) => ({ id: c.id, pixel: c.pixel, color: g.color })));

  const showCanvas = !!project.imageDataUrl && step !== "upload" && step !== "export";

  return (
    <>
      <NavComp />
      <main className="max-w-7xl mx-auto px-6 py-16">
        <FadeIn>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Kaplan–Meier Curve Digitizer</h1>
          <p className="text-lg text-[var(--text-secondary)] max-w-3xl mb-8">
            Digitize survival curves and reconstruct survival data for meta-analysis. Uses the published Guyot et al. (2012) method —
            no AI/LLM involved anywhere in this tool.
          </p>
        </FadeIn>

        <div className="flex flex-wrap gap-2 mb-8">
          {STEPS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStep(s.key)}
              disabled={s.key !== "upload" && !project.imageDataUrl}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition disabled:opacity-30 ${
                step === s.key ? "border-[var(--purple-bright)] text-[var(--purple-bright)] bg-[var(--purple-bright)]/10" : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {step === "upload" && <UploadStep onLoaded={handleUploaded} />}

        {showCanvas && (
          <div className="grid lg:grid-cols-[1fr_320px] gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <button type="button" onClick={undo} disabled={!canUndo} className="p-2 rounded-md border border-[var(--border-subtle)] disabled:opacity-30" title="Undo">
                  <Undo2 size={15} />
                </button>
                <button type="button" onClick={redo} disabled={!canRedo} className="p-2 rounded-md border border-[var(--border-subtle)] disabled:opacity-30" title="Redo">
                  <Redo2 size={15} />
                </button>
                {(step === "digitize" || step === "censoring") && (
                  <>
                    <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] ml-2">
                      <input type="checkbox" checked={editMode} onChange={(e) => { setEditMode(e.target.checked); editModeRef.current = e.target.checked; }} />
                      Edit mode (drag to move, right-click to delete)
                    </label>
                    <button type="button" onClick={clearActiveGroupPoints} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] hover:text-red-500">
                      <RotateCcw size={13} /> Clear active group&apos;s points
                    </button>
                  </>
                )}
                {(step === "calibrate-x" || step === "calibrate-y") && (
                  <button
                    type="button"
                    onClick={() => restartCalibration(step === "calibrate-x" ? "x" : "y")}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] hover:text-red-500"
                  >
                    <RotateCcw size={13} /> Restart calibration
                  </button>
                )}
              </div>

              {(step === "calibrate-x" || step === "calibrate-y") && (
                <p className="text-sm text-[var(--text-secondary)] mb-3">
                  Click two known reference points on the {step === "calibrate-x" ? "X" : "Y"}-axis, then enter their real values.{" "}
                  {(step === "calibrate-x" ? project.xCalibration : project.yCalibration).refs.length}/2 points set.
                </p>
              )}
              {step === "digitize" && <p className="text-sm text-[var(--text-secondary)] mb-3">Click along <strong>{activeGroup?.name}</strong>&apos;s curve to place points.</p>}
              {step === "censoring" && <p className="text-sm text-[var(--text-secondary)] mb-3">Click on censoring tick marks for <strong>{activeGroup?.name}</strong>.</p>}

              <DigitizeCanvas
                imageUrl={project.imageDataUrl!}
                imageWidth={project.imageWidth}
                imageHeight={project.imageHeight}
                mode={canvasMode}
                xRefs={project.xCalibration.refs.map((r) => ({ pixel: r.pixel, label: String(r.value) }))}
                yRefs={project.yCalibration.refs.map((r) => ({ pixel: r.pixel, label: String(r.value) }))}
                visibleCurvePoints={visibleCurvePoints}
                activeGroupPointIds={activeGroupPointIds}
                censorMarks={censorMarks}
                onCanvasClick={step === "calibrate-x" || step === "calibrate-y" ? handleCalibrationClick : step === "digitize" ? handleDigitizeClick : step === "censoring" ? handleCensoringClick : () => {}}
                onPointDragEnd={handlePointDrag}
                onPointRightClick={handlePointDelete}
              />

              {pendingCalibValue && (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-[var(--purple-bright)] bg-[var(--bg-elevated)] p-3">
                  <span className="text-sm text-[var(--text-primary)]">Actual {step === "calibrate-x" ? "X" : "Y"} value at this point:</span>
                  <input
                    autoFocus
                    type="number"
                    value={calibInput}
                    onChange={(e) => setCalibInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && confirmCalibrationValue()}
                    className="w-28 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-void)] px-2 py-1 text-sm"
                  />
                  <button type="button" onClick={confirmCalibrationValue} className="px-3 py-1.5 rounded-md text-white text-sm" style={{ backgroundImage: "var(--gradient-primary)" }}>
                    Confirm
                  </button>
                </div>
              )}

              {step === "digitize" && activeGroup && activeGroup.points.length > 0 && (
                <div className="mt-4 max-h-56 overflow-y-auto rounded-lg border border-[var(--border-subtle)]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[var(--bg-elevated)]">
                      <tr>
                        <th className="text-left px-3 py-1.5 text-[var(--text-secondary)]">Group</th>
                        <th className="text-left px-3 py-1.5 text-[var(--text-secondary)]">Time</th>
                        <th className="text-left px-3 py-1.5 text-[var(--text-secondary)]">Survival</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeGroup.points.map((p) => (
                        <tr key={p.id} className="border-t border-[var(--border-subtle)]">
                          <td className="px-3 py-1 text-[var(--text-primary)]">{activeGroup.name}</td>
                          <td className="px-3 py-1 text-[var(--text-primary)]">{p.time.toFixed(2)}</td>
                          <td className="px-3 py-1 text-[var(--text-primary)]">{p.survival.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {step === "groups" && (
                <div className="mt-4">
                  <GroupsPanel groups={project.groups} activeGroupId={project.activeGroupId} onSelect={selectGroup} onRename={renameGroup} onToggleVisible={toggleGroupVisible} onAdd={addGroup} onDelete={deleteGroup} />
                </div>
              )}

              {step === "nrisk" && (
                <div className="mt-4">
                  <NumbersAtRiskPanel groups={project.groups} rows={project.numbersAtRisk} enabled={project.numbersAtRiskEnabled} onSetEnabled={setNumbersAtRiskEnabled} onChange={setNumbersAtRisk} />
                </div>
              )}

              {step === "reconstruct" && (
                <div className="mt-4">
                  <ReconstructPanel result={project.reconstruction} busy={reconstructing} accepted={project.reconstructionAccepted} onRun={runReconstruction} onAccept={acceptReconstruction} onEdit={editDigitization} canRun={canRunReconstruction} />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-6">
              <QualityPanel project={project} />
              {project.groups.length > 0 && step !== "groups" && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Active group</h3>
                  <GroupsPanel groups={project.groups} activeGroupId={project.activeGroupId} onSelect={selectGroup} onRename={renameGroup} onToggleVisible={toggleGroupVisible} onAdd={addGroup} onDelete={deleteGroup} />
                </div>
              )}
            </div>
          </div>
        )}

        {step === "export" && project.imageDataUrl && (
          <div className="grid lg:grid-cols-[1fr_320px] gap-6">
            <div className="flex flex-col gap-6">
              <ExportBar project={project} />
              {project.reconstruction?.validationPlotBase64 && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={project.reconstruction.validationPlotBase64} alt="Validation plot" className="rounded-lg border border-[var(--border-subtle)] max-w-full" />
              )}
            </div>
            <QualityPanel project={project} />
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
