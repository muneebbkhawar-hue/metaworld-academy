// SERVER-SIDE PDF text extraction, used only by verification.ts to
// deterministically check the AI's evidence quotes against the PDF's real
// text. This is deliberately a SEPARATE module from
// app/lib/fileConverter/pdf.ts, which is "use client" and relies on a
// browser Worker + Canvas - neither exists in a Next.js API route. This
// file uses pdfjs-dist's "legacy" build (already a project dependency, no
// new package added), which runs its parsing synchronously in the main
// thread when no Worker global is available, exactly as intended for
// Node/server environments.
export interface ServerPageText {
  pageNum: number;
  text: string; // all text items on the page, joined with spaces
}

// pdfjs-dist's Node fallback ("fake worker") normally locates its worker
// module by dynamically import()-ing GlobalWorkerOptions.workerSrc (a path
// string) at runtime. That resolution breaks once this file is compiled
// into a bundled server chunk (Turbopack/webpack) - the bundled chunk's
// on-disk location no longer matches pdfjs-dist's relative lookup, causing
// "Cannot find module ... pdf.worker.mjs" even though the package is very
// much installed. Fix: statically import the worker module ourselves (a
// normal import a bundler CAN follow and include) and register it on
// globalThis.pdfjsWorker - pdfjs's fake-worker setup checks that global
// FIRST, before ever attempting the dynamic path-based import, so the
// broken code path is never reached at all.
import * as pdfjsWorkerModule from "pdfjs-dist/legacy/build/pdf.worker.mjs";

let cachedLoader: typeof import("pdfjs-dist/legacy/build/pdf.mjs") | null = null;
async function loadPdfjsLegacy() {
  if (!cachedLoader) {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    (globalThis as unknown as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorkerModule;
    cachedLoader = pdfjs;
  }
  return cachedLoader;
}

/** Extracts plain text per page from a PDF buffer, server-side. Returns null
 * (rather than throwing) on any failure - callers must treat verification as
 * "unavailable" in that case, never as "quote confirmed false". */
export async function extractServerPdfText(buffer: Buffer): Promise<ServerPageText[] | null> {
  try {
    const pdfjs = await loadPdfjsLegacy();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false }).promise;
    const pages: ServerPageText[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.filter((it): it is typeof it & { str: string } => "str" in it).map((it) => it.str).join(" ");
      pages.push({ pageNum: i, text });
    }
    await doc.cleanup();
    return pages;
  } catch (err) {
    console.error("[extraction/serverPdfText] failed to extract PDF text for verification:", err instanceof Error ? err.message : err);
    return null;
  }
}
