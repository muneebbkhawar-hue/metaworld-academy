"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, RotateCcw, AlertTriangle } from "lucide-react";
import type { ReconstructionResult } from "../lib/types";

interface Props {
  result: ReconstructionResult | null;
  busy: boolean;
  accepted: boolean;
  onRun: () => void;
  onAccept: () => void;
  onEdit: () => void;
  canRun: boolean;
}

interface ReportedHR {
  label: string;
  hr: string;
  ciLower: string;
  ciUpper: string;
}

export default function ReconstructPanel({ result, busy, accepted, onRun, onAccept, onEdit, canRun }: Props) {
  const [reportedHRs, setReportedHRs] = useState<ReportedHR[]>([]);

  return (
    <div className="flex flex-col gap-6">
      {!result && (
        <button
          type="button"
          onClick={onRun}
          disabled={!canRun || busy}
          className="self-start px-6 py-3 rounded-lg text-white font-semibold text-sm disabled:opacity-50 flex items-center gap-2"
          style={{ backgroundImage: "var(--gradient-primary)" }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          {busy ? "Reconstructing…" : "Reconstruct Survival Data"}
        </button>
      )}
      {!canRun && !result && (
        <p className="text-sm text-amber-500 flex items-center gap-2">
          <AlertTriangle size={14} /> Calibrate both axes and digitize at least 2 points per group before reconstructing.
        </p>
      )}

      {result && result.status === "error" && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-500 flex items-center gap-2">
          <AlertTriangle size={16} /> {result.message}
        </div>
      )}

      {result && result.status === "success" && (
        <>
          <p className="text-xs text-[var(--text-secondary)]">
            Method: {result.method}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {result.groups.map((g) => (
              <div key={g.name} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                <h4 className="font-semibold text-sm text-[var(--text-primary)] mb-1">{g.name}</h4>
                {g.status === "error" ? (
                  <p className="text-xs text-red-500">{g.message}</p>
                ) : (
                  <>
                    <p className="text-xs text-[var(--purple-bright)] font-medium mb-2">
                      {g.mode === "reconstructed" ? "Reconstructed pseudo-IPD" : "Digitized curve only (no reconstruction)"}
                    </p>
                    {g.km_summary && (
                      <ul className="text-xs text-[var(--text-secondary)] space-y-0.5">
                        <li>N (reconstructed): {g.km_summary.n}</li>
                        <li>Events: {g.km_summary.events}</li>
                        <li>Censored: {g.km_summary.censored}</li>
                        <li>
                          Median survival:{" "}
                          {g.km_summary.median_estimable ? g.km_summary.median_survival_time : "Not estimable (survival never reaches 50%)"}
                        </li>
                      </ul>
                    )}
                    {g.warnings?.map((w, i) => (
                      <p key={i} className="text-xs text-amber-500 mt-2 flex items-start gap-1.5">
                        <AlertTriangle size={11} className="shrink-0 mt-0.5" /> {w}
                      </p>
                    ))}
                  </>
                )}
              </div>
            ))}
          </div>

          {result.validationPlotBase64 && (
            <div>
              <h4 className="font-semibold text-sm text-[var(--text-primary)] mb-2">Visual validation</h4>
              <p className="text-xs text-[var(--text-secondary)] mb-2">
                Compare the digitized points against the reconstructed KM curve below. If they diverge substantially, edit the
                digitization rather than accepting the reconstruction.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.validationPlotBase64} alt="Validation: digitized points vs reconstructed KM curve" className="rounded-lg border border-[var(--border-subtle)] max-w-full" />
            </div>
          )}

          <div className="flex gap-3">
            {!accepted ? (
              <>
                <button
                  type="button"
                  onClick={onAccept}
                  className="px-5 py-2 rounded-lg text-white font-semibold text-sm flex items-center gap-2"
                  style={{ backgroundImage: "var(--gradient-primary)" }}
                >
                  <CheckCircle2 size={16} /> Reconstruction accepted
                </button>
                <button type="button" onClick={onEdit} className="px-5 py-2 rounded-lg border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] flex items-center gap-2">
                  <RotateCcw size={16} /> Edit digitization
                </button>
              </>
            ) : (
              <p className="text-sm text-green-500 flex items-center gap-2">
                <CheckCircle2 size={16} /> Reconstruction accepted — proceed to export.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
            <h4 className="font-semibold text-sm text-[var(--text-primary)] mb-2">Reported effect estimates (optional)</h4>
            <p className="text-xs text-[var(--text-secondary)] mb-3">
              If the source publication reports a hazard ratio and CI, enter it here for your records. This tool never calculates or
              infers a hazard ratio from the reconstructed data automatically — a reconstructed HR would need explicit further survival
              modeling on the pseudo-IPD, which is not performed here to avoid presenting an estimate as more certain than it is.
            </p>
            {reportedHRs.map((hr, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 mb-2">
                <input
                  placeholder="Comparison label"
                  value={hr.label}
                  onChange={(e) => setReportedHRs((prev) => prev.map((h, j) => (j === i ? { ...h, label: e.target.value } : h)))}
                  className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-void)] px-2 py-1 text-sm"
                />
                <input
                  placeholder="Reported HR"
                  value={hr.hr}
                  onChange={(e) => setReportedHRs((prev) => prev.map((h, j) => (j === i ? { ...h, hr: e.target.value } : h)))}
                  className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-void)] px-2 py-1 text-sm"
                />
                <input
                  placeholder="95% CI lower"
                  value={hr.ciLower}
                  onChange={(e) => setReportedHRs((prev) => prev.map((h, j) => (j === i ? { ...h, ciLower: e.target.value } : h)))}
                  className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-void)] px-2 py-1 text-sm"
                />
                <input
                  placeholder="95% CI upper"
                  value={hr.ciUpper}
                  onChange={(e) => setReportedHRs((prev) => prev.map((h, j) => (j === i ? { ...h, ciUpper: e.target.value } : h)))}
                  className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-void)] px-2 py-1 text-sm"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setReportedHRs((prev) => [...prev, { label: "", hr: "", ciLower: "", ciUpper: "" }])}
              className="text-xs text-[var(--purple-bright)] hover:underline"
            >
              + Add reported estimate
            </button>
          </div>
        </>
      )}
    </div>
  );
}
