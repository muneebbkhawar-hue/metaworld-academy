"use client";

import { useState } from "react";
import { loadPdfDocument, extractPageText, isLikelyScanned, type PageTextResult } from "@/app/lib/fileConverter/pdf";
import { pagesToDocxBlob } from "@/app/lib/fileConverter/pdfToDocx";
import { DropZone, DownloadLink, Busy, ErrText, Warn } from "./shared";

export default function PdfToWord() {
  const [result, setResult] = useState<{ url: string; name: string } | null>(null);
  const [scanned, setScanned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(files: FileList) {
    const f = files[0];
    if (!f) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const pdf = await loadPdfDocument(f);
      const pages: PageTextResult[] = [];
      for (let i = 1; i <= pdf.numPages; i++) pages.push(await extractPageText(pdf, i));
      const likelyScanned = isLikelyScanned(pages);
      setScanned(likelyScanned);
      const blob = await pagesToDocxBlob(pages);
      const name = f.name.replace(/\.pdf$/i, "") + ".docx";
      setResult({ url: URL.createObjectURL(blob), name });
    } catch (err) {
      console.error("[file-converter] PDF -> Word failed:", err);
      setError("This PDF could not be converted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Warn>PDF is a fixed-layout format - this preserves text, headings, and lists as well as technically possible, but does not reproduce exact page layout, fonts, or images.</Warn>
      <DropZone accept="application/pdf" onFiles={handleFile} label="Drop a PDF here" />
      {busy && <Busy label="Converting…" />}
      {error && <ErrText>{error}</ErrText>}
      {scanned && result && (
        <Warn>This PDF appears to be scanned/image-based and may require OCR - the generated document may contain little or no text. OCR is not currently implemented for this tool.</Warn>
      )}
      {result && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--bg-void)] px-3 py-2 text-xs">
          <span className="text-[var(--text-secondary)]">{result.name}</span>
          <DownloadLink href={result.url} filename={result.name} />
        </div>
      )}
    </div>
  );
}
