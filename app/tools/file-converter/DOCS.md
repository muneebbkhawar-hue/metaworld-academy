# PDF / Word / Image Utilities — developer notes

**Purpose:** manuscript-preparation file conversions. **Every utility runs entirely client-side** - no server route was added for any of them, no file is ever uploaded anywhere.

## Utilities and their libraries

| Utility | Library | Notes |
|---|---|---|
| JPG↔PNG | Canvas API (`imageConvert.ts`) | Lossless PNG, quality-controlled JPG, background fill for transparency |
| Image resize/compress | Canvas API | Aspect-lock, target width/height, quality |
| PDF→PNG/JPG | `pdfjs-dist` (Mozilla PDF.js) | Renders pages to canvas at standard/high/publication (4×) scale |
| PDF→Markdown | `pdfjs-dist` text extraction + heuristics (`pdfToMarkdown.ts`) | Headings by relative font size, paragraphs by line spacing, lists by bullet markers, simple tables by column-gap detection, links from PDF annotations |
| PDF→Word | `pdfjs-dist` + `docx` | Same heuristics as PDF→Markdown, rendered into a real .docx |
| DOCX→Markdown | `mammoth` (DOCX→HTML) + `turndown` (+GFM plugin) | Headings/paragraphs/bold/italic/lists/tables/links |
| DOCX→PDF | `mammoth` + `jsPDF` (`.html()`, using html2canvas internally) | **See fidelity limitation below** |

## Known limitations (disclosed in-app, not hidden)

- **DOCX→PDF is HTML-rendering-based, not a native Word/LibreOffice engine.** There is no reliable way to run a real DOCX layout engine in a Vercel serverless function (no persistent filesystem, no system dependency install) or in the browser. This produces a real, readable PDF preserving text/headings/lists/tables, but not exact original pagination, headers/footers, or complex styling. A pixel-perfect version would require a dedicated server-side conversion microservice (e.g., LibreOffice in a container) - deliberately out of scope here rather than faked.
- **PDF→Word/Markdown is heuristic**, since PDF has no semantic structure to recover. Table reconstruction in particular is a best-effort column-gap heuristic, not guaranteed-correct.
- **No OCR.** A PDF detected as likely scanned (`isLikelyScanned()` - average <40 extracted characters/page) is flagged to the user rather than silently producing an empty/misleading output. OCR (e.g., Tesseract.js) was not implemented in this session.

## Vercel compatibility

Every one of these utilities is pure client-side JavaScript (Canvas API, pdf.js with its own Web Worker, mammoth, docx, turndown, jsPDF/html2canvas) - **none require a server route**, so none are affected by Vercel's serverless constraints (no persistent filesystem, no system binaries, no long-running processes). No API keys, no uploads.
