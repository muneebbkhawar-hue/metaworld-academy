"use client";

// AI-Assisted Risk of Bias Assessment - orchestrator page.
//
// Pipeline: PDF -> POST /api/rob/assess (server-side: Gemini evidence
// extraction, then this app's OWN deterministic decision engine computes
// every domain/overall judgment - see app/lib/rob/*.ts) -> results held in
// this page's React state only (nothing persisted server-side) -> optional
// human overrides edited in StudyDetail -> robvis plots via rob-api.R.
//
// COST-EFFICIENCY NOTE: study-design classification and framework
// compatibility are determined in the SAME Gemini call as evidence
// extraction (one request per study, not a separate classification pass
// followed by a second assessment pass), per the brief's explicit
// instruction to minimize API calls/token usage on a free-tier quota.
// Incompatible studies are never assessed regardless - the compatibility
// gate (compatibilityGate.ts) runs before any domain judgment is trusted or
// displayed, and rejected studies are always shown separately, never
// silently folded into the results table.
import { useMemo, useState } from "react";
import { AlertTriangle, FileWarning, Loader2, ShieldCheck, Stethoscope, UploadCloud } from "lucide-react";
import NavComp from "@/app/components/Nav";
import Footer from "@/app/components/Footer";
import FadeIn from "@/app/components/FadeIn";
import type { Framework, StudyAssessment, StudyResult } from "@/app/lib/rob/types";
import { downloadCSVFile, downloadXLSXFile } from "@/app/lib/exportUtils";
import { statusFromResult, type UploadItem } from "./lib/types";
import ResultsTable from "./components/ResultsTable";
import StudyDetail from "./components/StudyDetail";
import PlotPanel from "./components/PlotPanel";
import MethodologyPanel from "./components/MethodologyPanel";

const FRAMEWORKS: { key: Framework; title: string; blurb: string; icon: typeof ShieldCheck }[] = [
  { key: "RoB2", title: "RoB 2", blurb: "Randomized, cluster-randomized, and crossover trials.", icon: ShieldCheck },
  { key: "ROBINS-I", title: "ROBINS-I", blurb: "Non-randomized studies of interventions (cohort, case-control).", icon: FileWarning },
  { key: "QUADAS-2", title: "QUADAS-2", blurb: "Diagnostic accuracy studies.", icon: Stethoscope },
];

const STATUS_ORDER = ["Waiting", "Classifying", "Checking compatibility", "Extracting evidence", "Assessing", "Completed", "Needs review", "Rejected", "Failed"];

