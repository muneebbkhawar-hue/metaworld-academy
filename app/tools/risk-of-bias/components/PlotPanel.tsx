"use client";

// Traffic-light and summary plots - generated ENTIRELY by the R backend
// (rob-api.R, using the robvis package's rob_traffic_light()/rob_summary()
// functions) from the exact same canonical assessment data shown in
// ResultsTable/StudyDetail. This component never draws anything itself -
// it only requests an image from the backend and displays whatever comes
// back, per this task's explicit requirement that the visualization layer
// be a real R/robvis output, not a React/HTML/CSS/canvas recreation.
import { useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { StudyAssessment } from "@/app/lib/rob/types";
import { apiClient, BACKEND_UNAVAILABLE_MESSAGE } from "@/app/lib/apiClient";

type Source = "ai" | "final";
type PlotKind = "traffic-light-plot" | "summary-plot";
type FormatFiles = Partial<Record<"png" | "jpg" | "pdf" | "svg", string>>;

function toStudyPayload(a: StudyAssessment, source: Source) {
  const domains: Record<string, string> = {};
  for (const d of a.domains) domains[d.domain_key] = source === "ai" ? d.ai_judgment : d.human_judgment;
  return { study_id: a.study_id, domains, domains_overall: source === "ai" ? a.ai_overall : a.human_overall };
}

function downloadDataUri(dataUri: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUri;
  link.download = filename;
  link.click();
}

const FORMAT_LABELS: Record<string, string> = { png: "PNG", jpg: "JPG", pdf: "PDF", svg: "SVG" };

function DownloadRow({ files, baseName }: { files: FormatFiles; baseName: string }) {
  const available = (Object.keys(FORMAT_LABELS) as (keyof FormatFiles)[]).filter((f) => files[f]);
  if (available.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {available.map((fmt) => (
        <button
          key={fmt}
          onClick={() => downloadDataUri(files[fmt] as string, `${baseName}.${fmt}`)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--purple-bright)] hover:underline"
        >
          <Download size={14} /> Download {FORMAT_LABELS[fmt]}
        </button>
      ))}
    </div>
  );
}

function PlotBlock({
  title, kind, assessments, source,
}: {
  title: string;
  kind: PlotKind;
  assessments: StudyAssessment[];
  source: Source;
}) {
  const [files, setFiles] = useState<FormatFiles | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const framework = assessments[0]?.framework;

  const studiesKey = useMemo(() => JSON.stringify(assessments.map((a) => toStudyPayload(a, source))), [assessments, source]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      setFiles(null);
      try {
        const studies = assessments.map((a) => toStudyPayload(a, source));
        const res = await apiClient.rob.post<{ status: string; files?: FormatFiles; message?: string }>(`/api/rob/${kind}`, { framework, studies });
        if (cancelled) return;
        if (res.status !== "success" || !res.files) throw new Error(res.message || "Plot generation failed.");
        setFiles(res.files);
      } catch (err) {
        if (cancelled) return;
        console.error(`[risk-of-bias] ${kind} generation failed:`, err);
        setError(err instanceof Error ? err.message : BACKEND_UNAVAILABLE_MESSAGE);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studiesKey, kind, framework]);

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-4">
      <h3 className="text-[var(--text-primary)] font-semibold">{title}</h3>
      {loading && (
        <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)] py-8 justify-center">
          <Loader2 size={16} className="animate-spin" /> Generating plot…
        </div>
      )}
      {!loading && error && <p className="text-sm text-rose-300">{error}</p>}
      {!loading && files && (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={files.png ?? files.jpg} alt={`${framework} ${title}`} className="max-w-full rounded-lg border border-[var(--border-subtle)] bg-white" />
          <DownloadRow files={files} baseName={`${framework}-${kind}-${source}`} />
        </div>
      )}
    </div>
  );
}

export default function PlotPanel({ assessments }: { assessments: StudyAssessment[] }) {
  const [source, setSource] = useState<Source>("final");
  if (assessments.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm">
        <span className="text-[var(--text-tertiary)]">Plot source:</span>
        <select value={source} onChange={(e) => setSource(e.target.value as Source)} className="bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-[var(--text-primary)]">
          <option value="final">Final reviewed assessment</option>
          <option value="ai">AI assessment</option>
        </select>
      </div>
      <PlotBlock title="Traffic Light Plot" kind="traffic-light-plot" assessments={assessments} source={source} />
      <PlotBlock title="Risk of Bias Summary" kind="summary-plot" assessments={assessments} source={source} />
      {assessments[0]?.framework === "QUADAS-2" && (
        <p className="text-xs text-[var(--text-tertiary)]">
          Applicability concerns are not available as a plot (the installed robvis version has no separate applicability
          template for QUADAS-2) - they remain visible in the assessment table above.
        </p>
      )}
    </div>
  );
}
