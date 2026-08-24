"use client";

// A collapsible outcome-result card that only mounts its (potentially
// large - a high-resolution base64 PNG plot) children while actually
// expanded. A native <details> element does NOT do this: closed <details>
// content stays in the DOM and any <img> inside it still decodes and holds
// memory. With many outcomes each holding a multi-MB plot image, that adds
// up fast and can crash the browser tab - a real production issue found
// via a live user report on the Funnel Plot tool (contour-enhanced funnel
// plots are larger than typical forest plots, making this the tool where
// it surfaced first, though the same risk existed on all three).
import { useState, type ReactNode } from "react";

interface Props {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

export default function LazyOutcomeCard({ summary, children, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-[#0b0c10] border border-slate-800 rounded-xl p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full text-left cursor-pointer text-sm font-medium text-white flex items-center gap-2">
        <span className="text-slate-500 text-xs">{open ? "▾" : "▸"}</span>
        {summary}
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}
