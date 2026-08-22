"use client";

import { useState } from 'react';
import GlobalInconsistency from './diagnostics/GlobalInconsistency';
import NodeSplitting from './diagnostics/NodeSplitting';
import DirectVsIndirect from './diagnostics/DirectVsIndirect';
import ContributionMatrix from './diagnostics/ContributionMatrix';
import NetHeatPlot from './diagnostics/NetHeatPlot';
import type { NMADiagnosticsResult } from '../../../types/statistics';

const TABS = ["Global Inconsistency", "Node Splitting", "Direct vs Indirect", "Contribution Matrix", "Net Heat Plot"];

interface NMADiagnosticsProps {
  diagnostics: NMADiagnosticsResult | null;
  loading: boolean;
  error: string | null;
  onRun: () => void;
}

export default function NMADiagnostics({ diagnostics, loading, error, onRun }: NMADiagnosticsProps) {
  const [tab, setTab] = useState("Global Inconsistency");

  return (
    <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-bold text-white">NMA Diagnostics</h3>
          <p className="text-slate-500 text-xs mt-1">Global inconsistency, node splitting, direct-vs-indirect evidence, contribution matrix, and net heat plot - computed by re-fitting the same model with your primary analysis settings.</p>
        </div>
        <button onClick={onRun} disabled={loading} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl shadow-lg whitespace-nowrap">
          {loading ? "RUNNING DIAGNOSTICS..." : diagnostics ? "RE-RUN DIAGNOSTICS" : "RUN DIAGNOSTICS"}
        </button>
      </div>

      {error && <div className="bg-red-950/80 border border-red-500/80 text-red-200 p-4 rounded-xl text-sm font-mono">{error}</div>}

      {diagnostics && (
        <>
          <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-lg p-3 text-xs text-slate-300">{diagnostics.settings_used.note}</div>
          <div className="flex gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${tab === t ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>{t}</button>
            ))}
          </div>
          {tab === "Global Inconsistency" && <GlobalInconsistency data={diagnostics.global_inconsistency} />}
          {tab === "Node Splitting" && <NodeSplitting data={diagnostics.node_splitting} />}
          {tab === "Direct vs Indirect" && <DirectVsIndirect data={diagnostics.direct_vs_indirect} />}
          {tab === "Contribution Matrix" && <ContributionMatrix data={diagnostics.contribution_matrix} />}
          {tab === "Net Heat Plot" && <NetHeatPlot data={diagnostics.net_heat_plot} />}
        </>
      )}
    </div>
  );
}
