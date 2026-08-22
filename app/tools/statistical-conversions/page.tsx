"use client";

// Statistical Conversions - pure client-side calculator. No backend, no AI,
// no R process - every formula lives in app/lib/statConversions/, with its
// own unit tests (conversions.test.ts) and no UI dependency, per this
// task's explicit requirement to separate the calculation layer from the UI.
import { useState } from "react";
import { Calculator, Download } from "lucide-react";
import NavComp from "@/app/components/Nav";
import Footer from "@/app/components/Footer";
import FadeIn from "@/app/components/FadeIn";
import { downloadCSVFile } from "@/app/lib/exportUtils";
import {
  ConversionInputError,
  medianIQRToMeanSD,
  medianRangeToMeanSD,
  fiveNumberSummaryToMeanSD,
  meanSDToMedianIQR,
  ratioCIToLogSE,
  ciToSE,
  estimateSEToCI,
  sdToSE,
  seToSD,
  type ConversionResult,
  type RatioMeasure,
} from "@/app/lib/statConversions/conversions";
import Section from "./components/Section";
import ResultCard from "./components/ResultCard";
import { NumField, CalcButton, ResetButton, ErrorNote } from "./components/shared";

interface LogEntry { tool: string; label: string; value: number; }

function useConversion() {
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  function run(fn: () => ConversionResult) {
    try {
      setResult(fn());
      setError(null);
    } catch (err) {
      setResult(null);
      setError(err instanceof ConversionInputError ? err.message : "An unexpected error occurred. Please check your inputs.");
    }
  }
  function reset() {
    setResult(null);
    setError(null);
  }
  return { result, error, run, reset };
}

export default function StatisticalConversionsPage() {
  const [log, setLog] = useState<LogEntry[]>([]);
  function record(tool: string, r: ConversionResult) {
    setLog((prev) => [...prev, ...r.values.map((v) => ({ tool, label: v.label, value: v.value }))]);
  }
  function exportLog() {
    if (log.length === 0) return;
    downloadCSVFile("statistical-conversions.csv", ["Tool", "Result", "Value"], log.map((l) => [l.tool, l.label, l.value]));
  }

  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)] font-sans">
      <NavComp />
      <main className="max-w-4xl mx-auto px-6 py-16 space-y-10">
        <FadeIn>
          <div className="flex items-center gap-3 mb-3">
            <Calculator size={26} className="text-[var(--purple-bright)]" />
            <h1 className="text-3xl md:text-4xl font-bold">Statistical Conversions</h1>
          </div>
          <p className="text-[var(--text-secondary)] max-w-2xl">
            Quick, transparent statistical conversions for systematic reviewers and meta-analysts. Every result states
            whether it is an <strong className="text-[var(--text-primary)]">exact</strong> calculation, an{" "}
            <strong className="text-[var(--text-primary)]">estimated</strong> conversion from a published method, or an{" "}
            <strong className="text-[var(--text-primary)]">assumption-based</strong> approximation - never presented as more
            certain than it is.
          </p>
        </FadeIn>

        {log.length > 0 && (
          <FadeIn>
            <button onClick={exportLog} className="inline-flex items-center gap-2 text-sm font-medium text-[var(--purple-bright)] hover:underline">
              <Download size={14} /> Download all results this session (CSV) — {log.length} value{log.length === 1 ? "" : "s"}
            </button>
          </FadeIn>
        )}

        <FadeIn delay={0.05}><MedianIQRSection onResult={record} /></FadeIn>
        <FadeIn delay={0.08}><MedianRangeSection onResult={record} /></FadeIn>
        <FadeIn delay={0.11}><FiveNumberSection onResult={record} /></FadeIn>
        <FadeIn delay={0.14}><MeanSDSection onResult={record} /></FadeIn>
        <FadeIn delay={0.17}><RatioCISection onResult={record} /></FadeIn>
        <FadeIn delay={0.2}><CIToSESection onResult={record} /></FadeIn>
        <FadeIn delay={0.23}><EstimateSEToCISection onResult={record} /></FadeIn>
        <FadeIn delay={0.26}><SDToSESection onResult={record} /></FadeIn>
        <FadeIn delay={0.29}><SEToSDSection onResult={record} /></FadeIn>
      </main>
      <Footer />
    </div>
  );
}

