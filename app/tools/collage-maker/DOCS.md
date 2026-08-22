# Collage Maker — developer notes

**Purpose:** publication-ready figure collages (multi-panel labels A/B/C…, captions, controlled spacing) — entirely client-side canvas rendering (`app/lib/collage/render.ts`), no backend, no upload.

**Architecture:** `types.ts` (data model + `autoArrange`/`alphabetLabel` helpers, unit-tested in `types.test.ts`) → `render.ts` (pure canvas drawing function, shared identically by the live preview `<canvas>` and the final PNG/JPG export, so preview and export never diverge) → `page.tsx` (UI state).

## Layouts

Preset grids (1×1 through 3×3), a custom rows×cols grid, or "Auto arrange" (`cols = ceil(√n)`, `rows = ceil(n/cols)`).

## Row height algorithm

Each row's content height is the **median** of `cellWidth / imageAspectRatio` across that row's images — chosen deliberately over max (which would let one very tall image inflate the whole row) or min (which would crop a very wide image aggressively). Fit mode is `contain` (never crops, default) or `cover` (fills the cell, clips overflow).

## Image quality

No unnecessary downscaling — the export canvas is sized to the user's chosen `outputWidth`, and source images are drawn at native resolution scaled into their cell. PNG is lossless; JPG has a user-controlled quality slider.

## Limitations

- Very large images (e.g., many 20MP+ photos) may be memory-intensive since `createImageBitmap` decodes fully into memory — not tested against extreme file sizes in this session.
- SVG panels are rasterized by the browser's `createImageBitmap` at their intrinsic size; very large/complex SVGs are untested.

## Deployment

100% client-side; no Vercel-specific considerations.
