"use client";

// Shared site navigation for the redesigned surfaces (Home, Mentorship,
// Tools Dashboard). Deliberately NOT wired into app/layout.tsx - the
// locked Publications page (and every existing tool page) already renders
// its own inline nav, and mounting a global nav in the root layout would
// visually change Publications, which is explicitly out of scope this
// session. Each redesigned page imports this component itself instead.
//
// Migrated onto the Swiss-modernist design system: black canvas, a single
// hairline border instead of a coloured/blurred one, RollLink for every
// text link, and the accent colour reserved for the one "Get Started" CTA
// (never for active-state text, which uses white + an underline instead).
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import RollLink from './design-system/RollLink';

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/tools", label: "Tools" },
  { href: "/mentorship", label: "Mentorship" },
  { href: "/publications", label: "Publications" },
  { href: "/blog", label: "Blog" },
  // Only present in the desktop-app build (see electron/README.md) - the
  // web build never sets NEXT_PUBLIC_IS_ELECTRON, so this link and the
  // /settings page it points to are invisible on the live website.
  ...(process.env.NEXT_PUBLIC_IS_ELECTRON === "1" ? [{ href: "/settings", label: "Settings" }] : []),
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--grey-2)] bg-[var(--black)]/95 backdrop-blur-lg">
      <div className="max-w-[1440px] mx-auto px-6 py-5 flex justify-between items-center">
        <Link href="/" className="text-lg font-semibold tracking-tight text-white hover:opacity-80 transition">
          MetaWorld <span className="font-normal text-[var(--grey-1)]">Research Academy</span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm">
          {LINKS.map(link => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <RollLink
                key={link.href}
                href={link.href}
                className={`py-1 label-text !text-xs ${active ? "text-white" : "text-[var(--grey-1)]"}`}
              >
                {link.label}
              </RollLink>
            );
          })}
          <Link
            href="/mentorship"
            className="px-5 py-2 border border-[var(--accent)] text-[var(--accent)] label-text !text-xs hover:bg-[var(--accent)] hover:text-black transition-colors"
          >
            Get Started
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="md:hidden text-white p-2 -mr-2 rounded"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-[var(--grey-2)] bg-[var(--black)] px-6 py-4 flex flex-col gap-1">
          {LINKS.map(link => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`py-3 text-base border-b border-[var(--grey-2)] last:border-b-0 ${active ? "text-white" : "text-[var(--grey-1)]"}`}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            href="/mentorship"
            onClick={() => setOpen(false)}
            className="mt-4 px-5 py-3 border border-[var(--accent)] text-[var(--accent)] label-text !text-xs text-center"
          >
            Get Started
          </Link>
        </div>
      )}
    </nav>
  );
}
