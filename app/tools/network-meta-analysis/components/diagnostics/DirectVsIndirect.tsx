"use client";

import type { NMADiagnosticsResult } from '../../../../types/statistics';

type DirectVsIndirectData = NMADiagnosticsResult["node_splitting"];
type DirectVsIndirectRow = NonNullable<DirectVsIndirectData["table"]>[number];

// Reuses the same netsplit() output as Node Splitting (both come from one
// R computation), but frames it as a direct/indirect/network comparison
// rather than an inconsistency-focused table.
export default function DirectVsIndirect({ data }: { data: DirectVsIndirectData | null }) {
  if (!data) return null;
  if (data.unavailable_reason) {
    return <div className="bg-amber-950/40 border border-amber-600/50 rounded-xl p-4 text-amber-300 text-sm">Direct vs. indirect evidence could not be computed: {data.unavailable_reason}</div>;
  }
  const table = data.table ?? [];
  const evaluable = table.filter(r => r.evaluable);
  const notEvaluable = table.filter(r => !r.evaluable);

  return (
    <div className="space-y-6">
      <p className="text-slate-400 text-xs">Direct evidence comes from studies comparing the two treatments head-to-head; indirect evidence is inferred through the rest of the network via a common comparator. Both are derived from the same fitted NMA model as the rest of this module.</p>
      <div className="space-y-3">
        {evaluable.map((r: DirectVsIndirectRow, i: number) => {
          const range = [r.direct_lower, r.direct_upper, r.indirect_lower ?? 0, r.indirect_upper ?? 0];
          const min = Math.min(...range), max = Math.max(...range);
          const scale = (v: number) => `${((v - min) / (max - min || 1)) * 100}%`;
          return (
            <div key={i} className="bg-[#0b0c10] border border-slate-800 rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-white text-sm">{r.comparison}</span>
                <span className={`text-xs ${r.diff_p != null && r.diff_p < 0.05 ? "text-red-400" : "text-slate-500"}`}>disagreement p = {r.diff_p ?? "—"}</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-16 text-indigo-400">Direct</span>
                  <div className="flex-1 relative h-2 bg-slate-800 rounded-full">
                    <div className="absolute h-2 bg-indigo-500 rounded-full" style={{ left: scale(r.direct_lower), right: `calc(100% - ${scale(r.direct_upper)})` }} />
                  </div>
                  <span className="w-40 text-right text-slate-300">{r.direct_estimate} [{r.direct_lower}; {r.direct_upper}]</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-16 text-emerald-400">Indirect</span>
                  <div className="flex-1 relative h-2 bg-slate-800 rounded-full">
                    <div className="absolute h-2 bg-emerald-500 rounded-full" style={{ left: scale(r.indirect_lower ?? 0), right: `calc(100% - ${scale(r.indirect_upper ?? 0)})` }} />
                  </div>
                  <span className="w-40 text-right text-slate-300">{r.indirect_estimate} [{r.indirect_lower}; {r.indirect_upper}]</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {notEvaluable.length > 0 && (
        <div className="text-xs text-slate-500">
          Not evaluable (insufficient independent indirect evidence): {notEvaluable.map(r => r.comparison).join(", ")}
        </div>
      )}
    </div>
  );
}
