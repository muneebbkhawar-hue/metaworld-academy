"use client";

// Small reusable scroll-entrance wrapper built on framer-motion (already a
// project dependency - no new library added for this). Kept deliberately
// generic (fade + gentle rise) rather than a large animation-variant
// system, since the brief calls for restrained, sub-500ms entrances, not a
// showcase of motion effects. `once` is always true so re-scrolling past a
// section never re-triggers it.
import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}

export default function FadeIn({ children, delay = 0, className, y = 16 }: FadeInProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduceMotion ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