// --- A. Median + IQR -> Mean + SD -------------------------------------------
function MedianIQRSection({ onResult }: { onResult: (tool: string, r: ConversionResult) => void }) {
  const [median, setMedian] = useState("");
  const [q1, setQ1] = useState("");
  const [q3, setQ3] = useState("");
  const [n, setN] = useState("");
  const { result, error, run, reset } = useConversion();

  function calc() {
    run(() => {
      const r = medianIQRToMeanSD(parseFloat(median), parseFloat(q1), parseFloat(q3), parseInt(n, 10));
      onResult("Median+IQR → Mean/SD", r);
      return r;
    });
  }
  function doReset() { setMedian(""); setQ1(""); setQ3(""); setN(""); reset(); }

  return (
    <Section title="A. Median + IQR → Mean + SD" description="Estimate mean and SD from median, Q1, Q3, and sample size (Wan et al. 2014).">
      <div className="grid sm:grid-cols-4 gap-3">
        <NumField label="Median" value={median} onChange={setMedian} />
        <NumField label="Q1 (lower quartile)" value={q1} onChange={setQ1} />
        <NumField label="Q3 (upper quartile)" value={q3} onChange={setQ3} />
        <NumField label="Sample size (n)" value={n} onChange={setN} />
      </div>
      <div className="flex gap-3"><CalcButton onClick={calc} /><ResetButton onClick={doReset} /></div>
      <ErrorNote message={error} />
      {result && <ResultCard result={result} />}
    </Section>
  );
}

// --- B. Median + Range -> Mean + SD ------------------------------------------
function MedianRangeSection({ onResult }: { onResult: (tool: string, r: ConversionResult) => void }) {
  const [median, setMedian] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [n, setN] = useState("");
  const { result, error, run, reset } = useConversion();

  function calc() {
    run(() => {
      const r = medianRangeToMeanSD(parseFloat(median), parseFloat(min), parseFloat(max), parseInt(n, 10));
      onResult("Median+Range → Mean/SD", r);
      return r;
    });
  }
  function doReset() { setMedian(""); setMin(""); setMax(""); setN(""); reset(); }

  return (
    <Section title="B. Median + Range → Mean + SD" description="Estimate mean and SD from median, minimum, maximum, and sample size (Wan et al. 2014).">
      <div className="grid sm:grid-cols-4 gap-3">
        <NumField label="Median" value={median} onChange={setMedian} />
        <NumField label="Minimum" value={min} onChange={setMin} />
        <NumField label="Maximum" value={max} onChange={setMax} />
        <NumField label="Sample size (n)" value={n} onChange={setN} />
      </div>
      <div className="flex gap-3"><CalcButton onClick={calc} /><ResetButton onClick={doReset} /></div>
      <ErrorNote message={error} />
      {result && <ResultCard result={result} />}
    </Section>
  );
}

// --- C. Five-number summary -> Mean + SD -------------------------------------
function FiveNumberSection({ onResult }: { onResult: (tool: string, r: ConversionResult) => void }) {
  const [min, setMin] = useState("");
  const [q1, setQ1] = useState("");
  const [median, setMedian] = useState("");
  const [q3, setQ3] = useState("");
  const [max, setMax] = useState("");
  const [n, setN] = useState("");
  const { result, error, run, reset } = useConversion();

  function calc() {
    run(() => {
      const r = fiveNumberSummaryToMeanSD(parseFloat(min), parseFloat(q1), parseFloat(median), parseFloat(q3), parseFloat(max), parseInt(n, 10));
      onResult("Five-number summary → Mean/SD", r);
      return r;
    });
  }
  function doReset() { setMin(""); setQ1(""); setMedian(""); setQ3(""); setMax(""); setN(""); reset(); }

  return (
    <Section title="C. Five-Number Summary → Mean + SD" description="Estimate mean and SD from min, Q1, median, Q3, max, and n (Wan et al. 2014 combined estimator).">
      <div className="grid sm:grid-cols-3 md:grid-cols-6 gap-3">
        <NumField label="Minimum" value={min} onChange={setMin} />
        <NumField label="Q1" value={q1} onChange={setQ1} />
        <NumField label="Median" value={median} onChange={setMedian} />
        <NumField label="Q3" value={q3} onChange={setQ3} />
        <NumField label="Maximum" value={max} onChange={setMax} />
        <NumField label="n" value={n} onChange={setN} />
      </div>
      <div className="flex gap-3"><CalcButton onClick={calc} /><ResetButton onClick={doReset} /></div>
      <ErrorNote message={error} />
      {result && <ResultCard result={result} />}
    </Section>
  );
}

