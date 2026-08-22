import Link from 'next/link';
import { ArrowRight, Users, Wrench, FileCheck, MessageSquareText, Presentation, Globe2 } from 'lucide-react';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import GradientBlob from '../components/GradientBlob';
import FadeIn from '../components/FadeIn';

const JOURNEY = [
  { n: "01", title: "Discover & Plan", desc: "Sharpen your question, eligibility criteria, and search strategy with one-on-one mentor sessions." },
  { n: "02", title: "Synthesise", desc: "Coached screening, extraction, risk of bias assessment, and meta-analysis using academy tools." },
  { n: "03", title: "Write", desc: "Manuscript structuring, PRISMA-compliant reporting, and rigorous internal review before submission." },
  { n: "04", title: "Publish & Present", desc: "Journal targeting, response to reviewers, and conference abstract coaching until you land the paper." },
];

const BENEFITS = [
  { icon: Users, title: "1:1 mentor sessions throughout your project" },
  { icon: Wrench, title: "Lifetime access to academy tools" },
  { icon: FileCheck, title: "Manuscript review before submission" },
  { icon: MessageSquareText, title: "Response-to-reviewer coaching" },
  { icon: Presentation, title: "Conference abstract & poster feedback" },
  { icon: Globe2, title: "Community of active reviewers worldwide" },
];

export default function Mentorship() {
  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)] font-sans">
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <GradientBlob className="w-[34rem] h-[34rem] -top-40 -right-40" variant="primary" />
        <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
          <FadeIn>
            <p className="text-sm font-semibold tracking-widest uppercase text-[var(--purple-bright)] mb-6">Mentorship Programme</p>
            <h1 className="text-4xl md:text-6xl font-bold leading-[1.1] tracking-tight mb-6">
              From a research question to your first international paper
            </h1>
            <p className="text-lg text-[var(--text-secondary)] leading-relaxed max-w-2xl mx-auto mb-10">
              We don&apos;t deliver a course and disappear. We mentor researchers hands-on — through every chapter of
              evidence synthesis — until you publish and present your work on a global stage.
            </p>
            <Link
              href="/tools"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold shadow-xl shadow-purple-950/40 hover:-translate-y-0.5 transition-all focus-visible:outline-2 focus-visible:outline-[var(--purple-bright)]"
              style={{ backgroundImage: "var(--gradient-primary)" }}
            >
              Try the tools first <ArrowRight size={18} />
            </Link>
          </FadeIn>
        </div>
      </section>

      {/* The Journey */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <FadeIn>
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-16 max-w-2xl mx-auto">
            A guided, four-stage path with a mentor by your side at every step.
          </h2>
        </FadeIn>

        <div className="grid md:grid-cols-4 gap-6 relative">
          <div className="hidden md:block absolute top-8 left-[12.5%] right-[12.5%] h-px" style={{ background: "linear-gradient(90deg, transparent, var(--purple-primary), var(--purple-primary), transparent)" }} aria-hidden="true" />
          {JOURNEY.map((stage, i) => (
            <FadeIn key={stage.n} delay={i * 0.1}>
              <div className="relative text-center">
                <div
                  className="relative z-10 w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-white font-bold text-xl mb-6 shadow-lg shadow-purple-950/40"
                  style={{ backgroundImage: "var(--gradient-primary)" }}
                >
                  {stage.n}
                </div>
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-3">{stage.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{stage.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* What You Get */}
      <section className="relative border-y border-[var(--border-subtle)] bg-[var(--bg-surface)] py-20">
        <div className="max-w-6xl mx-auto px-6">
          <FadeIn>
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">Everything you need to publish — and grow as a researcher.</h2>
            <p className="text-[var(--text-secondary)] text-center max-w-2xl mx-auto mb-16">
              Our mentees become independent reviewers. The programme ends not when a module finishes, but when
              your paper is accepted.
            </p>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENEFITS.map((b, i) => (
              <FadeIn key={b.title} delay={i * 0.06}>
                <div className="flex items-start gap-4 h-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-6 hover:border-[var(--border-hover)] transition-colors">
                  <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center bg-[var(--bg-void)] border border-[var(--border-subtle)] text-[var(--purple-bright)]">
                    <b.icon size={18} />
                  </div>
                  <p className="text-sm font-medium text-[var(--text-primary)] leading-snug pt-1.5">{b.title}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <FadeIn>
          <div className="relative overflow-hidden rounded-3xl border border-[var(--border-subtle)] p-12 md:p-16 text-center" style={{ background: "linear-gradient(160deg, var(--bg-surface-2) 0%, var(--bg-surface) 100%)" }}>
            <GradientBlob className="w-96 h-96 -top-32 -left-32" variant="secondary" />
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to start your review?</h2>
              <p className="text-[var(--text-secondary)] max-w-xl mx-auto mb-10">
                Join researchers from around the world being mentored through their first, or next, published meta-analysis.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="mailto:metaworldresearchacademy@gmail.com"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-white font-semibold shadow-xl shadow-purple-950/40 hover:-translate-y-0.5 transition-all focus-visible:outline-2 focus-visible:outline-[var(--purple-bright)]"
                  style={{ backgroundImage: "var(--gradient-primary)" }}
                >
                  Get in touch <ArrowRight size={18} />
                </a>
                <Link
                  href="/blog"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-[var(--border-subtle)] text-[var(--text-primary)] font-semibold hover:border-[var(--border-hover)] transition-colors"
                >
                  Read our guides
                </Link>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      <Footer />
    </div>
  );
}
