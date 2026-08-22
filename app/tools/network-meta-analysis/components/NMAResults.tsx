"use client";

import { useState } from 'react';
import NetworkGeometry from './NetworkGeometry';
import LeagueTable from './LeagueTable';
import NMAForestPlot from './NMAForestPlot';
import TreatmentRanking from './TreatmentRanking';
import Rankogram from './Rankogram';
import type { NMAAnalyzeResult } from '../../../types/statistics';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#0b0c10] p-4 rounded-xl border border-slate-800">
      <span className="text-xs text-slate-500 block mb-1">{label}</span>
      <span className="text-lg font-bold text-white">{value}</span>
    </div>
  );
}

const TABS = ["Summary", "Network Geometry", "League Table", "NMA Forest Plot", "Treatment Ranking", "Rankogram"];

export default function NMAResults({ results }: { results: NMAAnalyzeResult | null }) {
  const [tab, setTab] = useState("Summary");
  if (!results) return null;
  const { summary } = results;

  return (
    <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl space-y-6">
      <div className="flex gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${tab === t ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>{t}</button>
        ))}
      </div>

      {tab === "Summary" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Studies" value={summary.n_studies} />
            <Stat label="Treatments" value={summary.n_treatments} />
            <Stat label="Treatment Arms" value={summary.n_treatment_arms} />
            <Stat label="Multi-arm Studies" value={summary.n_multiarm_studies} />
            <Stat label="Participants" value={summary.n_participants.toLocaleString()} />
            <Stat label="Direct Comparisons" value={summary.n_direct_comparisons} />
            <Stat label="Outcome Type" value={summary.outcome_type === "continuous" ? "Continuous" : "Dichotomous"} />
            <Stat label="Effect Measure" value={summary.effect_measure} />
            <Stat label="Model" value={summary.model} />
            <Stat label="Tau² Estimator" value={summary.tau_method} />
            <Stat label="Reference Treatment" value={summary.reference_treatment} />
            {summary.tau2 != null && <Stat label="Tau²" value={summary.tau2.toFixed(4)} />}
            {summary.i2 != null && <Stat label="I²" value={`${(summary.i2 * 100).toFixed(1)}%`} />}
            <Stat label="Network Connectivity" value={summary.connected ? "Connected ✓" : "Disconnected"} />
            <Stat label="Analysis Status" value={`${summary.analysis_status} ✓`} />
          </div>
          <div className="bg-amber-950/30 border border-amber-600/40 rounded-xl p-4 text-xs text-amber-200">
            ⚠️ &quot;Connected ✓&quot; means a valid NMA could be fitted - it does <strong>not</strong> mean the transitivity/consistency assumptions required for a trustworthy NMA have been established. {summary.connectivity_note}
          </div>
        </div>
      )}
      {tab === "Network Geometry" && <NetworkGeometry imageBase64={results.network_geometry_base64} />}
      {tab === "League Table" && <LeagueTable leagueTable={results.league_table} effectMeasure={summary.effect_measure} />}
      {tab === "NMA Forest Plot" && <NMAForestPlot imageBase64={results.forest_plot_base64} referenceTreatment={summary.reference_treatment} />}
      {tab === "Treatment Ranking" && <TreatmentRanking ranking={results.ranking} />}
      {tab === "Rankogram" && <Rankogram imageBase64={results.rankogram_base64} />}
    </div>
  );
}
