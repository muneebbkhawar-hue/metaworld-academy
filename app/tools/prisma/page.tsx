"use client";

// PRISMA 2020 Flow Diagram Generator — entirely client-side (no R backend,
// no AI/Gemini call, no server route). Inputs live in React state, mirrored
// to localStorage for autosave, run through app/lib/prisma/calculations.ts
// (pure, unit-tested), and rendered via app/lib/prisma/svgBuilder.ts into a
// vector SVG that is both the live preview and the export source — so the
// exported file is always exactly what's on screen, with no page chrome.
import { useEffect, useMemo, useRef, useState } from "react";
import { Workflow, RotateCcw, CheckCircle2, Download, Plus } from "lucide-react";
import NavComp from "@/app/components/Nav";
import Footer from "@/app/components/Footer";
import FadeIn from "@/app/components/FadeIn";
import {
  emptyFormState,
  PRESET_DATABASES,
  PRESET_REGISTERS,
  PRESET_EXCLUSION_REASONS,
  type PrismaFormState,
  type CountEntry,
  type ExclusionReasonEntry,
} from "@/app/lib/prisma/types";
import { computePrisma } from "@/app/lib/prisma/calculations";
import { buildPrismaSvg } from "@/app/lib/prisma/svgBuilder";
import { downloadSvg, downloadPng, downloadJpeg, downloadPdf, type ExportResolution } from "@/app/lib/prisma/exportDiagram";
import { Card, CountRow, NumberField, Checkbox, TotalLine } from "./components/shared";
import ValidationList from "./components/ValidationList";

const STORAGE_KEY = "prisma-flow-diagram-form-v1";
let idCounter = 0;
const nextId = () => `id-${Date.now()}-${idCounter++}`;

