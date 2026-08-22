"use client";

// Meta-Analysis Data Extraction - orchestrator page.
//
// Pipeline: PDF -> POST /api/extraction/process-study (ONE study per
// request - server-side: Gemini structured extraction, then this app's OWN
// deterministic post-processing: evidence verification against the PDF's
// real text, unit conversion, log-effect/SE derivation) -> results held in
// this page's React state, mirrored to localStorage for resumability ->
// cross-study harmonization (deterministic, client-side, instant) ->
// review dashboard -> export.
//
// RESUMABILITY MODEL (see DOCS.md): this app has no server-side job store
// anywhere. Each study is processed via its own independent, retryable
// request, and completed results are mirrored to localStorage keyed by a
// job ID, so a page refresh does not lose already-completed studies.
// Uploaded File objects cannot be serialized, so only pending/failed
// studies need to be re-selected after a refresh.
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import NavComp from "@/app/components/Nav";
import Footer from "@/app/components/Footer";
import FadeIn from "@/app/components/FadeIn";
import type { StudyExtraction, StudyProcessResult } from "@/app/lib/extraction/types";
import { buildVariableDictionary } from "@/app/lib/extraction/harmonization";
import { detectSameStudyConflicts } from "@/app/lib/extraction/conflictDetection";
import type { UploadItem, ProjectConfig, PersistedJob } from "./lib/types";
import { hashFile } from "./lib/types";
import ProjectSetupForm from "./components/ProjectSetupForm";
import UploadPanel from "./components/UploadPanel";
import BatchProgress from "./components/BatchProgress";
import VariableFrequencyReport from "./components/VariableFrequencyReport";
import ExtractionTables, { type TableKind } from "./components/ExtractionTables";
import EvidenceModal, { type EvidenceModalData } from "./components/EvidenceModal";
import WarningsPanel from "./components/WarningsPanel";
import ExportBar from "./components/ExportBar";

// Studies are sent to Gemini ONE AT A TIME (the queue loop below is a plain
// sequential for-loop, not a worker pool) - a free-tier quota cannot absorb
// parallel requests, and the loop relies on seeing each study's outcome (in
// particular a RATE_LIMITED/QUOTA_EXHAUSTED result) before deciding whether
// to continue to the next study at all.
//
// A small pacing gap between successive Gemini calls, even though they're
// already sequential - gives a very restrictive free-tier per-minute quota
// some breathing room instead of firing the next request the instant the
// previous one's response lands.
const INTER_STUDY_DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const TABS: { key: TableKind | "variables" | "warnings"; label: string }[] = [
  { key: "variables", label: "Variable frequency" },
  { key: "study-characteristics", label: "Study characteristics" },
  { key: "baseline", label: "Baseline characteristics" },
  { key: "dichotomous", label: "Dichotomous outcomes" },
  { key: "continuous", label: "Continuous outcomes" },
  { key: "generic-iv", label: "Generic IV outcomes" },
  { key: "warnings", label: "Warnings & conflicts" },
];

function storageKey(jobId: string) {
  return `metaworld-data-extraction-job-${jobId}`;
}