// --- D. Mean + SD -> Median + IQR ---------------------------------------------
function MeanSDSection({ onResult }: { onResult: (tool: string, r: ConversionResult) => void }) {
  const [mean, setMean] = useState("");
  const [sd, setSd] = useState("");
  const [n, setN] = useState("");
  const { result, error, run, reset } = useConversion();

  function calc() {
    run(() => {
      const r = meanSDToMedianIQR(parseFloat(mean), parseFloat(sd), parseInt(n, 10) || 1);
      onResult("Mean/SD → Median/IQR", r);
      return r;
    });
  }
  function doReset() { setMean(""); setSd(""); setN(""); reset(); }

  return (
    <Section title="D. Mean + SD → Median + IQR" description="Normality-based approximation only - mean/SD do not uniquely determine median/IQR.">
      <div className="grid sm:grid-cols-3 gap-3">
        <NumField label="Mean" value={mean} onChange={setMean} />
        <NumField label="SD" value={sd} onChange={setSd} />
        <NumField label="Sample size (n, optional)" value={n} onChange={setN} placeholder="not required for this formula" />
      </div>
      <div className="flex gap-3"><CalcButton onClick={calc} /><ResetButton onClick={doReset} /></div>
      <ErrorNote message={error} />
      {result && <ResultCard result={result} />}
    </Section>
  );
}

// --- E. OR/RR/HR + CI -> log effect + SE --------------------------------------
function RatioCISection({ onResult }: { onResult: (tool: string, r: ConversionResult) => void }) {
  const [measure, setMeasure] = useState<RatioMeasure>("OR");
  const [effect, setEffect] = useState("");
  const [lower, setLower] = useState("");
  const [upper, setUpper] = useState("");
  const { result, error, run, reset } = useConversion();

  function calc() {
    run(() => {
      const r = ratioCIToLogSE(measure, parseFloat(effect), parseFloat(lower), parseFloat(upper));
      onResult(`${measure} + CI → log effect/SE`, r);
      return r;
    });
  }
  function doReset() { setEffect(""); setLower(""); setUpper(""); reset(); }

  return (
    <Section title="E. OR / RR / HR + 95% CI → log effect + SE" description="Derive the log-scale effect and its SE directly from a reported 95% CI.">
      <div className="grid sm:grid-cols-4 gap-3">
        <div>
          <label htmlFor="measure-select" className="block text-xs text-[var(--text-tertiary)] mb-1">Measure</label>
          <select id="measure-select" value={measure} onChange={(e) => setMeasure(e.target.value as RatioMeasure)} className="w-full bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]">
            <option value="OR">Odds Ratio (OR)</option>
            <option value="RR">Risk Ratio (RR)</option>
            <option value="HR">Hazard Ratio (HR)</option>
          </select>
        </div>
        <NumField label="Effect estimate" value={effect} onChange={setEffect} />
        <NumField label="Lower 95% CI" value={lower} onChange={setLower} />
        <NumField label="Upper 95% CI" value={upper} onChange={setUpper} />
      </div>
      <div className="flex gap-3"><CalcButton onClick={calc} /><ResetButton onClick={doReset} /></div>
      <ErrorNote message={error} />
      {result && <ResultCard result={result} />}
    </Section>
  );
}

// --- F. CI -> SE -----------------------------------------------------------------
function CIToSESection({ onResult }: { onResult: (tool: string, r: ConversionResult) => void }) {
  const [estimate, setEstimate] = useState("");
  const [lower, setLower] = useState("");
  const [upper, setUpper] = useState("");
  const [level, setLevel] = useState("0.95");
  const { result, error, run, reset } = useConversion();

  function calc() {
    run(() => {
      const r = ciToSE(parseFloat(estimate), parseFloat(lower), parseFloat(upper), parseFloat(level));
      onResult("CI → SE", r);
      return r;
    });
  }
  function doReset() { setEstimate(""); setLower(""); setUpper(""); setLevel("0.95"); reset(); }

  return (
    <Section title="F. Confidence Interval → Standard Error" description="SE = (upper − lower) / (2 × z), for a selectable confidence level.">
      <div className="grid sm:grid-cols-4 gap-3">
        <NumField label="Estimate" value={estimate} onChange={setEstimate} />
        <NumField label="Lower CI" value={lower} onChange={setLower} />
        <NumField label="Upper CI" value={upper} onChange={setUpper} />
        <div>
          <label htmlFor="ci-level-1" className="block text-xs text-[var(--text-tertiary)] mb-1">Confidence level</label>
          <select id="ci-level-1" value={level} onChange={(e) => setLevel(e.target.value)} className="w-full bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]">
            <option value="0.90">90%</option>
            <option value="0.95">95%</option>
            <option value="0.99">99%</option>
          </select>
        </div>
      </div>
      <div className="flex gap-3"><CalcButton onClick={calc} /><ResetButton onClick={doReset} /></div>
      <ErrorNote message={error} />
      {result && <ResultCard result={result} />}
    </Section>
  );
}

