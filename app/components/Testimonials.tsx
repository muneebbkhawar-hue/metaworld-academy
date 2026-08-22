"use client";

// Accessible single-item testimonial carousel. Deliberately NOT a
// "duplicate everything in the DOM and scroll it" marquee - only the
// active testimonial (plus its immediate neighbors, for the swipe
// transition) is rendered, advanced by index. Supports autoplay (paused
// on hover/focus and when prefers-reduced-motion is set), prev/next
// buttons, dot navigation, arrow-key navigation, and touch swipe.
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface Testimonial {
  name: string;
  location: string;
  quote: string;
}

const AVATAR_GRADIENTS = [
  "from-purple-500 to-fuchsia-500",
  "from-violet-500 to-purple-600",
  "from-fuchsia-500 to-purple-500",
  "from-purple-600 to-violet-400",
];

function initials(name: string) {
  return name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
}

function Avatar({ name, index }: { name: string; index: number }) {
  return (
    <div
      aria-hidden="true"
      className={`w-14 h-14 rounded-full bg-gradient-to-br ${AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length]} flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-lg shadow-purple-950/40`}
    >
      {initials(name)}
    </div>
  );
}

export default function Testimonials({ items, autoplayMs = 6000 }: { items: Testimonial[]; autoplayMs?: number }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useReducedMotion();
  const touchStartX = useRef<number | null>(null);

  const go = useCallback((dir: 1 | -1) => {
    setIndex(i => (i + dir + items.length) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (paused || reduceMotion) return;
    const t = setInterval(() => go(1), autoplayMs);
    return () => clearInterval(t);
  }, [paused, reduceMotion, autoplayMs, go]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") go(-1);
    if (e.key === "ArrowRight") go(1);
  };

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 40) go(delta < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  const current = items[index];

  return (
    <div
      className="relative max-w-3xl mx-auto"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="region"
      aria-roledescription="carousel"
      aria-label="Mentee testimonials"
    >
      <div className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-8 py-10 md:px-14 md:py-14 min-h-[280px] flex items-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, x: reduceMotion ? 0 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduceMotion ? 0 : -24 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
            aria-live="polite"
          >
            <p className="text-lg md:text-xl text-[var(--text-primary)] leading-relaxed mb-8">&ldquo;{current.quote}&rdquo;</p>
            <div className="flex items-center gap-4">
              <Avatar name={current.name} index={index} />
              <div>
                <div className="font-semibold text-[var(--text-primary)]">{current.name}</div>
                <div className="text-sm text-[var(--text-tertiary)]">{current.location}</div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Previous testimonial"
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 hidden md:flex w-11 h-11 rounded-full bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] items-center justify-center text-[var(--text-secondary)] hover:text-white transition focus-visible:outline-2 focus-visible:outline-[var(--purple-bright)]"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label="Next testimonial"
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 hidden md:flex w-11 h-11 rounded-full bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] items-center justify-center text-[var(--text-secondary)] hover:text-white transition focus-visible:outline-2 focus-visible:outline-[var(--purple-bright)]"
      >
        <ChevronRight size={20} />
      </button>

      <div className="flex justify-center gap-2 mt-6">
        {items.map((t, i) => (
          <button
            key={t.name}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Go to testimonial from ${t.name}`}
            aria-current={i === index}
            className={`h-2 rounded-full transition-all focus-visible:outline-2 focus-visible:outline-[var(--purple-bright)] ${i === index ? "w-6 bg-[var(--purple-primary)]" : "w-2 bg-[var(--border-hover)]"}`}
          />
        ))}
      </div>

      <div className="flex md:hidden justify-center gap-4 mt-4">
        <button type="button" onClick={() => go(-1)} aria-label="Previous testimonial" className="w-10 h-10 rounded-full bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-secondary)]">
          <ChevronLeft size={18} />
        </button>
        <button type="button" onClick={() => go(1)} aria-label="Next testimonial" className="w-10 h-10 rounded-full bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-secondary)]">
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
