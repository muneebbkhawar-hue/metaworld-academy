"use client";

import { EFFECT_MEASURES_BY_OUTCOME, TAU2_ESTIMATORS, type OutcomeType, type EffectMeasure } from '../lib/types';

interface ModelSettingsProps {
  outcomeType: OutcomeType; setOutcomeType: (v: OutcomeType) => void;
  effectMeasure: EffectMeasure; setEffectMeasure: (v: EffectMeasure) => void;
  model: string; setModel: (v: string) => void;
  tauMethod: string; setTauMethod: (v: string) => void;
  ciLevel: number; setCiLevel: (v: number) => void;
  knha: boolean; setKnha: (v: boolean) => void;
}

export default function ModelSettings({
  outcomeType, setOutcomeType, effectMeasure, setEffectMeasure,
  model, setModel, tauMethod, setTauMethod, ciLevel, setCiLevel, knha, setKnha,
}: ModelSettingsProps) {
  const measures = EFFECT_MEASURES_BY_OUTCOME[outcomeType];

  return (
    <div className="bg-[#151722] border border-indigo-900/30 rounded-2xl p-6 shadow-xl space-y-6">
      <h3 className="text-lg font-bold text-white">Model Settings</h3>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Outcome type:</label>
        <div className="flex gap-3">
          {(["dichotomous", "continuous", "generic"] as const).map(t => (
            <button key={t} onClick={() => {
              setOutcomeType(t);
              setEffectMeasure(EFFECT_MEASURES_BY_OUTCOME[t][0].value);
            }} className={`px-5 py-2.5 rounded-xl font-medium transition ${outcomeType === t ? "bg-indigo-600 text-white" : "text-slate-400 bg-[#0b0c10]"}`}>
              {t === "dichotomous" ? "Dichotomous" : t === "continuous" ? "Continuous" : "Generic Inverse Variance"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Effect measure:</label>
          <select value={effectMeasure} onChange={e => setEffectMeasure(e.target.value as EffectMeasure)} disabled={outcomeType === "generic"} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white disabled:opacity-50">
            {measures.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          {outcomeType === "generic" && <p className="text-[10px] text-slate-500 mt-1">Uses the Effect/SE you supplied directly - no effect-size calculation is performed.</p>}
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Pooling model:</label>
          <select value={model} onChange={e => setModel(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
            <option value="Random-effects">Random-effects</option>
            <option value="Common-effect">Common-effect</option>
          </select>
        </div>
        {model === "Random-effects" && (
          <div>
            <label className="block text-xs text-slate-400 mb-1">τ² estimator:</label>
            <select value={tauMethod} onChange={e => setTauMethod(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
              {TAU2_ESTIMATORS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Confidence level:</label>
          <select value={ciLevel} onChange={e => setCiLevel(Number(e.target.value))} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
            <option value={90}>90%</option>
            <option value={95}>95% (default)</option>
            <option value={99}>99%</option>
          </select>
        </div>
        {model === "Random-effects" && (
          <div>
            <label className="block text-xs text-slate-400 mb-1">Knapp-Hartung adjustment (metafor: <code>test=&quot;knha&quot;</code>):</label>
            <select value={knha ? "applied" : "not-applied"} onChange={e => setKnha(e.target.value === "applied")} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
              <option value="not-applied">Not applied (Wald-type, z-test)</option>
              <option value="applied">Applied (Knapp-Hartung, t-test)</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
