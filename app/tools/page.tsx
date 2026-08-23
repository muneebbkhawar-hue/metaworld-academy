"use client";

// Tools Dashboard - visual shell only. Every card below links to a route
// that actually exists in app/tools/** (verified by inspection before
// writing this file: synthesis, bias, grade, sensitivity, tsa,
// network-meta-analysis, meta-regression). No route is renamed, removed,
// or invented, and none of the individual tool pages/components this
// dashboard links to were touched in this redesign.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Filter, ShieldCheck, RotateCcw, Activity, ScatterChart, Network, ArrowRight, Search, FileSearch, Calculator, LayoutGrid, Files, Database, LineChart, Lock } from 'lucide-react';
import NavComp from '../components/Nav';
import Footer from '../components/Footer';
import FadeIn from '../components/FadeIn';

type Category = "All" | "Pairwise Meta-Analysis" | "Network Meta-Analysis" | "Evidence Synthesis" | "Risk of Bias" | "Research Utilities";

interface Tool {
  n: string;
  title: string;
  category: Exclude<Category, "All">;
  desc: string;
  href: string;
  icon: typeof BarChart3;
}

const TOOLS: Tool[] = [
  {
    n: "01", title: "Forest Plot Generator", category: "Pairwise Meta-Analysis", href: "/tools/synthesis", icon: BarChart3,
    desc: "Cochrane-aligned R precision modeling for Dichotomous, Continuous, and Generic Inverse Variance forest plots.",
  },
  {
    n: "02", title: "Funnel Plot & Publication Bias", category: "Pairwise Meta-Analysis", href: "/tools/bias", icon: Filter,
    desc: "Color-coded study points, side study legends, Egger's linear regression test, and contour-enhanced funnel plots.",
  },
  {
    n: "03", title: "GRADE Evidence Profile", category: "Evidence Synthesis", href: "/tools/grade", icon: ShieldCheck,
    desc: "Build Cochrane-style GRADE evidence profiles with automatic certainty ratings.",
  },
  {
    n: "04", title: "Sensitivity Analysis", category: "Pairwise Meta-Analysis", href: "/tools/sensitivity", icon: RotateCcw,
    desc: "Perform leave-one-out influence diagnostics and criteria-based study exclusions.",
  },
  {
    n: "05", title: "Trial Sequential Analysis", category: "Pairwise Meta-Analysis", href: "/tools/tsa", icon: Activity,
    desc: "Cumulative Z-curve with sequential monitoring boundaries and required information size, powered by the R RTSA package.",
  },
  {
    n: "06", title: "Network Meta-Analysis", category: "Network Meta-Analysis", href: "/tools/network-meta-analysis", icon: Network,
    desc: "Frequentist NMA with network geometry, league table, treatment ranking, diagnostics, subgroup/meta-regression, transitivity, and a CINeMA-assisted certainty workflow.",
  },
  {
    n: "07", title: "Pairwise Meta-Regression", category: "Pairwise Meta-Analysis", href: "/tools/meta-regression", icon: ScatterChart,
    desc: "Investigate study-level moderators of treatment effect with univariable and multivariable meta-regression, powered by the R metafor package.",
  },
  {
    n: "08", title: "AI-Assisted Risk of Bias Assessment", category: "Risk of Bias", href: "/tools/risk-of-bias", icon: FileSearch,
    desc: "Upload study PDFs and get AI-assisted, evidence-grounded RoB 2, ROBINS-I, or QUADAS-2 assessments with human-reviewable judgments and publication-style plots.",
  },
  {
    n: "09", title: "Statistical Conversions", category: "Research Utilities", href: "/tools/statistical-conversions", icon: Calculator,
    desc: "Convert between median/IQR/range and mean/SD, CI and SE, and ratio effect measures - every result labeled exact, estimated, or assumption-based.",
  },
  {
    n: "10", title: "Collage Maker", category: "Research Utilities", href: "/tools/collage-maker", icon: LayoutGrid,
    desc: "Arrange multiple figures into a publication-ready collage with panel labels and captions, entirely in your browser.",
  },
  {
    n: "11", title: "PDF / Word / Image Utilities", category: "Research Utilities", href: "/tools/file-converter", icon: Files,
    desc: "Convert between JPG/PNG, render PDF pages as images, and convert between PDF, Word, and Markdown for manuscript preparation.",
  },
  {
    n: "12", title: "Meta-Analysis Data Extraction", category: "Research Utilities", href: "/tools/data-extraction", icon: Database,
    desc: "AI-assisted, evidence-grounded extraction of study characteristics, baseline variables, and clinical outcomes from included-study PDFs into a review-ready Excel/CSV extraction sheet.",
  },
  {
    n: "13", title: "Kaplan–Meier Curve Digitizer", category: "Research Utilities", href: "/tools/km-digitizer", icon: LineChart,
    desc: "Digitize survival curves and reconstruct survival data for meta-analysis.",
  },
];

const CATEGORIES: Category[] = ["All", "Pairwise Meta-Analysis", "Network Meta-Analysis", "Evidence Synthesis", "Risk of Bias", "Research Utilities"];

export default function ToolsDashboard() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All");

  const filtered = useMemo(() => {
    return TOOLS.filter(t => {
      const matchesCategory = category === "All" || t.category === category;
      const q = query.trim().toLowerCase();
      const matchesQuery = q === "" || t.title.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [query, category]);

  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)] font-sans">
      <NavComp />

      <main className="max-w-6xl mx-auto px-6 py-16">
        <FadeIn>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Tools</h1>
          <p className="text-[var(--text-secondary)] max-w-2xl mb-10">
            A growing suite of practical tools for systematic reviewers and meta-analysts. Choose a tool below to get started.
          </p>
        </FadeIn>

        <FadeIn delay={0.05}>
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search tools…"
                aria-label="Search tools"
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--border-hover)] transition-colors"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  aria-pressed={category === c}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-colors focus-visible:outline-2 focus-visible:outline-[var(--purple-bright)] ${
                    category === c
                      ? "text-white border-transparent"
                      : "text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
                  }`}
                  style={category === c ? { backgroundImage: "var(--gradient-primary)" } : undefined}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </FadeIn>

        {filtered.length === 0 ? (
          <p className="text-[var(--text-tertiary)] text-sm py-12 text-center">No tools match your search.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((tool, i) => (
              <FadeIn key={tool.href} delay={i * 0.05}>
                <Link
                  href={tool.href}
                  className="group block h-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-7 hover:border-[var(--border-hover)] hover:-translate-y-1 transition-all duration-300 flex flex-col"
                >
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-xs font-mono font-bold tracking-widest text-[var(--text-tertiary)]">{tool.n}</span>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] text-[var(--purple-bright)] group-hover:border-[var(--border-hover)] transition-colors">
                      <tool.icon size={18} />
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold tracking-widest uppercase text-[var(--purple-bright)] mb-2">{tool.category}</span>
                  <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2 group-hover:text-[var(--purple-bright)] transition-colors">{tool.title}</h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6 flex-grow">{tool.desc}</p>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--purple-bright)] group-hover:gap-2.5 transition-all">
                    <Lock size={13} /> Request Access <ArrowRight size={15} />
                  </span>
                </Link>
              </FadeIn>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
