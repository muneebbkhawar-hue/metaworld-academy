// Shared PDF.js loading/rendering/text-extraction helpers - entirely
// client-side (pdfjs-dist runs in the browser via WebAssembly-free JS +
// a Web Worker, no server round trip, no upload). Used by Utilities C, D,
// F, and G (PDF -> PNG/JPG/Word/Markdown).
"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";

let workerConfigured = false;

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    workerConfigured = true;
  }
  return pdfjs;
}

export async function loadPdfDocument(file: File) {
  const pdfjs = await loadPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const task = pdfjs.getDocument({ data: arrayBuffer });
  return task.promise;
}

/** Parses a page-selection string like "1-3,5,8" into a sorted, deduplicated, in-range page-number array (1-indexed). */
export function parsePageRange(input: string, maxPages: number): number[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const pages = new Set<number>();
  for (const part of trimmed.split(",")) {
    const p = part.trim();
    if (!p) continue;
    const rangeMatch = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      for (let i = Math.min(start, end); i <= Math.max(start, end); i++) if (i >= 1 && i <= maxPages) pages.add(i);
    } else if (/^\d+$/.test(p)) {
      const n = parseInt(p, 10);
      if (n >= 1 && n <= maxPages) pages.add(n);
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
}

export type Resolution = "standard" | "high" | "publication";
const RESOLUTION_SCALE: Record<Resolution, number> = { standard: 1.5, high: 2.5, publication: 4 };

export async function renderPageToBlob(pdf: PDFDocumentProxy, pageNum: number, resolution: Resolution, format: "png" | "jpg", quality = 0.92): Promise<Blob> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: RESOLUTION_SCALE[resolution] });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is not available in this browser.");
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Page rendering failed."))), format === "jpg" ? "image/jpeg" : "image/png", format === "jpg" ? quality : undefined);
  });
}

export interface TextItemInfo {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontName: string;
}

export interface PageTextResult {
  pageNum: number;
  items: TextItemInfo[];
  links: { url: string; text: string }[];
}

export async function extractPageText(pdf: PDFDocumentProxy, pageNum: number): Promise<PageTextResult> {
  const page = await pdf.getPage(pageNum);
  const content = await page.getTextContent();
  const items: TextItemInfo[] = content.items
    .filter((it): it is typeof it & { str: string; transform: number[] } => "str" in it)
    .map((it) => ({
      text: it.str,
      x: it.transform[4],
      y: it.transform[5],
      fontSize: Math.hypot(it.transform[0], it.transform[1]) || 1,
      fontName: "fontName" in it ? String(it.fontName) : "",
    }));

  const annotations = await page.getAnnotations();
  const links = annotations
    .filter((a) => a.subtype === "Link" && a.url)
    .map((a) => ({ url: String(a.url), text: "" }));

  return { pageNum, items, links };
}

/** Rough heuristic: a page with very little extractable text relative to its
 * area is probably a scanned image rather than real text content. Used to
 * honestly warn the user rather than silently producing an empty/misleading
 * Word document or Markdown file. */
export function isLikelyScanned(pages: PageTextResult[]): boolean {
  const totalChars = pages.reduce((sum, p) => sum + p.items.reduce((s, it) => s + it.text.trim().length, 0), 0);
  const avgCharsPerPage = pages.length > 0 ? totalChars / pages.length : 0;
  return avgCharsPerPage < 40;
}
