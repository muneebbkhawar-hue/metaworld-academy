"use client";

// Animates a stat value from 0 to its real target once, when scrolled into
// view. No dependency on framer-motion for the counting itself (a plain
// rAF loop is lighter for this one job); IntersectionObserver triggers it
// exactly once (`triggered` ref) so re-scrolling past it never restarts
// the count. Respects prefers-reduced-motion by jumping straight to the
// final value instead of animating.
import { useEffect, useRef, useState } from 'react';

interface StatCounterProps {
  value: number;
  suffix?: string;
  label: string;
  duration?: number;
}

export default function StatCounter({ value, suffix = "", label, duration = 1400 }: StatCounterProps) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);
  const triggered = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const animate = () => {
      if (triggered.current) return;
      triggered.current = true;
      if (prefersReducedMotion) { setDisplay(value); return; }
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        setDisplay(Math.round(eased * value));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) animate();
    }, { threshold: 0.4 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, duration]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
        {display}{suffix}
      </div>
      <div className="mt-2 text-sm text-[var(--text-secondary)] font-medium tracking-wide uppercase">{label}</div>
    </div>
  );
}
