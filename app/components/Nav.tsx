"use client";

// Shared site navigation for the redesigned surfaces (Home, Mentorship,
// Tools Dashboard). Deliberately NOT wired into app/layout.tsx - the
// locked Publications page (and every existing tool page) already renders
// its own inline nav, and mounting a global nav in the root layout would
// visually change Publications, which is explicitly out of scope this
// session. Each redesigned page imports this component itself instead.
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/tools", label: "Tools" },
  { href: "/mentorship", label: "Mentorship" },
  { href: "/publications", label: "Publications" },
  { href: "/blog", label: "Blog" },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--bg-void)]/85 backdrop-blur-lg">
      <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
        <Link href="/" className="text-lg font-bold text-[var(--text-primary)] tracking-wide hover:opacity-90 transition">
          MetaWorld <span className="font-normal text-[var(--purple-bright)]">Research Academy</span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium">
          {LINKS.map(link => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative py-1 transition-colors focus-visible:outline-2 focus-visible:outline-[var(--purple-bright)] rounded ${active ? "text-[var(--purple-bright)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
              >
                {link.label}
                {active && <span className="absolute -bottom-1 left-0 right-0 h-px" style={{ background: "var(--gradient-primary)" }} />}
              </Link>
            );
          })}
          <Link
            href="/mentorship"
            className="px-5 py-2 rounded-lg text-white font-semibold text-sm shadow-lg shadow-purple-950/30 hover:opacity-90 transition focus-visible:outline-2 focus-visible:outline-[var(--purple-bright)]"
            style={{ backgroundImage: "var(--gradient-primary)" }}
          >
            Get Started
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="md:hidden text-[var(--text-primary)] p-2 -mr-2 focus-visible:outline-2 focus-visible:outline-[var(--purple-bright)] rounded"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-[var(--border-subtle)] bg-[var(--bg-void)] px-6 py-4 flex flex-col gap-1">
          {LINKS.map(link => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`py-3 text-base font-medium border-b border-[var(--border-subtle)] last:border-b-0 ${active ? "text-[var(--purple-bright)]" : "text-[var(--text-secondary)]"}`}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            href="/mentorship"
            onClick={() => setOpen(false)}
            className="mt-4 px-5 py-3 rounded-lg text-white font-semibold text-sm text-center shadow-lg"
            style={{ backgroundImage: "var(--gradient-primary)" }}
          >
            Get Started
          </Link>
        </div>
      )}
    </nav>
  );
}
