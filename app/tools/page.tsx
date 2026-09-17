"use client";

// Tools Dashboard - renders entirely from the centralized registry in
// app/lib/toolsRegistry.ts. No tool route, backend, or statistical logic is
// touched here; this file is presentation only. Adding a future tool never
// requires editing this file - see toolsRegistry.ts's header comment.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search, Lock } from 'lucide-react';
import NavComp from '../components/Nav';
import Footer from '../components/Footer';
import GradientBlob from '../components/GradientBlob';
import FadeIn from '../components/FadeIn';
import { TOOLS, CATEGORIES, type Tool, type CategoryKey } from '../lib/toolsRegistry';

function ToolCard({ tool, index }: { tool: Tool; index: number }) {
  return (
    <FadeIn delay={index * 0.04}>
      <Link
        href={tool.route}
        className="group block h-full border border-[var(--grey-2)] bg-[var(--off-black)] p-7 hover:border-[var(--purple-glow)] hover:-translate-y-1 transition-all duration-300 flex flex-col"
      >
        <div className="flex items-center justify-between mb-5">
          <span className="label-text">{tool.n}</span>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white opacity-90 group-hover:opacity-100 transition-opacity"
            style={{ backgroundImage: "var(--gradient-primary)" }}
          >
            <tool.icon size={18} aria-hidden="true" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2 tracking-tight group-hover:text-[var(--purple-glow)] transition-colors">{tool.name}</h3>
        <p className="body-copy !text-sm mb-5 flex-grow">{tool.description}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mb-6">
          {tool.tags.map(tag => (
            <span key={tag} className="label-text !text-[10px] text-[var(--accent)]">
              {tag}
            </span>
          ))}
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] group-hover:gap-2.5 transition-all mt-auto">
          <Lock size={13} aria-hidden="true" /> Request Access <ArrowRight size={15} aria-hidden="true" />
        </span>
      </Link>
    </FadeIn>
  );
}

export default function ToolsDashboard() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return null; // null = "no active search", render by category section instead
    return TOOLS.filter(t => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.tags.some(tag => tag.toLowerCase().includes(q)));
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<CategoryKey, Tool[]>();
    for (const cat of CATEGORIES) map.set(cat.key, TOOLS.filter(t => t.category === cat.key));
    return map;
  }, []);

  return (
    <div className="relative min-h-screen bg-[var(--black)] text-white font-sans overflow-hidden">
      <GradientBlob className="w-[32rem] h-[32rem] -top-40 -right-40" variant="secondary" />
      <NavComp />

      <main className="relative container-grid py-16">
        <div className="col-span-12">
          <FadeIn>
            <p className="label-text mb-4 text-[var(--accent)]">✦ Research Tools</p>
            <h1 className="section-heading mb-4">Research Tools</h1>
            <p className="body-copy mb-10">
              Statistical analysis, evidence synthesis, data processing, and research utilities - organized around the actual
              workflow of a systematic review: obtain data, synthesize evidence, assess bias and certainty, then export.
            </p>
          </FadeIn>

          <FadeIn delay={0.05}>
            <div className="relative max-w-sm mb-12">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--grey-1)]" aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search research tools…"
                aria-label="Search research tools"
                className="w-full bg-transparent border border-[var(--grey-2)] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-[var(--grey-1)] focus:outline-none focus:border-white transition-colors"
              />
            </div>
          </FadeIn>

          {filtered !== null ? (
            // Search is active - show a flat, ungrouped result grid across all categories.
            filtered.length === 0 ? (
              <p className="label-text py-12 text-center">No tools match &quot;{query}&quot;.</p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--grey-2)] border border-[var(--grey-2)]">
                {filtered.map((tool, i) => <ToolCard key={tool.id} tool={tool} index={i} />)}
              </div>
            )
          ) : (
            // No active search - organize tools into their category sections,
            // which is what makes the intended research workflow legible.
            <div className="space-y-16">
              {CATEGORIES.map((cat, ci) => {
                const tools = grouped.get(cat.key) ?? [];
                if (tools.length === 0) return null;
                return (
                  <FadeIn key={cat.key} delay={ci * 0.03}>
                    <section aria-labelledby={`category-${cat.key}`}>
                      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
                        <h2 id={`category-${cat.key}`} className="text-xl font-semibold text-white tracking-tight">{cat.label}</h2>
                        <span className="label-text">{tools.length} tool{tools.length === 1 ? "" : "s"}</span>
                      </div>
                      <p className="body-copy !text-sm mb-6">{cat.description}</p>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--grey-2)] border border-[var(--grey-2)]">
                        {tools.map((tool, i) => <ToolCard key={tool.id} tool={tool} index={i} />)}
                      </div>
                    </section>
                  </FadeIn>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
