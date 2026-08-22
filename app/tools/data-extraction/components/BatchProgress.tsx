"use client";

// Batch-level processing status: summary counts + the queue-paused banner +
// Pause/Resume/Cancel controls. Kept separate from UploadPanel (which owns
// the pre-flight file list/editing) so this only appears once processing
// has actually started - matches the brief's "do not clutter the interface"
// instruction rather than showing two overlapping tables at once.
import { AlertTriangle, Loader2, Pause, Play, XCircle } from "lucide-react";
import type { UploadItem } from "../lib/types";

function Stat({ label, value, className }: { label: string; value: number; className?: string }) {
  if (value === 0) return null;
  return (
    <div className={`rounded-lg px-3 py-2 text-center min-w-[84px] ${className ?? "bg-[var(--bg-surface-2)] text-[var(--text-secondary)]"}`}>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide">{label}</div>
    </div>
  );
}

export default function BatchProgress({
  items, queuePaused, pauseReason, onResume, onPauseQueue, onCancelRemaining, submitting,
}: {
  items: UploadItem[];
  queuePaused: boolean;
  pauseReason: string | null;
  onResume: () => void;
  onPauseQueue: () => void;
  onCancelRemaining: () => void;
  submitting: boolean;
}) {
  if (items.length === 0) return null;

  const counts = {
    total: items.length,
    completed: items.filter((i) => i.status === "COMPLETE" || i.status === "NEEDS_REVIEW").length,
    processing: items.filter((i) => i.status === "PROCESSING" || i.status === "VERIFYING" || i.status === "RETRYING").length,
    queued: items.filter((i) => i.status === "QUEUED").length,
    failed: items.filter((i) => i.status === "FAILED").length,
    quotaPaused: items.filter((i) => i.status === "RATE_LIMITED").length,
    cancelled: items.filter((i) => i.status === "CANCELLED").length,
  };
  const hasStarted = counts.completed + counts.processing + counts.failed + counts.quotaPaused + counts.cancelled > 0;
  if (!hasStarted) return null;

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4">
      <div className="flex flex-wrap gap-3">
        <Stat label="Total" value={counts.total} className="bg-[var(--bg-surface-2)] text-[var(--text-primary)]" />
        <Stat label="Completed" value={counts.completed} className="bg-emerald-500/15 text-emerald-300" />
        <Stat label="Processing" value={counts.processing} className="bg-[var(--purple-primary)]/15 text-[var(--purple-bright)]" />
        <Stat label="Queued" value={counts.queued} />
        <Stat label="Failed" value={counts.failed} className="bg-rose-500/15 text-rose-300" />
        <Stat label="Quota paused" value={counts.quotaPaused} className="bg-amber-500/15 text-amber-300" />
        <Stat label="Cancelled" value={counts.cancelled} />
      </div>

      {queuePaused && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>
            {pauseReason ?? "Processing is paused."} {counts.completed} of {counts.total} studies were completed successfully. The remaining {counts.queued + counts.quotaPaused} studies are safely queued and have not been lost.
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {queuePaused && (counts.queued + counts.quotaPaused) > 0 && (
          <button onClick={onResume} disabled={submitting} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-60" style={{ backgroundImage: "var(--gradient-primary)" }}>
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Resume Processing
          </button>
        )}
        {submitting && !queuePaused && (
          <button onClick={onPauseQueue} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] hover:border-[var(--border-hover)]">
            <Pause size={14} /> Pause Queue
          </button>
        )}
        {!submitting && counts.queued > 0 && (
          <button onClick={onCancelRemaining} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-subtle)] text-sm text-[var(--text-tertiary)] hover:border-rose-400 hover:text-rose-300">
            <XCircle size={14} /> Cancel remaining
          </button>
        )}
      </div>
    </div>
  );
}
