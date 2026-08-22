"use client";

import { useState } from "react";
import JSZip from "jszip";
import { loadPdfDocument, parsePageRange, renderPageToBlob, type Resolution } from "@/app/lib/fileConverter/pdf";
import { DropZone, DownloadLink, Busy, ErrText } from "./shared";

export default function PdfToImage({ format }: { format: "png" | "jpg" }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pdfRef, setPdfRef] = useState<Awaited<ReturnType<typeof loadPdfDocument>> | null>(null);
  const [selection, setSelection] = useState<"all" | "range">("all");
  const [rangeInput, setRangeInput] = useState("");
  const [resolution, setResolution] = useState<Resolution>("high");
  const [results, setResults] = useState<{ page: number; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(files: FileList) {
    const f = files[0];
    if (!f) return;
    setError(null);
    setResults([]);
    try {
      const pdf = await loadPdfDocument(f);
      setPdfRef(pdf);
      setFileName(f.name);
      setPageCount(pdf.numPages);
    } catch (err) {
      console.error("[file-converter] failed to load PDF:", err);
      setError("This file could not be read as a PDF. Please check it is a valid, non-corrupted PDF.");
    }
  }

  async function render() {
    if (!pdfRef) return;
    const pages = selection === "all" ? Array.from({ length: pageCount }, (_, i) => i + 1) : parsePageRange(rangeInput, pageCount);
    if (pages.length === 0) { setError("No valid pages selected."); return; }
    setBusy(true);
    setError(null);
    try {
      const out: { page: number; url: string }[] = [];
      for (const p of pages) {
        const blob = await renderPageToBlob(pdfRef, p, resolution, format);
        out.push({ page: p, url: URL.createObjectURL(blob) });
      }
      setResults(out);
    } catch (err) {
      console.error("[file-converter] PDF page rendering failed:", err);
      setError("One or more pages could not be rendered.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadZip() {
    const zip = new JSZip();
    for (const r of results) {
      const blob = await fetch(r.url).then((res) => res.blob());
      zip.file(`page-${r.page}.${format}`, blob);
    }
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pdf-pages.zip`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <DropZone accept="application/pdf" onFiles={handleFile} label="Drop a PDF here" />
      {fileName && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-tertiary)]">{fileName} — {pageCount} page{pageCount === 1 ? "" : "s"}</p>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5"><input type="radio" checked={selection === "all"} onChange={() => setSelection("all")} /> All pages</label>
            <label className="flex items-center gap-1.5"><input type="radio" checked={selection === "range"} onChange={() => setSelection("range")} /> Selected pages</label>
            {selection === "range" && (
              <input value={rangeInput} onChange={(e) => setRangeInput(e.target.value)} placeholder="e.g. 1-3,5" className="bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg px-2 py-1 text-xs w-32" aria-label="Page range" />
            )}
            <label htmlFor="pdf-res" className="ml-2">Resolution</label>
            <select id="pdf-res" value={resolution} onChange={(e) => setResolution(e.target.value as Resolution)} className="bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg px-2 py-1 text-xs">
              <option value="standard">Standard</option>
              <option value="high">High</option>
              <option value="publication">Publication (high-res)</option>
            </select>
            <button onClick={render} className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold" style={{ backgroundImage: "var(--gradient-primary)" }}>Render</button>
          </div>
        </div>
      )}
      {busy && <Busy label="Rendering pages…" />}
      {error && <ErrText>{error}</ErrText>}
      {results.length > 0 && (
        <div className="space-y-2">
          {results.length > 1 && <button onClick={downloadZip} className="text-xs font-medium text-[var(--purple-bright)] hover:underline">Download all as ZIP ({results.length} pages)</button>}
          <div className="grid sm:grid-cols-3 gap-2">
            {results.map((r) => (
              <div key={r.page} className="rounded-lg bg-[var(--bg-void)] p-2 text-xs space-y-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.url} alt={`Page ${r.page}`} className="w-full h-24 object-contain bg-white rounded" />
                <div className="flex items-center justify-between"><span className="text-[var(--text-tertiary)]">Page {r.page}</span><DownloadLink href={r.url} filename={`page-${r.page}.${format}`} label="Download" /></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