function loadSaved(): PrismaFormState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PrismaFormState;
    // Basic shape check — never trust localStorage blindly.
    if (!parsed || !Array.isArray(parsed.databases) || !Array.isArray(parsed.registers)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function PrismaFlowDiagramPage() {
  const [state, setState] = useState<PrismaFormState>(emptyFormState());
  const [hydrated, setHydrated] = useState(false);
  const [exportResolution, setExportResolution] = useState<ExportResolution>("standard");
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // react-hooks/set-state-in-effect: intentional exception, same pattern as
  // the data-extraction tool's resume-banner effect — this reads an
  // external store (localStorage) exactly once on mount to restore a
  // previous session; there is no way to know the saved state without
  // reading it first, and this never re-runs reactively.
  useEffect(() => {
    const saved = loadSaved();
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(saved);
    }
    setHydrated(true);
  }, []);

  // Autosave on every change, after the initial restore has happened.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage can throw (private browsing, quota) — autosave is a
      // convenience, not a requirement, so failures are silently ignored.
    }
  }, [state, hydrated]);

  const { calc, messages, hasErrors } = useMemo(() => computePrisma(state), [state]);

  const diagramModel = useMemo(
    () => ({
      calc,
      databaseSources: state.databases
        .filter((d) => d.count !== null)
        .map((d) => ({ name: d.name || "Database", count: d.count ?? 0 })),
      registerSources: state.registers
        .filter((r) => r.count !== null)
        .map((r) => ({ name: r.name || "Register", count: r.count ?? 0 })),
      duplicatesRemoved: state.duplicatesRemoved ?? 0,
      recordsExcluded: state.recordsExcluded ?? 0,
      reportsNotRetrieved: state.reportsNotRetrieved ?? 0,
      exclusionReasons: state.exclusionReasons
        .filter((r) => r.count !== null)
        .map((r) => ({ label: r.isCustom ? r.label || "Other" : r.label, count: r.count ?? 0 })),
      studiesIncluded: state.studiesIncluded ?? 0,
      reportsOfIncludedStudies: state.reportsOfIncludedStudies ?? 0,
      distinguishReportsFromStudies: state.distinguishReportsFromStudies,
    }),
    [state, calc]
  );

  const { svg, width, height } = useMemo(() => buildPrismaSvg(diagramModel), [diagramModel]);

  function resetAll() {
    const hasData =
      state.databases.length > 0 || state.registers.length > 0 || state.exclusionReasons.length > 0 ||
      state.duplicatesRemoved !== null || state.recordsExcluded !== null || state.reportsNotRetrieved !== null ||
      state.studiesIncluded !== null || state.reportsOfIncludedStudies !== null;
    if (hasData && !window.confirm("Reset all PRISMA diagram data? This clears every field and cannot be undone.")) return;
    setState(emptyFormState());
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  // --- Databases / registers ------------------------------------------------
  function toggleDatabase(name: string, checked: boolean) {
    setState((s) => ({
      ...s,
      databases: checked
        ? [...s.databases, { id: nextId(), name, count: null }]
        : s.databases.filter((d) => d.name !== name || d.isCustom),
    }));
  }
  function toggleRegister(name: string, checked: boolean) {
    setState((s) => ({
      ...s,
      registers: checked
        ? [...s.registers, { id: nextId(), name, count: null }]
        : s.registers.filter((d) => d.name !== name || d.isCustom),
    }));
  }
  function addCustomEntry(kind: "databases" | "registers") {
    setState((s) => ({ ...s, [kind]: [...s[kind], { id: nextId(), name: "", count: null, isCustom: true }] }));
  }
  function updateEntry(kind: "databases" | "registers", id: string, patch: Partial<CountEntry>) {
    setState((s) => ({ ...s, [kind]: s[kind].map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  }
  function removeEntry(kind: "databases" | "registers", id: string) {
    setState((s) => ({ ...s, [kind]: s[kind].filter((e) => e.id !== id) }));
  }

  // --- Exclusion reasons -------------------------------------------------
  function toggleReason(label: string, checked: boolean) {
    setState((s) => ({
      ...s,
      exclusionReasons: checked
        ? [...s.exclusionReasons, { id: nextId(), label, count: null }]
        : s.exclusionReasons.filter((r) => r.label !== label || r.isCustom),
    }));
  }
  function addCustomReason() {
    setState((s) => ({ ...s, exclusionReasons: [...s.exclusionReasons, { id: nextId(), label: "", count: null, isCustom: true }] }));
  }
  function updateReason(id: string, patch: Partial<ExclusionReasonEntry>) {
    setState((s) => ({ ...s, exclusionReasons: s.exclusionReasons.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  }
  function removeReason(id: string) {
    setState((s) => ({ ...s, exclusionReasons: s.exclusionReasons.filter((r) => r.id !== id) }));
  }

  const databaseTotal = calc.databaseTotal;
  const registerTotal = calc.registerTotal;
  // "Reports" wording when the optional reports/studies duality is on,
  // "Studies" (simplified default) when it's off - mirrors svgBuilder.ts.
  const term = state.distinguishReportsFromStudies ? "Reports" : "Studies";
  const selectedDatabaseNames = new Set(state.databases.filter((d) => !d.isCustom).map((d) => d.name));
  const selectedRegisterNames = new Set(state.registers.filter((d) => !d.isCustom).map((d) => d.name));
  const selectedReasonLabels = new Set(state.exclusionReasons.filter((r) => !r.isCustom).map((r) => r.label));

  async function runExport(fn: () => Promise<void>, key: string) {
    if (hasErrors) return;
    setExportError(null);
    setExporting(key);
    try {
      await fn();
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  }

  const baseFilename = "prisma-2020-flow-diagram";

  return (
    <div className="min-h-screen bg-[#0b0c10] text-white font-sans">
      <NavComp />
      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <FadeIn>
          <div className="flex items-center gap-3 mb-2">
            <Workflow size={26} className="text-indigo-400" />
            <h1 className="text-3xl md:text-4xl font-bold">PRISMA 2020 Flow Diagram Generator</h1>
          </div>
          <p className="text-white/60 max-w-3xl">
            Create a PRISMA 2020 flow diagram from your screening and eligibility data. Enter your database/register
            results and screening numbers — the diagram and calculations update automatically.
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={resetAll}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-white/70 border border-white/15 hover:border-white/30"
            >
              <RotateCcw size={14} /> Reset All
            </button>
            <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm border ${hasErrors ? "text-rose-300 border-rose-500/30 bg-rose-500/10" : "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"}`}>
              <CheckCircle2 size={14} /> {hasErrors ? "Fix errors before exporting" : "Diagram valid"}
            </span>
          </div>
        </FadeIn>

        <div className="grid lg:grid-cols-[minmax(0,420px)_1fr] gap-6 items-start">
          {/* LEFT: input panel */}
          <div className="space-y-5 order-1">
            <Card title="Databases" description="Select every database you searched, then enter records identified from each.">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {PRESET_DATABASES.map((name) => (
                  <Checkbox key={name} label={name} checked={selectedDatabaseNames.has(name)} onChange={(c) => toggleDatabase(name, c)} />
                ))}
              </div>
              <div className="space-y-2 pt-1">
                {state.databases.map((d) => (
                  <CountRow
                    key={d.id}
                    name={d.name}
                    value={d.count}
                    onChange={(v) => updateEntry("databases", d.id, { count: v })}
                    onRemove={() => removeEntry("databases", d.id)}
                    onNameChange={d.isCustom ? (v) => updateEntry("databases", d.id, { name: v }) : undefined}
                  />
                ))}
              </div>
              <button onClick={() => addCustomEntry("databases")} className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-200">
                <Plus size={13} /> Add other database
              </button>
              <TotalLine label="Total records identified from databases" value={databaseTotal} />
            </Card>

            <Card title="Registers" description="Trial and study registers searched (e.g. ClinicalTrials.gov).">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {PRESET_REGISTERS.map((name) => (
                  <Checkbox key={name} label={name} checked={selectedRegisterNames.has(name)} onChange={(c) => toggleRegister(name, c)} />
                ))}
              </div>
              <div className="space-y-2 pt-1">
                {state.registers.map((r) => (
                  <CountRow
                    key={r.id}
                    name={r.name}
                    value={r.count}
                    onChange={(v) => updateEntry("registers", r.id, { count: v })}
                    onRemove={() => removeEntry("registers", r.id)}
                    onNameChange={r.isCustom ? (v) => updateEntry("registers", r.id, { name: v }) : undefined}
                  />
                ))}
              </div>
              <button onClick={() => addCustomEntry("registers")} className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-200">
                <Plus size={13} /> Add other register
              </button>
              <TotalLine label="Total records identified from registers" value={registerTotal} />
              <TotalLine label="Total records identified (databases + registers)" value={calc.totalIdentified} />
            </Card>

            <Card title="Screening" description="Duplicate removal and title/abstract screening.">
              <NumberField id="dup" label="Duplicate records removed" value={state.duplicatesRemoved} onChange={(v) => setState((s) => ({ ...s, duplicatesRemoved: v }))} />
              <TotalLine label="Records screened (auto-calculated)" value={calc.recordsScreened} />
              <NumberField id="recexcl" label="Records excluded" value={state.recordsExcluded} onChange={(v) => setState((s) => ({ ...s, recordsExcluded: v }))} />
              <TotalLine label={`${term} sought for retrieval (auto-calculated)`} value={calc.reportsSought} />
            </Card>

            <Card title={`${term === "Reports" ? "Report" : "Study"} retrieval`} description={`Full-text ${term.toLowerCase()} sought for the studies that passed screening.`}>
              <NumberField id="notretr" label={`${term} not retrieved`} value={state.reportsNotRetrieved} onChange={(v) => setState((s) => ({ ...s, reportsNotRetrieved: v }))} />
              <TotalLine label={`${term} assessed for eligibility (auto-calculated)`} value={calc.reportsAssessed} />
            </Card>

            <Card title="Exclusion reasons" description={`Select every reason ${term.toLowerCase()} were excluded at eligibility, then enter a count for each.`}>
              <div className="grid grid-cols-1 gap-1.5">
                {PRESET_EXCLUSION_REASONS.map((label) => (
                  <Checkbox key={label} label={label} checked={selectedReasonLabels.has(label)} onChange={(c) => toggleReason(label, c)} />
                ))}
              </div>
              <div className="space-y-2 pt-1">
                {state.exclusionReasons.map((r) => (
                  <CountRow
                    key={r.id}
                    name={r.label}
                    value={r.count}
                    onChange={(v) => updateReason(r.id, { count: v })}
                    onRemove={() => removeReason(r.id)}
                    onNameChange={r.isCustom ? (v) => updateReason(r.id, { label: v }) : undefined}
                  />
                ))}
              </div>
              <button onClick={addCustomReason} className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-200">
                <Plus size={13} /> Add other reason
              </button>
              <TotalLine label={`Total ${term.toLowerCase()} excluded (auto-calculated)`} value={calc.totalReportsExcluded} />
            </Card>

            <Card title="Studies included" description="PRISMA optionally distinguishes studies from reports — a study can have multiple linked reports.">
              <NumberField id="studiesincl" label="Studies included in review" value={state.studiesIncluded} onChange={(v) => setState((s) => ({ ...s, studiesIncluded: v }))} />
              <Checkbox
                label="Distinguish reports from studies (PRISMA's optional Reports vs. Studies duality)"
                checked={state.distinguishReportsFromStudies}
                onChange={(v) => setState((s) => ({ ...s, distinguishReportsFromStudies: v }))}
              />
              {state.distinguishReportsFromStudies && (
                <NumberField id="reportsincl" label="Reports of included studies" value={state.reportsOfIncludedStudies} onChange={(v) => setState((s) => ({ ...s, reportsOfIncludedStudies: v }))} />
              )}
            </Card>

            <Card title="Validation">
              {messages.length === 0 ? (
                <p className="text-sm text-white/40">No issues detected.</p>
              ) : (
                <ValidationList messages={messages} />
              )}
            </Card>
          </div>

          {/* RIGHT: live diagram preview + export */}
          <div className="space-y-4 order-2 lg:sticky lg:top-6">
            <Card title="Live preview" description="Updates automatically as you edit the form. Export contains only this figure.">
              <div ref={previewRef} className="w-full overflow-x-auto bg-white rounded-lg border border-black/10 p-2">
                {/* svg is generated entirely by our own trusted builder, never from user HTML */}
                <div dangerouslySetInnerHTML={{ __html: svg }} />
              </div>
            </Card>

            <Card title="Export">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-white/60">Resolution:</span>
                <label className="flex items-center gap-1.5"><input type="radio" checked={exportResolution === "standard"} onChange={() => setExportResolution("standard")} /> Standard</label>
                <label className="flex items-center gap-1.5"><input type="radio" checked={exportResolution === "high"} onChange={() => setExportResolution("high")} /> High-resolution (publication)</label>
              </div>
              {hasErrors && <p className="text-xs text-rose-300">Resolve every error above before exporting.</p>}
              {exportError && <p className="text-xs text-rose-300">{exportError}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <ExportButton
                  label="PNG" busy={exporting === "png"} disabled={hasErrors}
                  onClick={() => runExport(() => downloadPng(svg, width, height, `${baseFilename}.png`, exportResolution), "png")}
                />
                <ExportButton
                  label="JPEG" busy={exporting === "jpeg"} disabled={hasErrors}
                  onClick={() => runExport(() => downloadJpeg(svg, width, height, `${baseFilename}.jpg`, exportResolution), "jpeg")}
                />
                <ExportButton
                  label="SVG" busy={exporting === "svg"} disabled={hasErrors}
                  onClick={() => runExport(async () => downloadSvg(svg, `${baseFilename}.svg`), "svg")}
                />
                <ExportButton
                  label="PDF" busy={exporting === "pdf"} disabled={hasErrors}
                  onClick={() => runExport(() => downloadPdf(svg, width, height, `${baseFilename}.pdf`), "pdf")}
                />
              </div>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function ExportButton({ label, onClick, busy, disabled }: { label: string; onClick: () => void; busy: boolean; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ backgroundImage: "var(--gradient-primary, linear-gradient(135deg,#6366f1,#8b5cf6))" }}
    >
      <Download size={14} /> {busy ? "Exporting…" : label}
    </button>
  );
}
