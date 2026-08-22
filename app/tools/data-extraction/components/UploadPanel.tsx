"use client";

import { AlertCircle, CheckCircle2, Loader2, RotateCcw, UploadCloud, X } from "lucide-react";
import type { UploadItem } from "../lib/types";

const STATUS_STYLE: Record<UploadItem["status"], { label: string; className: string }> = {
  QUEUED: { label: "Waiting", className: "bg-[var(--bg-surface-2)] text-[var(--text-tertiary)]" },
  UPLOADING: { label: "Uploading", className: "bg-[var(--purple-primary)]/15 text-[var(--purple-bright)]" },
  PROCESSING: { label: "Processing", className: "bg-[var(--purple-primary)]/15 text-[var(--purple-bright)]" },
  VERIFYING: { label: "Verifying", className: "bg-[var(--purple-primary)]/15 text-[var(--purple-bright)]" },
  RETRYING: { label: "Retrying", className: "bg-amber-500/15 text-amber-300" },
  COMPLETE: { label: "Complete", className: "bg-emerald-500/15 text-emerald-300" },
  NEEDS_REVIEW: { label: "Needs review", className: "bg-amber-500/15 text-amber-300" },
  FAILED: { label: "Failed", className: "bg-rose-500/15 text-rose-300" },
  RATE_LIMITED: { label: "Quota paused", className: "bg-amber-500/15 text-amber-300" },
  CANCELLED: { label: "Cancelled", className: "bg-[var(--bg-surface-2)] text-[var(--text-tertiary)]" },
};

const BUSY: UploadItem["status"][] = ["UPLOADING", "PROCESSING", "VERIFYING", "RETRYING"];

export default function UploadPanel({
  items, onAddFiles, onRemove, onClearAll, onUpdateStudyId, onRetry, submitting,
}: {
  items: UploadItem[];
  onAddFiles: (files: FileList | File[]) => void;
  onRemove: (key: string) => void;
  onClearAll: () => void;
  onUpdateStudyId: (key: string, studyId: string) => void;
  onRetry: (key: string) => void;
  submitting: boolean;
}) {
  return (
    <div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onAddFiles(e.dataTransfer.files); }}
        className="rounded-2xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10 text-center"
      >
        <UploadCloud size={28} className="mx-auto text-[var(--text-tertiary)] mb-3" aria-hidden="true" />
        <p className="text-[var(--text-secondary)] mb-3">Drag &amp; drop included-study PDFs here</p>
        <label className="inline-block px-4 py-2 rounded-lg text-white font-medium cursor-pointer" style={{ backgroundImage: "var(--gradient-primary)" }}>
          Choose PDF files
          <input type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => e.target.files && onAddFiles(e.target.files)} />
        </label>
      </div>

      {items.length > 0 && (
        <div className="mt-6 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-[var(--text-tertiary)]">{items.length} {items.length === 1 ? "study" : "studies"} queued</span>
            {!submitting && <button onClick={onClearAll} className="text-xs text-[var(--text-tertiary)] hover:text-rose-300">Clear all</button>}
          </div>
          {items.map((item, i) => {
            const style = STATUS_STYLE[item.status];
            const failedReason = item.result && "reason" in item.result ? item.result.reason : item.error;
            return (
              <div key={item.key} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-sm">
                <span className="text-xs text-[var(--text-tertiary)] w-6">{i + 1}.</span>
                <input
                  value={item.studyId}
                  onChange={(e) => onUpdateStudyId(item.key, e.target.value)}
                  disabled={submitting}
                  className="w-40 bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg px-2 py-1 text-[var(--text-primary)] disabled:opacity-60"
                  aria-label={`Study ID for ${item.file.name}`}
                />
                <span className="text-[var(--text-tertiary)] truncate flex-1 min-w-[120px]">{item.file.name}</span>
                <span className="text-[var(--text-tertiary)] text-xs">{(item.file.size / 1024).toFixed(0)} KB</span>
                {item.attempts > 0 && <span className="text-[var(--text-tertiary)] text-xs">{item.attempts} {item.attempts === 1 ? "attempt" : "attempts"}</span>}
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md ${style.className}`}>
                  {BUSY.includes(item.status) && <Loader2 size={12} className="animate-spin" />}
                  {item.status === "COMPLETE" && <CheckCircle2 size={12} />}
                  {(item.status === "FAILED" || item.status === "NEEDS_REVIEW" || item.status === "RATE_LIMITED") && <AlertCircle size={12} />}
                  {style.label}
                </span>
                {(item.status === "FAILED" || item.status === "RATE_LIMITED" || item.status === "CANCELLED") && (
                  <button onClick={() => onRetry(item.key)} className="inline-flex items-center gap-1 text-xs text-[var(--purple-bright)] hover:underline">
                    <RotateCcw size={12} /> {item.status === "RATE_LIMITED" ? "Resume this study" : item.status === "CANCELLED" ? "Requeue" : "Retry"}
                  </button>
                )}
                {failedReason && <span className="text-xs text-rose-300 basis-full">{failedReason}</span>}
                {!submitting && item.status !== "COMPLETE" && item.status !== "NEEDS_REVIEW" && (
                  <button onClick={() => onRemove(item.key)} aria-label={`Remove ${item.file.name}`} className="text-[var(--text-tertiary)] hover:text-rose-300">
                    <X size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
