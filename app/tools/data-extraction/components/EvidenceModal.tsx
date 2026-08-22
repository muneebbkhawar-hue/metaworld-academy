"use client";

import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import type { Evidence } from "@/app/lib/extraction/types";

export interface EvidenceModalData {
  studyId: string;
  filename: string;
  variable: string;
  originalValue: string;
  standardizedValue?: string | null;
  transformation?: string | null;
  evidence: Evidence;
}

const STATUS_LABEL: Record<Evidence["status"], string> = {
  reported: "Reported",
  not_reported: "Not reported",
  unclear: "Unclear",
  derived: "Derived / calculated",
  converted: "Converted / harmonized",
};

export default function EvidenceModal({ data, onClose }: { data: EvidenceModalData; onClose: () => void }) {
  const { evidence } = data;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">{data.variable}</h3>
            <p className="text-xs text-[var(--text-tertiary)]">{data.studyId} — {data.filename}</p>
          </div>
          <button onClick={onClose} aria-label="Close evidence panel" className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X size={18} /></button>
        </div>

        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Original reported value</dt>
            <dd className="text-[var(--text-primary)]">{data.originalValue || "—"}</dd>
          </div>
          {data.standardizedValue && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Standardized value</dt>
              <dd className="text-[var(--text-primary)]">{data.standardizedValue}</dd>
              {data.transformation && <dd className="text-xs text-[var(--text-tertiary)] mt-0.5">{data.transformation}</dd>}
            </div>
          )}
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Source</dt>
            <dd className="text-[var(--text-primary)]">
              {evidence.page !== null ? `Page ${evidence.page}` : "Page not specified"}{evidence.location ? `, ${evidence.location}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Evidence quote</dt>
            <dd className="text-[var(--text-secondary)] italic border-l-2 border-[var(--border-subtle)] pl-3 mt-1">
              {evidence.quote ? `"${evidence.quote}"` : "No supporting quote available."}
            </dd>
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Status</dt>
              <dd className="text-[var(--text-primary)]">{STATUS_LABEL[evidence.status]}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Confidence</dt>
              <dd className="text-[var(--text-primary)]">{evidence.confidence}</dd>
            </div>
          </div>
          {evidence.quote_verified !== undefined && evidence.quote_verified !== null && (
            <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${evidence.quote_verified ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>
              {evidence.quote_verified ? <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />}
              <span>{evidence.quote_verified ? "This quote was automatically verified against the PDF's extracted text." : "This quote could NOT be automatically verified against the PDF's extracted text — check it manually."}</span>
            </div>
          )}
          {evidence.verification_note && <p className="text-xs text-[var(--text-tertiary)]">{evidence.verification_note}</p>}
        </dl>

        <p className="mt-5 text-[11px] text-[var(--text-tertiary)] border-t border-[var(--border-subtle)] pt-3">
          AI-assisted extraction requires researcher verification before use in publication.
        </p>
      </div>
    </div>
  );
}