export default function DataExtractionPage() {
  const [config, setConfig] = useState<ProjectConfig>({ projectName: "", experimentalGroup: "", controlGroup: "", reviewId: "", outcomeType: "Let AI detect" });
  const [items, setItems] = useState<UploadItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number | null>(50);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("variables");
  const [evidenceModal, setEvidenceModal] = useState<EvidenceModalData | null>(null);
  const [resumeBanner, setResumeBanner] = useState<PersistedJob | null>(null);
  const [queuePaused, setQueuePaused] = useState(false);
  const [pauseReason, setPauseReason] = useState<string | null>(null);
  const pauseRequestedRef = useRef(false); // voluntary "Pause Queue" click, checked between studies

  // react-hooks/set-state-in-effect: intentional exception. This effect
  // reads an external store (localStorage) exactly once on mount to offer
  // resuming a previous session - there is no way to know whether a
  // resumable job exists without reading it, and this is a one-time
  // mount-only check, not a reactive derived-state pattern.
  useEffect(() => {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith("metaworld-data-extraction-job-")) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed: PersistedJob = JSON.parse(raw);
            if (parsed.results.length > 0) {
              // eslint-disable-next-line react-hooks/set-state-in-effect
              setResumeBanner(parsed);
              break;
            }
          }
        }
      }
    } catch {
      // localStorage unavailable (private browsing etc.) - resumability simply won't be offered.
    }
  }, []);

  function persist(newJobId: string, newItems: UploadItem[]) {
    try {
      const persisted: PersistedJob = {
        jobId: newJobId,
        project: config,
        savedAt: new Date().toISOString(),
        results: newItems.filter((i) => i.result && (i.status === "COMPLETE" || i.status === "NEEDS_REVIEW")).map((i) => ({ studyId: i.studyId, filename: i.file.name, result: i.result!, attempts: i.attempts })),
      };
      localStorage.setItem(storageKey(newJobId), JSON.stringify(persisted));
    } catch {
      // Best-effort only - resumability is a convenience, not a guarantee.
    }
  }

  function resumeSession() {
    if (!resumeBanner) return;
    setConfig(resumeBanner.project);
    setJobId(resumeBanner.jobId);
    setItems(resumeBanner.results.map((r) => ({
      key: crypto.randomUUID(), file: new File([], r.filename), studyId: r.studyId, fileHash: "",
      status: r.result.status === "failed" ? "FAILED" : r.result.status === "needs_review" ? "NEEDS_REVIEW" : "COMPLETE",
      result: r.result, error: null, attempts: r.attempts,
    })));
    setResumeBanner(null);
  }

  async function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    const used = new Set(items.map((i) => i.studyId));
    const hashes = await Promise.all(files.map((f) => hashFile(f)));
    const existingHashes = new Set(items.map((i) => i.fileHash));
    const newItems: UploadItem[] = [];
    files.forEach((file, idx) => {
      const hash = hashes[idx];
      if (existingHashes.has(hash)) return; // duplicate detection - silently skip an exact re-upload
      existingHashes.add(hash);
      const base = file.name.replace(/\.pdf$/i, "").slice(0, 40) || "study";
      let id = base, n = 1;
      while (used.has(id)) id = `${base}-${++n}`;
      used.add(id);
      newItems.push({ key: crypto.randomUUID(), file, studyId: id, fileHash: hash, status: "QUEUED", result: null, error: null, attempts: 0 });
    });
    setItems((prev) => [...prev, ...newItems]);
  }

  function updateStudyId(key: string, studyId: string) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, studyId } : i)));
  }
  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }
  function clearAll() {
    setItems([]);
    setQueuePaused(false);
    setPauseReason(null);
  }

  async function processOne(item: UploadItem): Promise<UploadItem> {
    if (item.file.size === 0) return item; // resumed placeholder file (no real PDF bytes) - already processed
    const attempts = item.attempts + 1;
    try {
      const form = new FormData();
      form.set("file", item.file, item.file.name);
      form.set("studyId", item.studyId);
      form.set("experimentalGroup", config.experimentalGroup);
      form.set("controlGroup", config.controlGroup);
      form.set("outcomeTypeHint", config.outcomeType);

      const res = await fetch("/api/extraction/process-study", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || data.status !== "success") throw new Error(data.message || "The extraction request failed.");

      const result: StudyProcessResult = data.result;
      const isRateOrQuota = result.status === "failed" && (result.errorCode === "RATE_LIMITED" || result.errorCode === "QUOTA_EXHAUSTED");
      const status = isRateOrQuota ? "RATE_LIMITED" : result.status === "failed" ? "FAILED" : result.status === "needs_review" ? "NEEDS_REVIEW" : "COMPLETE";
      return { ...item, status, result, error: null, attempts };
    } catch (err) {
      const message = err instanceof Error ? err.message : "The extraction service is currently unavailable.";
      return { ...item, status: "FAILED", result: { study_id: item.studyId, filename: item.file.name, status: "failed", reason: message, errorCode: "UNKNOWN" }, error: message, attempts };
    }
  }

  // Sequential queue: processes one study, waits for its terminal state,
  // THEN decides whether to continue. A RATE_LIMITED/QUOTA_EXHAUSTED result
  // pauses the whole queue immediately rather than plowing through every
  // remaining study's own retries for nothing - completed studies are never
  // touched again. A voluntary Pause Queue click is honored the same way,
  // between studies (never mid-request).
  async function runExtraction() {
    if (items.length === 0 || !config.experimentalGroup || !config.controlGroup) return;
    setSubmitting(true);
    setQueuePaused(false);
    setPauseReason(null);
    pauseRequestedRef.current = false;
    const activeJobId = jobId ?? crypto.randomUUID();
    setJobId(activeJobId);

    const toProcess = items.filter((i) => i.status === "QUEUED" || i.status === "RATE_LIMITED");
    let pausedThisRun = false;

    for (let idx = 0; idx < toProcess.length; idx++) {
      if (pauseRequestedRef.current) break;

      const current = toProcess[idx];
      setItems((prev) => prev.map((i) => (i.key === current.key ? { ...i, status: "PROCESSING" } : i)));
      const updated = await processOne(current);

      setItems((prev) => {
        const next = prev.map((i) => (i.key === updated.key ? updated : i));
        persist(activeJobId, next);
        return next;
      });

      if (updated.status === "RATE_LIMITED") {
        const reason = updated.result && "reason" in updated.result ? updated.result.reason : "The Gemini API has rate-limited or exhausted its quota.";
        setPauseReason(reason);
        setQueuePaused(true);
        pausedThisRun = true;
        break;
      }

      if (idx < toProcess.length - 1 && !pauseRequestedRef.current) await sleep(INTER_STUDY_DELAY_MS);
    }

    if (!pausedThisRun) setQueuePaused(false);
    setSubmitting(false);
  }

  function pauseQueue() {
    pauseRequestedRef.current = true;
  }

  function cancelRemaining() {
    setItems((prev) => prev.map((i) => (i.status === "QUEUED" ? { ...i, status: "CANCELLED" } : i)));
  }

  function retryOne(key: string) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, status: "QUEUED", result: null, error: null } : i)));
    setQueuePaused(false);
  }

  const completedExtractions: StudyExtraction[] = useMemo(
    () => items.map((i) => i.result).filter((r): r is Extract<StudyProcessResult, { status: "completed" | "needs_review" }> => !!r && "extraction" in r).map((r) => r.extraction),
    [items]
  );
  const failedItems = useMemo(() => items.filter((i) => i.status === "FAILED"), [items]);

  const dictionary = useMemo(() => buildVariableDictionary(completedExtractions, threshold), [completedExtractions, threshold]);
  const conflicts = useMemo(() => completedExtractions.flatMap(detectSameStudyConflicts), [completedExtractions]);

  const canStart = config.experimentalGroup.trim() !== "" && config.controlGroup.trim() !== "" && items.length > 0;

  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)] font-sans">
      <NavComp />
      <main className="max-w-6xl mx-auto px-6 py-16 space-y-12">
        <FadeIn>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Meta-Analysis Data Extraction</h1>
          <p className="text-[var(--text-secondary)] max-w-2xl">
            Extract, harmonize and organize study characteristics, baseline variables and clinical outcome data from included studies.
          </p>
        </FadeIn>

        <FadeIn delay={0.03}>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200 flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <span>AI-assisted extraction requires researcher verification before use in publication. Review every evidence quote and flagged item against the original PDF.</span>
          </div>
        </FadeIn>

        {resumeBanner && (
          <FadeIn delay={0.04}>
            <div className="rounded-xl border border-[var(--border-hover)] bg-[var(--bg-surface)] px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3">
              <span className="text-[var(--text-secondary)]">
                A previous session (&quot;{resumeBanner.project.projectName || "Untitled project"}&quot;, {resumeBanner.results.length} studies) was found saved in this browser.
              </span>
              <div className="flex gap-2">
                <button onClick={resumeSession} className="text-sm font-medium text-[var(--purple-bright)] hover:underline">Resume</button>
                <button onClick={() => setResumeBanner(null)} className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">Dismiss</button>
              </div>
            </div>
          </FadeIn>
        )}

        <FadeIn delay={0.06}>
          <h2 className="text-lg font-semibold mb-4">1. Project setup</h2>
          <ProjectSetupForm config={config} onChange={setConfig} locked={submitting} />
        </FadeIn>

        <FadeIn delay={0.1}>
          <h2 className="text-lg font-semibold mb-4">2. Upload included studies</h2>
          <UploadPanel items={items} onAddFiles={addFiles} onRemove={removeItem} onClearAll={clearAll} onUpdateStudyId={updateStudyId} onRetry={retryOne} submitting={submitting} />
          <button
            onClick={runExtraction}
            disabled={!canStart || submitting}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-semibold disabled:opacity-60"
            style={{ backgroundImage: "var(--gradient-primary)" }}
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? "Extracting study-level data…" : "Start Extraction"}
          </button>
          {!canStart && items.length > 0 && <p className="mt-2 text-xs text-[var(--text-tertiary)]">Enter an experimental and control group name to begin.</p>}
        </FadeIn>

        <FadeIn delay={0.11}>
          <BatchProgress
            items={items}
            queuePaused={queuePaused}
            pauseReason={pauseReason}
            onResume={runExtraction}
            onPauseQueue={pauseQueue}
            onCancelRemaining={cancelRemaining}
            submitting={submitting}
          />
        </FadeIn>

        {failedItems.length > 0 && !submitting && (
          <FadeIn delay={0.12}>
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-200">
              <p className="font-medium mb-1">{failedItems.length} {failedItems.length === 1 ? "study" : "studies"} failed to process.</p>
              <p className="text-rose-300/90 text-xs">A failed study never removes already-completed studies from your results. Use Retry above to try again.</p>
            </div>
          </FadeIn>
        )}

        {completedExtractions.length > 0 && (
          <FadeIn delay={0.15}>
            <h2 className="text-lg font-semibold mb-4">3. Review</h2>
            <div className="flex flex-wrap gap-2 mb-6 border-b border-[var(--border-subtle)] pb-3">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  aria-pressed={tab === t.key}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? "text-white" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                  style={tab === t.key ? { backgroundImage: "var(--gradient-primary)" } : undefined}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "variables" && (
              <VariableFrequencyReport studyCharacteristics={dictionary.studyCharacteristics} baselineCharacteristics={dictionary.baselineCharacteristics} threshold={threshold} onThresholdChange={setThreshold} />
            )}
            {(tab === "study-characteristics" || tab === "baseline" || tab === "dichotomous" || tab === "continuous" || tab === "generic-iv") && (
              <ExtractionTables kind={tab} studies={completedExtractions} onViewEvidence={setEvidenceModal} />
            )}
            {tab === "warnings" && <WarningsPanel studies={completedExtractions} conflicts={conflicts} crossStudyWarnings={dictionary.warnings} />}

            <div className="mt-8">
              <h3 className="text-sm font-semibold mb-3">4. Export</h3>
              <ExportBar
                projectName={config.projectName}
                studies={completedExtractions}
                variables={{ studyCharacteristics: dictionary.studyCharacteristics, baselineCharacteristics: dictionary.baselineCharacteristics }}
                conflicts={conflicts}
                crossStudyWarnings={dictionary.warnings}
                totalStudies={items.length}
              />
            </div>
          </FadeIn>
        )}

        <FadeIn delay={0.2}>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-secondary)] space-y-2">
            <h3 className="font-semibold text-[var(--text-primary)]">About this tool</h3>
            <p>Each PDF is processed independently by Gemini, with every extracted value carrying a page/quote citation. Evidence quotes are then automatically re-checked against the PDF&apos;s own extracted text - a quote that cannot be located is flagged, never silently trusted. Cross-study variable harmonization and unit conversion are deterministic (non-AI) steps for full reviewability. See the tool&apos;s DOCS.md for the complete architecture and known limitations.</p>
          </div>
        </FadeIn>
      </main>
      <Footer />
      {evidenceModal && <EvidenceModal data={evidenceModal} onClose={() => setEvidenceModal(null)} />}
    </div>
  );
}
