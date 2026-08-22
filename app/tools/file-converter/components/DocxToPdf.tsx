"use client";

import { useState } from "react";
import { docxToPdfBlob } from "@/app/lib/fileConverter/docxToPdf";
import { DropZone, DownloadLink, Busy, ErrText, Warn } from "./shared";

export default function DocxToPdf() {
  const [result, setResult] = useState<{ url: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(files: FileList) {
    const f = files[0];
    if (!f) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const blob = await docxToPdfBlob(f);
      const name = f.name.replace(/\.docx$/i, "") + ".pdf";
      setResult({ url: URL.createObjectURL(blob), name });
    } catch (err) {
      console.error("[file-converter] DOCX -> PDF failed:", err);
      setError("This DOCX file could not be converted. Please check it is a valid, non-corrupted .docx file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Warn>
        This renders the document&apos;s extracted content (text, headings, lists, tables) as HTML and converts that to
        PDF - it does not run Word/LibreOffice, so exact original layout, headers/footers, and complex styling are not
        guaranteed to be preserved. For pixel-perfect conversion, use Word&apos;s own &quot;Save as PDF&quot;.
      </Warn>
      <DropZone accept=".docx" onFiles={handleFile} label="Drop a .docx file here" />
      {busy && <Busy label="Converting…" />}
      {error && <ErrText>{error}</ErrText>}
      {result && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--bg-void)] px-3 py-2 text-xs">
          <span className="text-[var(--text-secondary)]">{result.name}</span>
          <DownloadLink href={result.url} filename={result.name} />
        </div>
      )}
    </div>
  );
}
