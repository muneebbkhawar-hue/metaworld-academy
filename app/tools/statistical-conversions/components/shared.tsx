"use client";

import { RotateCcw } from "lucide-react";

export function NumField({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const id = `f-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-[var(--text-tertiary)] mb-1">{label}</label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-hover)]"
      />
    </div>
  );
}

export function CalcButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-lg text-white font-semibold text-sm"
      style={{ backgroundImage: "var(--gradient-primary)" }}
    >
      Calculate
    </button>
  );
}

export function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)]"
    >
      <RotateCcw size={14} /> Reset
    </button>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-rose-300 bg-rose-500/5 border border-rose-500/20 rounded-lg px-3 py-2">{message}</p>;
}