export default function RiskOfBiasPage() {
  const [framework, setFramework] = useState<Framework | null>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(null);

  const completedAssessments = useMemo(
    () => items.map((i) => i.result).filter((r): r is Extract<StudyResult, { status: "completed" | "needs_review" }> => !!r && (r.status === "completed" || r.status === "needs_review")).map((r) => r.assessment),
    [items]
  );
  const rejectedOrFailed = useMemo(
    () => items.filter((i) => i.status === "Rejected" || i.status === "Failed"),
    [items]
  );

  function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    const used = new Set(items.map((i) => i.studyId));
    const newItems: UploadItem[] = files.map((file) => {
      const base = file.name.replace(/\.pdf$/i, "").slice(0, 40) || "study";
      let id = base, n = 1;
      while (used.has(id)) id = `${base}-${++n}`;
      used.add(id);
      return { key: crypto.randomUUID(), file, studyId: id, status: "Waiting", result: null };
    });
    setItems((prev) => [...prev, ...newItems]);
  }

  function updateStudyId(key: string, studyId: string) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, studyId } : i)));
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  async function runAssessment() {
    if (!framework || items.length === 0) return;
    setSubmitting(true);
    setBatchError(null);
    setItems((prev) => prev.map((i) => ({ ...i, status: "Extracting evidence" })));

    try {
      const form = new FormData();
      form.set("framework", framework);
      for (const item of items) form.append("files", item.file, item.file.name);

      const res = await fetch("/api/rob/assess", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || data.status !== "success") throw new Error(data.message || "The assessment request failed.");

      const results: StudyResult[] = data.results;
      setItems((prev) =>
        prev.map((item, i) => {
          const result = results[i];
          if (!result) return { ...item, status: "Failed", result: { study_id: item.studyId, filename: item.file.name, status: "failed", reason: "No result returned for this file." } };
          const status = statusFromResult(result);
          const withStudyId: StudyResult = "assessment" in result ? { ...result, assessment: { ...result.assessment, study_id: item.studyId } } : { ...result, study_id: item.studyId };
          return { ...item, status, result: withStudyId };
        })
      );
    } catch (err) {
      console.error("[risk-of-bias] batch assessment failed:", err);
      setBatchError(err instanceof Error ? err.message : "The assessment service is currently unavailable. Please try again.");
      setItems((prev) => prev.map((i) => (i.status === "Extracting evidence" ? { ...i, status: "Failed" } : i)));
    } finally {
      setSubmitting(false);
    }
  }

  function updateAssessment(updated: StudyAssessment) {
    setItems((prev) =>
      prev.map((item) => {
        if (!item.result || !("assessment" in item.result) || item.result.assessment.study_id !== updated.study_id) return item;
        return { ...item, result: { ...item.result, assessment: updated } };
      })
    );
  }

  function exportTable() {
    if (completedAssessments.length === 0) return;
    const domainKeys = completedAssessments[0].domains.map((d) => d.domain_key);
    const header = ["Study ID", ...domainKeys, "Overall", "Review status"];
    const rows = completedAssessments.map((a) => [
      a.study_id,
      ...domainKeys.map((k) => a.domains.find((d) => d.domain_key === k)?.human_judgment ?? ""),
      a.human_overall,
      a.human_review_required ? "Needs review" : "Reviewed",
    ]);
    downloadCSVFile(`${framework}-assessment.csv`, header, rows);
    downloadXLSXFile(`${framework}-assessment.xlsx`, "Assessment", header, rows);
  }

  function exportEvidence() {
    if (completedAssessments.length === 0) return;
    const header = ["Study", "Domain", "Question", "Answer", "Judgment", "Evidence", "Page", "Section", "Confidence", "Human review"];
    const rows: (string | number)[][] = [];
    for (const a of completedAssessments) {
      for (const d of a.domains) {
        for (const q of d.questions) {
          rows.push([a.study_id, d.domain_key, q.question_id, q.answer, d.human_judgment, q.supporting_text ?? "", q.page ?? "", q.section ?? "", Math.round(q.confidence * 100), q.needs_review ? "Yes" : "No"]);
        }
      }
    }
    downloadCSVFile(`${framework}-evidence.csv`, header, rows);
    downloadXLSXFile(`${framework}-evidence.xlsx`, "Evidence", header, rows);
  }

  const selectedAssessment = selectedStudyId ? completedAssessments.find((a) => a.study_id === selectedStudyId) ?? null : null;

  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)] font-sans">
      <NavComp />
      <main className="max-w-6xl mx-auto px-6 py-16 space-y-12">
        <FadeIn>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Risk of Bias Assessment</h1>
          <p className="text-[var(--text-secondary)] max-w-2xl">
            AI-assisted evidence extraction and structured risk-of-bias assessment for randomized, non-randomized, and
            diagnostic studies.
          </p>
        </FadeIn>

        <FadeIn delay={0.05}>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200 flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <span>AI-assisted assessment. Review all extracted evidence and final judgments against the original publication before using the assessment in a systematic review or manuscript.</span>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <h2 className="text-lg font-semibold mb-4">1. Select an assessment framework</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {FRAMEWORKS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFramework(f.key)}
                aria-pressed={framework === f.key}
                className={`text-left rounded-2xl border p-6 transition-all ${framework === f.key ? "border-[var(--border-hover)] bg-[var(--bg-surface-2)]" : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]"}`}
              >
                <f.icon size={22} className="text-[var(--purple-bright)] mb-3" />
                <h3 className="font-bold text-[var(--text-primary)] mb-1">{f.title}</h3>
                <p className="text-sm text-[var(--text-secondary)]">{f.blurb}</p>
              </button>
            ))}
          </div>
        </FadeIn>

        {framework && (
          <FadeIn delay={0.15}>
            <h2 className="text-lg font-semibold mb-4">2. Upload studies</h2>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
              className="rounded-2xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10 text-center"
            >
              <UploadCloud size={28} className="mx-auto text-[var(--text-tertiary)] mb-3" />
              <p className="text-[var(--text-secondary)] mb-3">Drag &amp; drop PDF files here</p>
              <label className="inline-block px-4 py-2 rounded-lg text-white font-medium cursor-pointer" style={{ backgroundImage: "var(--gradient-primary)" }}>
                Choose PDF files
                <input type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
              </label>
            </div>

            {items.length > 0 && (
              <div className="mt-6 space-y-2">
                {items.map((item) => (
                  <div key={item.key} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-sm">
                    <input
                      value={item.studyId}
                      onChange={(e) => updateStudyId(item.key, e.target.value)}
                      className="w-36 bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg px-2 py-1 text-[var(--text-primary)]"
                      aria-label={`Study ID for ${item.file.name}`}
                    />
                    <span className="text-[var(--text-tertiary)] truncate flex-1 min-w-[120px]">{item.file.name}</span>
                    <span className="text-[var(--text-tertiary)] text-xs">{(item.file.size / 1024).toFixed(0)} KB</span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-md ${STATUS_ORDER.slice(5).includes(item.status) ? "bg-[var(--bg-surface-2)]" : "bg-[var(--purple-primary)]/15 text-[var(--purple-bright)]"}`}>
                      {item.status}
                    </span>
                    {item.result && "reason" in item.result && (
                      <span className="text-xs text-rose-300 basis-full">{item.result.reason}</span>
                    )}
                    {!submitting && (
                      <button onClick={() => removeItem(item.key)} className="text-xs text-[var(--text-tertiary)] hover:text-rose-300">Remove</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {items.length > 0 && (
              <button
                onClick={runAssessment}
                disabled={submitting}
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-semibold disabled:opacity-60"
                style={{ backgroundImage: "var(--gradient-primary)" }}
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                {submitting ? "Processing…" : `Assess ${items.length} ${items.length === 1 ? "study" : "studies"}`}
              </button>
            )}
            {batchError && <p className="mt-3 text-sm text-rose-300">{batchError}</p>}
          </FadeIn>
        )}

        {(completedAssessments.length > 0 || rejectedOrFailed.length > 0) && (
          <FadeIn delay={0.2}>
            <h2 className="text-lg font-semibold mb-4">3. Results</h2>

            {rejectedOrFailed.length > 0 && (
              <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-200 space-y-2">
                <p className="font-medium">{rejectedOrFailed.length} {rejectedOrFailed.length === 1 ? "study was" : "studies were"} not assessed.</p>
                {rejectedOrFailed.map((i) => (
                  <p key={i.key} className="text-rose-300/90">
                    <strong>{i.studyId}</strong> ({i.status}): {i.result && "reason" in i.result ? i.result.reason : "Unknown error."}
                  </p>
                ))}
              </div>
            )}

            {completedAssessments.length > 0 && (
              <>
                <div className="flex flex-wrap gap-3 mb-4">
                  <button onClick={exportTable} className="text-sm font-medium text-[var(--purple-bright)] hover:underline">Download assessment (CSV/XLSX)</button>
                  <button onClick={exportEvidence} className="text-sm font-medium text-[var(--purple-bright)] hover:underline">Download evidence &amp; rationale (CSV/XLSX)</button>
                </div>
                <ResultsTable assessments={completedAssessments} onSelect={setSelectedStudyId} />
                <div className="mt-8"><PlotPanel assessments={completedAssessments} /></div>
              </>
            )}
          </FadeIn>
        )}

        <FadeIn delay={0.25}><MethodologyPanel /></FadeIn>
      </main>
      <Footer />

      {selectedAssessment && (
        <StudyDetail assessment={selectedAssessment} onChange={updateAssessment} onClose={() => setSelectedStudyId(null)} />
      )}
    </div>
  );
}
