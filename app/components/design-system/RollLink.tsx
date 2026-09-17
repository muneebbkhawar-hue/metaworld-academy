"use client";

// The signature hover interaction for the Swiss-modernist design system.
// Renders its label twice, stacked inside an overflow-hidden wrapper: on
// hover (or keyboard focus) the first copy rolls up and out while the
// second rolls up and in from below. Both copies live in the DOM at all
// times - only the duplicate is aria-hidden, so screen readers announce
// the link once, not twice.
//
// Timing/easing (400ms, cubic-bezier(0.65, 0, 0.35, 1)) lives in Tailwind
// arbitrary values here rather than a named globals.css class, since this
// is the one component that owns this exact motion. prefers-reduced-motion
// is handled globally in globals.css (the wildcard transition-duration
// override applies to this component's transitions too - no separate
// opt-out needed here).
import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";

interface RollLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "children"> {
  href: string;
  children: ReactNode;
}

const EASE = "[transition-timing-function:cubic-bezier(0.65,0,0.35,1)]";

export default function RollLink({ href, children, className = "", ...rest }: RollLinkProps) {
  return (
    <Link
      href={href}
      {...rest}
      className={`group relative inline-block overflow-hidden align-top ${className}`}
    >
      <span
        className={`block transition-transform duration-[400ms] ${EASE} group-hover:-translate-y-full group-focus-visible:-translate-y-full`}
      >
        {children}
      </span>
      <span
        aria-hidden="true"
        className={`absolute inset-0 block translate-y-full transition-transform duration-[400ms] ${EASE} group-hover:translate-y-0 group-focus-visible:translate-y-0`}
      >
        {children}
      </span>
    </Link>
  );
}