// --- G. Estimate + SE -> CI --------------------------------------------------------
function EstimateSEToCISection({ onResult }: { onResult: (tool: string, r: ConversionResult) => void }) {
  const [estimate, setEstimate] = useState("");
  const [se, setSe] = useState("");
  const [level, setLevel] = useState("0.95");
  const { result, error, run, reset } = useConversion();

  function calc() {
    run(() => {
      const r = estimateSEToCI(parseFloat(estimate), parseFloat(se), parseFloat(level));
      onResult("Estimate+SE → CI", r);
      return r;
    });
  }
  function doReset() { setEstimate(""); setSe(""); setLevel("0.95"); reset(); }

  return (
    <Section title="G. Estimate + SE → Confidence Interval" description="CI = estimate ± z × SE, for a selectable confidence level.">
      <div className="grid sm:grid-cols-3 gap-3">
        <NumField label="Estimate" value={estimate} onChange={setEstimate} />
        <NumField label="SE" value={se} onChange={setSe} />
        <div>
          <label htmlFor="ci-level-2" className="block text-xs text-[var(--text-tertiary)] mb-1">Confidence level</label>
          <select id="ci-level-2" value={level} onChange={(e) => setLevel(e.target.value)} className="w-full bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]">
            <option value="0.90">90%</option>
            <option value="0.95">95%</option>
            <option value="0.99">99%</option>
          </select>
        </div>
      </div>
      <div className="flex gap-3"><CalcButton onClick={calc} /><ResetButton onClick={doReset} /></div>
      <ErrorNote message={error} />
      {result && <ResultCard result={result} />}
    </Section>
  );
}

// --- H. SD + n -> SE -----------------------------------------------------------------
function SDToSESection({ onResult }: { onResult: (tool: string, r: ConversionResult) => void }) {
  const [sd, setSd] = useState("");
  const [n, setN] = useState("");
  const { result, error, run, reset } = useConversion();

  function calc() {
    run(() => {
      const r = sdToSE(parseFloat(sd), parseInt(n, 10));
      onResult("SD+n → SE", r);
      return r;
    });
  }
  function doReset() { setSd(""); setN(""); reset(); }

  return (
    <Section title="H. SD + n → Standard Error" description="SE = SD / √n.">
      <div className="grid sm:grid-cols-2 gap-3">
        <NumField label="SD" value={sd} onChange={setSd} />
        <NumField label="Sample size (n)" value={n} onChange={setN} />
      </div>
      <div className="flex gap-3"><CalcButton onClick={calc} /><ResetButton onClick={doReset} /></div>
      <ErrorNote message={error} />
      {result && <ResultCard result={result} />}
    </Section>
  );
}

// --- I. SE + n -> SD -----------------------------------------------------------------
function SEToSDSection({ onResult }: { onResult: (tool: string, r: ConversionResult) => void }) {
  const [se, setSe] = useState("");
  const [n, setN] = useState("");
  const { result, error, run, reset } = useConversion();

  function calc() {
    run(() => {
      const r = seToSD(parseFloat(se), parseInt(n, 10));
      onResult("SE+n → SD", r);
      return r;
    });
  }
  function doReset() { setSe(""); setN(""); reset(); }

  return (
    <Section title="I. SE + n → SD" description="SD = SE × √n.">
      <div className="grid sm:grid-cols-2 gap-3">
        <NumField label="SE" value={se} onChange={setSe} />
        <NumField label="Sample size (n)" value={n} onChange={setN} />
      </div>
      <div className="flex gap-3"><CalcButton onClick={calc} /><ResetButton onClick={doReset} /></div>
      <ErrorNote message={error} />
      {result && <ResultCard result={result} />}
    </Section>
  );
}
