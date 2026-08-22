"use client";

import { useState } from 'react';
import Link from 'next/link';
import { META_API_URL } from '../../lib/apiConfig';
import { BACKEND_UNAVAILABLE_MESSAGE } from '../../lib/apiClient';

interface GradeRow {
  outcome: string;
  effect_ci: string;
  k: number;
  risk_of_bias: string;
  inconsistency: string;
  indirectness: string;
  imprecision: string;
  publication_bias: string;
  certainty: string;
}

export default function GradeTool() {
  const [outcome, setOutcome] = useState("All-cause mortality");
  const [effect, setEffect] = useState("RR 0.82 (0.71 to 0.95)");
  const [k, setK] = useState(12);
  const [n, setN] = useState(3450);
  const [i2, setI2] = useState(25);
  const [rob, setRob] = useState("Not serious");
  const [pubBias, setPubBias] = useState("Undetected");
  const [design, setDesign] = useState("RCT");
  
  const [result, setResult] = useState<GradeRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const evaluateGrade = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${META_API_URL}/api/grade/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, effect, k, n, i2, risk_of_bias: rob, publication_bias: pubBias, study_design: design })
      });
      const data = await res.json();
      setResult(data.row);
    } catch {
      alert(BACKEND_UNAVAILABLE_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] text-slate-200 font-sans pb-24 relative">
      <nav className="border-b border-indigo-900/30 bg-[#0f111a]/90 backdrop-blur px-8 py-4 flex justify-between items-center sticky top-0 z-50">
        <div><Link href="/" className="text-xl font-bold text-white">MetaWorld <span className="text-indigo-400 font-normal">Research Academy</span></Link></div>
        <div className="flex gap-6 text-sm font-medium">
          <Link href="/" className="hover:text-indigo-400 text-slate-400">Home</Link>
          <Link href="/tools" className="text-indigo-400">Tools</Link>
        </div>
      </nav>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#151722] border border-indigo-500/40 rounded-3xl max-w-2xl w-full p-8 shadow-2xl relative">
            <button onClick={() => setShowModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-white bg-slate-800 w-8 h-8 rounded-full flex items-center justify-center font-bold">✕</button>
            <span className="text-xs text-indigo-400 font-mono font-bold tracking-widest uppercase mb-2 block">ABOUT THIS TOOL</span>
            <h2 className="text-2xl font-bold text-white mb-4">GRADE Evidence Profile Assessor</h2>
            <p className="text-slate-300 text-sm leading-relaxed">Following official GRADE guidelines (Brozek et al., 2021), this tool automatically evaluates Inconsistency via I-squared thresholds, Imprecision based on sample size thresholds, and computes final evidence certainty ratings.</p>
            <div className="mt-8 pt-4 border-t border-slate-800 flex justify-end">
              <button onClick={() => setShowModal(false)} className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl">Got it</button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-8">
          <Link href="/tools" className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium">← Back to Tools Dashboard</Link>
          <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 rounded-lg text-sm font-medium">📖 READ ME</button>
        </div>

        <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-8 shadow-xl space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">GRADE Evidence Profile Assessor</h2>
            <p className="text-slate-400 text-sm">Automated certainty rating following Brozek et al., 2021 guidelines.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 bg-[#0b0c10] p-6 rounded-2xl border border-slate-800">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Outcome Name:</label>
              <input type="text" value={outcome} onChange={e => setOutcome(e.target.value)} className="w-full bg-[#151722] border border-slate-800 rounded-lg p-2.5 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Effect Estimate (95% CI):</label>
              <input type="text" value={effect} onChange={e => setEffect(e.target.value)} className="w-full bg-[#151722] border border-slate-800 rounded-lg p-2.5 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Study Design:</label>
              <select value={design} onChange={e => setDesign(e.target.value)} className="w-full bg-[#151722] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                <option value="RCT">RCT (Starts at High)</option>
                <option value="Observational">Observational (Starts at Low)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Number of Studies (k):</label>
              <input type="number" value={k} onChange={e => setK(Number(e.target.value))} className="w-full bg-[#151722] border border-slate-800 rounded-lg p-2.5 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Total Sample Size (n):</label>
              <input type="number" value={n} onChange={e => setN(Number(e.target.value))} className="w-full bg-[#151722] border border-slate-800 rounded-lg p-2.5 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Heterogeneity (I² %):</label>
              <input type="number" value={i2} onChange={e => setI2(Number(e.target.value))} className="w-full bg-[#151722] border border-slate-800 rounded-lg p-2.5 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Risk of Bias:</label>
              <select value={rob} onChange={e => setRob(e.target.value)} className="w-full bg-[#151722] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                <option value="Not serious">Not serious</option>
                <option value="Serious">Serious (-1)</option>
                <option value="Very serious">Very serious (-2)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Publication Bias:</label>
              <select value={pubBias} onChange={e => setPubBias(e.target.value)} className="w-full bg-[#151722] border border-slate-800 rounded-lg p-2.5 text-sm text-white">
                <option value="Undetected">Undetected</option>
                <option value="Suspected">Suspected (-1)</option>
              </select>
            </div>
          </div>

          <button onClick={evaluateGrade} disabled={loading} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg transition">
            {loading ? "Evaluating GRADE Rules..." : "Generate GRADE Evidence Profile"}
          </button>

          {result && (
            <div className="pt-6 border-t border-slate-800 space-y-6">
              <h3 className="text-xl font-bold text-white">GRADE Evidence Profile Table</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 uppercase text-xs bg-black/40">
                      <th className="p-3">Outcome</th>
                      <th className="p-3">Effect (95% CI)</th>
                      <th className="p-3">k</th>
                      <th className="p-3">Risk of Bias</th>
                      <th className="p-3">Inconsistency</th>
                      <th className="p-3">Indirectness</th>
                      <th className="p-3">Imprecision</th>
                      <th className="p-3">Publication Bias</th>
                      <th className="p-3">Certainty</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-800 bg-[#0b0c10]">
                      <td className="p-3 font-semibold text-white">{result.outcome}</td>
                      <td className="p-3">{result.effect_ci}</td>
                      <td className="p-3">{result.k}</td>
                      <td className="p-3">{result.risk_of_bias}</td>
                      <td className="p-3">{result.inconsistency}</td>
                      <td className="p-3">{result.indirectness}</td>
                      <td className="p-3">{result.imprecision}</td>
                      <td className="p-3">{result.publication_bias}</td>
                      <td className="p-3 font-bold text-emerald-400">{result.certainty}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}