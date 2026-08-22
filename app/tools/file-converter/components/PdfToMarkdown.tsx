"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { loadPdfDocument, extractPageText, isLikelyScanned, type PageTextResult } from "@/app/lib/fileConverter/pdf";
import { pagesToMarkdown } from "@/app/lib/fileConverter/pdfToMarkdown";
import { DropZone, DownloadLink, Busy, ErrText, Warn } from "./shared";

export default function PdfToMarkdown() {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
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
      const pdf = await loadPdfDocument(f);
      const pages: PageTextResult[] = [];
      for (let i = 1; i <= pdf.numPages; i++) pages.push(await extractPageText(pdf, i));
      setScanned(isLikelyScanned(pages));
      setMarkdown(pagesToMarkdown(pages));
    } catch (err) {
      console.error("[file-converter] PDF -> Markdown failed:", err);
      setError("This PDF could not be processed.");
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
      <DropZone accept="application/pdf" onFiles={handleFile} label="Drop a PDF here" />
      {busy && <Busy label="Extracting text…" />}
      {error && <ErrText>{error}</ErrText>}
      {scanned && markdown && (
        <Warn>This PDF appears to be scanned/image-based and extraction confidence is low - the Markdown below may be sparse or empty. OCR is not currently implemented for this tool.</Warn>
      )}
      {markdown && (
        <div className="space-y-2">
          <div className="flex gap-3">
            <button onClick={copy} className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--purple-bright)] hover:underline">
              {copied ? <Check size={13} /> : <Copy size={13} />} Copy Markdown
            </button>
            {blobUrl && <DownloadLink href={blobUrl} filename="extracted.md" label="Download .md" />}
          </div>
          <textarea readOnly value={markdown} rows={14} className="w-full bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs font-mono text-[var(--text-secondary)]" />
        </div>
      )}
    </div>
  );
}
