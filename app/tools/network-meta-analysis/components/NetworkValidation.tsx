"use client";

import type { NMAValidation } from '../../../types/statistics';

export default function NetworkValidation({ validation, validating }: { validation: NMAValidation | null; validating: boolean }) {
  if (validating) {
    return <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 text-slate-400 text-sm">Validating network…</div>;
  }
  if (!validation) return null;

  if (validation.status !== "success") {
    return (
      <div className="bg-red-950/80 border border-red-500/80 text-red-200 p-5 rounded-xl text-sm font-mono shadow-lg">
        {validation.message || "Validation failed."}
      </div>
    );
  }

  const lines = [
    `${validation.n_studies} studies detected`,
    `${validation.n_treatments} treatments detected`,
    `${validation.n_direct_comparisons} direct treatment comparisons detected`,
    validation.connected ? "Network is connected" : `Network is DISCONNECTED (${validation.n_components} separate components)`,
    validation.connected ? "Data validation passed" : "Fix the disconnected network before running NMA",
  ];

  return (
    <div className={`rounded-2xl p-6 border space-y-2 ${validation.connected ? "bg-emerald-950/30 border-emerald-600/40" : "bg-red-950/40 border-red-600/50"}`}>
      <h3 className="text-white font-semibold text-sm mb-2">Network Validation</h3>
      {lines.map((l, i) => (
        <div key={i} className={`text-sm flex items-center gap-2 ${validation.connected ? "text-emerald-300" : i >= 3 ? "text-red-300" : "text-slate-300"}`}>
          <span>{validation.connected || i < 3 ? "✓" : "✗"}</span><span>{l}</span>
        </div>
      ))}
      {!validation.connected && validation.components && (
        <div className="pt-3 mt-2 border-t border-red-800/50 text-xs text-red-300 space-y-1">
          <strong>Disconnected components:</strong>
          {validation.components.map((c, i) => (
            <div key={i}>Component {c.component}: {c.treatments.join(", ")}</div>
          ))}
        </div>
      )}
    </div>
  );
}
