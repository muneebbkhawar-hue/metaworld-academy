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
import FadeIn from '../components/FadeIn';
import { TOOLS, CATEGORIES, type Tool, type CategoryKey } from '../lib/toolsRegistry';

const TAG_STYLE: Record<string, string> = {
  AI: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  Gemini: "bg-sky-500/10 text-sky-300 border-sky-500/30",
};
const DEFAULT_TAG_STYLE = "bg-[var(--bg-surface-2)] text-[var(--text-tertiary)] border-[var(--border-subtle)]";

function ToolCard({ tool, index }: { tool: Tool; index: number }) {
  return (
    <FadeIn delay={index * 0.04}>
      <Link
        href={tool.route}
        className="group block h-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-7 hover:border-[var(--border-hover)] hover:-translate-y-1 transition-all duration-300 flex flex-col focus-visible:outline-2 focus-visible:outline-[var(--purple-bright)]"
      >
        <div className="flex items-center justify-between mb-5">
          <span className="text-xs font-mono font-bold tracking-widest text-[var(--text-tertiary)]">{tool.n}</span>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] text-[var(--purple-bright)] group-hover:border-[var(--border-hover)] transition-colors">
            <tool.icon size={18} aria-hidden="true" />
          </div>
        </div>
        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2 group-hover:text-[var(--purple-bright)] transition-colors">{tool.name}</h3>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-5 flex-grow">{tool.description}</p>
        <div className="flex flex-wrap gap-1.5 mb-6">
          {tool.tags.map(tag => (
            <span key={tag} className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md border ${TAG_STYLE[tag] ?? DEFAULT_TAG_STYLE}`}>
              {tag}
            </span>
          ))}
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--purple-bright)] group-hover:gap-2.5 transition-all mt-auto">
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
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)] font-sans">
      <NavComp />

      <main className="max-w-6xl mx-auto px-6 py-16">
        <FadeIn>
          <p className="text-sm font-semibold tracking-widest uppercase text-[var(--purple-bright)] mb-4">✦ Research Tools</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Research Tools</h1>
          <p className="text-[var(--text-secondary)] max-w-2xl mb-10">
            Statistical analysis, evidence synthesis, data processing, and research utilities - organized around the actual
            workflow of a systematic review: obtain data, synthesize evidence, assess bias and certainty, then export.
          </p>
        </FadeIn>

        <FadeIn delay={0.05}>
          <div className="relative max-w-sm mb-12">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search research tools…"
              aria-label="Search research tools"
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--border-hover)] transition-colors"
            />
          </div>
        </FadeIn>

        {filtered !== null ? (
          // Search is active - show a flat, ungrouped result grid across all categories.
          filtered.length === 0 ? (
            <p className="text-[var(--text-tertiary)] text-sm py-12 text-center">No tools match &quot;{query}&quot;.</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                      <h2 id={`category-${cat.key}`} className="text-xl font-bold text-[var(--text-primary)]">{cat.label}</h2>
                      <span className="text-xs font-mono text-[var(--text-tertiary)]">{tools.length} tool{tools.length === 1 ? "" : "s"}</span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] max-w-2xl mb-6">{cat.description}</p>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {tools.map((tool, i) => <ToolCard key={tool.id} tool={tool} index={i} />)}
                    </div>
                  </section>
                </FadeIn>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
