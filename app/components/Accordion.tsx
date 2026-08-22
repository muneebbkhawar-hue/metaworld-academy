"use client";

// Shared expandable section/card - used by Statistical Conversions and
// File Converter (and reusable by future tools) so accordion-style tool
// interfaces look and behave consistently across the app.
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function Accordion({
  title, description, icon, defaultOpen = false, children,
}: {
  title: string;
  description: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">{title}</h3>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{description}</p>
          </div>
        </div>
        {open ? <ChevronUp size={18} className="text-[var(--text-tertiary)] flex-shrink-0" /> : <ChevronDown size={18} className="text-[var(--text-tertiary)] flex-shrink-0" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-4">{children}</div>}
    </div>
  );
}
