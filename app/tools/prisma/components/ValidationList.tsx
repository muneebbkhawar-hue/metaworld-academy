"use client";

import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { ValidationMessage } from "@/app/lib/prisma/types";

const STYLES: Record<ValidationMessage["severity"], { icon: typeof AlertCircle; cls: string; label: string }> = {
  error: { icon: AlertCircle, cls: "bg-rose-500/10 text-rose-300 border-rose-500/25", label: "Error" },
  warning: { icon: AlertTriangle, cls: "bg-amber-500/10 text-amber-300 border-amber-500/25", label: "Warning" },
  info: { icon: Info, cls: "bg-sky-500/10 text-sky-300 border-sky-500/25", label: "Info" },
};

// role="alert" region so errors are announced by screen readers, per the
// brief's accessibility requirement — color is never the only signal (each
// message also carries an icon and a text severity label).
export default function ValidationList({ messages }: { messages: ValidationMessage[] }) {
  if (messages.length === 0) return null;
  const ordered = [...messages].sort((a, b) => {
    const rank = { error: 0, warning: 1, info: 2 };
    return rank[a.severity] - rank[b.severity];
  });
  return (
    <div className="space-y-2" role="alert" aria-live="polite">
      {ordered.map((m) => {
        const { icon: Icon, cls, label } = STYLES[m.severity];
        return (
          <div key={m.id} className={`flex items-start gap-2 text-sm border rounded-lg px-3 py-2 ${cls}`}>
            <Icon size={16} className="shrink-0 mt-0.5" />
            <span><span className="font-semibold">{label}:</span> {m.message}</span>
          </div>
        );
      })}
    </div>
  );
}
