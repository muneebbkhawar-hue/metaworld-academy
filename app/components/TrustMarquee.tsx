// Seamless infinite marquee, transform-based (CSS keyframes in
// globals.css), no scroll listeners or JS animation loop. The track is
// duplicated once so translating by -50% loops seamlessly; pausing on
// hover and the prefers-reduced-motion fallback are both handled purely
// in CSS (.marquee-track). No "use client" needed - nothing here reacts
// to state.
const METHODOLOGIES = [
  "Cochrane Methodology",
  "PRISMA 2020",
  "JBI Evidence Synthesis",
  "GRADE Working Group",
  "Systematic Reviews Journal",
  "Campbell Collaboration",
  "BMJ Evidence-Based Medicine",
  "Methods in Medical Research",
];

export default function TrustMarquee() {
  const items = [...METHODOLOGIES, ...METHODOLOGIES];
  return (
    <div className="relative overflow-hidden border-y border-[var(--border-subtle)] bg-[var(--bg-surface)] py-8">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[var(--bg-surface)] to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[var(--bg-surface)] to-transparent z-10" />
      <div className="marquee-track flex w-max gap-12 whitespace-nowrap">
        {items.map((item, i) => (
          <span key={i} className="text-sm font-medium tracking-wider uppercase text-[var(--text-tertiary)]">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
