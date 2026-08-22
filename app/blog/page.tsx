import Link from 'next/link';
import { ArrowRight, BookOpenText } from 'lucide-react';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import GradientBlob from '../components/GradientBlob';

// No blog content exists in the project yet (verified before writing this
// page - no posts, no CMS, no content file anywhere in the repo). Rather
// than fabricate articles or leave the site's "Blog" nav link and the
// homepage's "Read Guides" card pointing at a 404, this is an honest
// "nothing published yet" state in the same design system, so the route is
// real and the destination truthful. Replace this file's content with real
// articles once they exist - do not backfill it with placeholder posts.
export const metadata = {
  title: "Blog & Guides — MetaWorld Research Academy",
  description: "Methodological explainers on systematic reviews and meta-analysis from MetaWorld Research Academy mentors.",
};

export default function Blog() {
  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)] font-sans flex flex-col">
      <Nav />

      <main className="relative flex-1 max-w-4xl mx-auto px-6 py-24 text-center">
        <GradientBlob className="w-96 h-96 top-0 left-1/2 -translate-x-1/2" variant="primary" />
        <div className="relative">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--purple-bright)] mb-8">
            <BookOpenText size={28} />
          </div>
          <p className="text-sm font-semibold tracking-widest uppercase text-[var(--purple-bright)] mb-4">Blog &amp; Practical Guides</p>
          <h1 className="text-3xl md:text-5xl font-bold mb-6">In-depth guides are on their way.</h1>
          <p className="text-[var(--text-secondary)] text-lg leading-relaxed max-w-xl mx-auto mb-10">
            We&apos;re preparing methodological explainers on PRISMA, GRADE, risk of bias, and meta-analysis from mentors
            who run systematic reviews every day. Nothing is published here yet — check back soon, or explore the
            tools and mentorship program in the meantime.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/tools"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-white font-semibold shadow-lg shadow-purple-950/30 hover:-translate-y-0.5 transition-all focus-visible:outline-2 focus-visible:outline-[var(--purple-bright)]"
              style={{ backgroundImage: "var(--gradient-primary)" }}
            >
              Explore Tools <ArrowRight size={17} />
            </Link>
            <Link
              href="/mentorship"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-[var(--border-subtle)] text-[var(--text-primary)] font-semibold hover:border-[var(--border-hover)] transition-colors"
            >
              Learn About Mentorship
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
