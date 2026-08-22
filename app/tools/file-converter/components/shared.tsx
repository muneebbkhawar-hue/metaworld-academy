"use client";

import { UploadCloud, Download, Loader2, AlertTriangle } from "lucide-react";

export function DropZone({
  accept, multiple = false, onFiles, label,
}: {
  accept: string;
  multiple?: boolean;
  onFiles: (files: FileList) => void;
  label: string;
}) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files); }}
      className="rounded-xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--bg-void)] p-6 text-center"
    >
      <UploadCloud size={22} className="mx-auto text-[var(--text-tertiary)] mb-2" />
      <p className="text-xs text-[var(--text-secondary)] mb-2">{label}</p>
      <label className="inline-block px-3 py-1.5 rounded-lg text-white text-xs font-medium cursor-pointer" style={{ backgroundImage: "var(--gradient-primary)" }}>
        Choose file{multiple ? "s" : ""}
        <input type="file" accept={accept} multiple={multiple} className="hidden" onChange={(e) => e.target.files && onFiles(e.target.files)} />
      </label>
    </div>
  );
}

export function DownloadLink({ href, filename, label }: { href: string; filename: string; label?: string }) {
  return (
    <a href={href} download={filename} className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--purple-bright)] hover:underline">
      <Download size={12} /> {label ?? `Download ${filename}`}
    </a>
  );
}

export function Busy({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
      <Loader2 size={13} className="animate-spin" /> {label}
    </div>
  );
}

export function Warn({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-amber-300 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 flex items-start gap-1.5">
      <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /> <span>{children}</span>
    </p>
  );
}

export function ErrText({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-rose-300 bg-rose-500/5 border border-rose-500/20 rounded-lg px-3 py-2">{children}</p>;
}
