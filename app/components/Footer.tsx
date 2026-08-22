import Link from 'next/link';
import { MessageCircle, Mail } from 'lucide-react';

// lucide-react (this project's icon set) doesn't ship brand/wordmark
// icons - these two small outline glyphs are hand-authored so the
// Instagram/LinkedIn links still get a recognizable icon without adding
// another icon library for two glyphs.
function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="7.5" y1="10.5" x2="7.5" y2="16.5" />
      <circle cx="7.5" cy="7" r="0.9" fill="currentColor" stroke="none" />
      <path d="M11.5 16.5v-4a2 2 0 0 1 4 0v4" />
      <line x1="11.5" y1="10.5" x2="11.5" y2="16.5" />
    </svg>
  );
}

const NAV_LINKS = [
  { href: "/tools", label: "Tools" },
  { href: "/mentorship", label: "Mentorship" },
  { href: "/publications", label: "Publications" },
  { href: "/blog", label: "Blog" },
];

const CONTACT_LINKS = [
  { href: "https://instagram.com/meta.worldacademy", label: "@meta.worldacademy", icon: InstagramIcon },
  { href: "https://www.linkedin.com/company/metaworld-research-academy", label: "MetaWorld Research Academy", icon: LinkedinIcon },
  { href: "https://wa.me/14847060248", label: "+1 484 706 0248", icon: MessageCircle },
  { href: "mailto:metaworldresearchacademy@gmail.com", label: "metaworldresearchacademy@gmail.com", icon: Mail },
];

export default function Footer() {
  return (
    <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-void)]">
      <div className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-12">
        <div>
          <div className="text-lg font-bold text-[var(--text-primary)] mb-3">
            MetaWorld <span className="font-normal text-[var(--purple-bright)]">Research Academy</span>
          </div>
          <p className="text-sm text-[var(--text-tertiary)] leading-relaxed max-w-xs">
            Mentoring systematic reviewers and meta-analysts from a vague question to a peer-reviewed paper.
          </p>
        </div>

        <div>
          <div className="text-xs font-semibold tracking-widest uppercase text-[var(--text-tertiary)] mb-4">Navigate</div>
          <ul className="space-y-3">
            {NAV_LINKS.map(l => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm text-[var(--text-secondary)] hover:text-[var(--purple-bright)] transition-colors">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="text-xs font-semibold tracking-widest uppercase text-[var(--text-tertiary)] mb-4">Get in Touch</div>
          <ul className="space-y-3">
            {CONTACT_LINKS.map(c => (
              <li key={c.label}>
                <a
                  href={c.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--purple-bright)] transition-colors"
                >
                  <c.icon size={16} aria-hidden="true" />
                  <span>{c.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-[var(--border-subtle)] py-6">
        <p className="text-center text-xs text-[var(--text-tertiary)]">
          © {new Date().getFullYear()} MetaWorld Research Academy. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
