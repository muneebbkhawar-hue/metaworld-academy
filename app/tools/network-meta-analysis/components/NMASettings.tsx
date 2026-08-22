"use client";

// Every option here maps 1:1 to something `netmeta` genuinely supports
// (verified against the installed package before this UI was written) -
// no dropdown exists that the R backend can't actually honor.
interface NMASettingsProps {
  outcomeType: string;
  setOutcomeType: (v: string) => void;
  effectMeasure: string;
  setEffectMeasure: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  tauMethod: string;
  setTauMethod: (v: string) => void;
  referenceTreatment: string;
  setReferenceTreatment: (v: string) => void;
  treatments: string[];
}

export default function NMASettings({ outcomeType, setOutcomeType, effectMeasure, setEffectMeasure, model, setModel, tauMethod, setTauMethod, referenceTreatment, setReferenceTreatment, treatments }: NMASettingsProps) {
  const measureOptions = outcomeType === "dichotomous"
    ? [["OR", "Odds Ratio (OR)"], ["RR", "Risk Ratio (RR)"], ["RD", "Risk Difference (RD)"]]
    : [["MD", "Mean Difference (MD)"], ["SMD", "Standardized Mean Difference (SMD)"]];

  return (
    <div className="bg-[#151722] border border-indigo-900/30 rounded-2xl p-6 shadow-xl space-y-6">
      <h3 className="text-lg font-bold text-white">Analysis Settings</h3>

      <div className="flex gap-3">
        <button onClick={() => { setOutcomeType("dichotomous"); setEffectMeasure("OR"); }} className={`px-5 py-2.5 rounded-xl font-medium transition ${outcomeType === "dichotomous" ? "bg-indigo-600 text-white" : "text-slate-400 bg-[#0b0c10]"}`}>Dichotomous</button>
        <button onClick={() => { setOutcomeType("continuous"); setEffectMeasure("MD"); }} className={`px-5 py-2.5 rounded-xl font-medium transition ${outcomeType === "continuous" ? "bg-indigo-600 text-white" : "text-slate-400 bg-[#0b0c10]"}`}>Continuous</button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Effect Measure:</label>
          <select value={effectMeasure} onChange={e => setEffectMeasure(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
            {measureOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Model:</label>
          <select value={model} onChange={e => setModel(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
            <option value="Random-effects">Random-effects</option>
            <option value="Common-effect">Common-effect</option>
          </select>
        </div>
        {model === "Random-effects" && (
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tau² Estimator:</label>
            <select value={tauMethod} onChange={e => setTauMethod(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
              <option value="REML">REML (Restricted Maximum Likelihood)</option>
              <option value="DL">DerSimonian-Laird (DL)</option>
              <option value="ML">Maximum Likelihood (ML)</option>
            </select>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-slate-800">
        <label className="block text-xs text-slate-400 mb-1">Reference Treatment:</label>
        <select value={referenceTreatment} onChange={e => setReferenceTreatment(e.target.value)} disabled={treatments.length === 0} className="w-full md:w-64 bg-[#0b0c10] border border-slate-800 rounded-lg p-2.5 text-sm text-white disabled:opacity-40">
          {treatments.length === 0
            ? <option>Upload data to populate treatments</option>
            : treatments.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <p className="text-xs text-slate-500 mt-1">All comparisons in the league table and forest plot will be expressed relative to this treatment.</p>
      </div>
    </div>
  );
}
