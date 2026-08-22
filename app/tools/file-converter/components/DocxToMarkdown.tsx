"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { docxToMarkdown } from "@/app/lib/fileConverter/docxToMarkdown";
import { DropZone, DownloadLink, Busy, ErrText, Warn } from "./shared";

export default function DocxToMarkdown() {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleFile(files: FileList) {
    const f = files[0];
    if (!f) return;
    setBusy(true);
    setError(null);
    setMarkdown(null);
    try {
      const { markdown, warnings } = await docxToMarkdown(f);
      setMarkdown(markdown);
      setWarnings(warnings);
    } catch (err) {
      console.error("[file-converter] DOCX -> Markdown failed:", err);
      setError("This DOCX file could not be processed. Please check it is a valid, non-corrupted .docx file.");
    } finally {
      setBusy(false);
    }
  }

  function copy() {
    if (!markdown) return;
    navigator.clipboard?.writeText(markdown).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  const blobUrl = markdown ? URL.createObjectURL(new Blob([markdown], { type: "text/markdown" })) : null;

  return (
    <div className="space-y-3">
      <DropZone accept=".docx" onFiles={handleFile} label="Drop a .docx file here" />
      {busy && <Busy label="Converting…" />}
      {error && <ErrText>{error}</ErrText>}
      {warnings.length > 0 && <Warn>{warnings.join(" ")}</Warn>}
      {markdown && (
        <div className="space-y-2">
          <div className="flex gap-3">
            <button onClick={copy} className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--purple-bright)] hover:underline">
              {copied ? <Check size={13} /> : <Copy size={13} />} Copy Markdown
            </button>
            {blobUrl && <DownloadLink href={blobUrl} filename="converted.md" label="Download .md" />}
          </div>
          <textarea readOnly value={markdown} rows={14} className="w-full bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs font-mono text-[var(--text-secondary)]" />
        </div>
      )}
    </div>
  );
}
