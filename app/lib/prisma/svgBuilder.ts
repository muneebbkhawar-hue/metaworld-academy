// Builds a standalone, self-contained PRISMA 2020 flow-diagram SVG string
// from computed values. This is the single source of truth for the
// diagram's layout — used identically for the on-page live preview
// (dangerouslySetInnerHTML) and for every export format (SVG is exported
// as-is; PNG/JPEG are produced by rasterizing this exact SVG). What you see
// in the preview is exactly what you export.
//
// Layout mirrors the reference PRISMA 2020 figure: a vertical light-blue
// stage-label column on the left, a gold "Identification" header, a main
// flow column of white boxes connected by downward arrows, and a side
// column of "removed/excluded" boxes each connected by a rightward arrow
// from its corresponding main box.
import { PRISMA_COLORS, PRISMA_FONT_FAMILY } from "./colors.ts";
import type { PrismaCalculations } from "./types.ts";

export interface DiagramExclusionReason {
  label: string;
  count: number;
}

export interface DiagramModel {
  calc: PrismaCalculations;
  registerCount: number;
  duplicatesRemoved: number;
  recordsExcluded: number;
  reportsNotRetrieved: number;
  exclusionReasons: DiagramExclusionReason[];
  studiesIncluded: number;
  reportsOfIncludedStudies: number;
}

const FONT = PRISMA_FONT_FAMILY;
const fmt = (n: number) => n.toLocaleString("en-US");

// --- text measurement / wrapping (no DOM available at export time, so this
// uses a heuristic average character width per font size — good enough for
// layout since every box also has generous padding). ------------------------
function estimateTextWidth(text: string, fontSize: number, bold = false): number {
  const avgCharWidth = fontSize * (bold ? 0.62 : 0.56);
  return text.length * avgCharWidth;
}

function wrapText(text: string, maxWidth: number, fontSize: number, bold = false): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (estimateTextWidth(test, fontSize, bold) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface TextLineSpec { text: string; bold?: boolean; size?: number; }

function wrappedLineCount(blocks: TextLineSpec[], maxWidth: number): number {
  return blocks.reduce((n, b) => n + wrapText(b.text, maxWidth, b.size ?? 13, b.bold).length, 0);
}

/** Renders left-aligned wrapped text lines inside a box, top-anchored at (x, yStart). */
function renderTextBlock(x: number, yStart: number, maxWidth: number, blocks: TextLineSpec[], lineHeight: number): string {
  let y = yStart;
  let svg = "";
  for (const block of blocks) {
    const size = block.size ?? 13;
    const lines = wrapText(block.text, maxWidth, size, block.bold);
    for (const line of lines) {
      svg += `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${block.bold ? "bold" : "normal"}" fill="${PRISMA_COLORS.text}">${esc(line)}</text>`;
      y += lineHeight;
    }
  }
  return svg;
}

function box(x: number, y: number, w: number, h: number, fill: string): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${PRISMA_COLORS.border}" stroke-width="1.5" rx="2"/>`;
}

function downArrow(x: number, y1: number, y2: number): string {
  return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2 - 2}" stroke="${PRISMA_COLORS.arrow}" stroke-width="1.75" marker-end="url(#arrowhead)"/>`;
}

function rightArrow(x1: number, x2: number, y: number): string {
  return `<line x1="${x1}" y1="${y}" x2="${x2 - 2}" y2="${y}" stroke="${PRISMA_COLORS.arrow}" stroke-width="1.75" marker-end="url(#arrowhead)"/>`;
}

// Layout constants (px, at 1x scale — export can rasterize at a higher
// device-pixel ratio for high-resolution output without changing this).
const LABEL_COL_W = 46;
const LABEL_GAP = 10;
const MAIN_COL_X = LABEL_COL_W + LABEL_GAP;
const MAIN_COL_W = 430;
const ARROW_GAP = 46;
const SIDE_COL_X = MAIN_COL_X + MAIN_COL_W + ARROW_GAP;
const SIDE_COL_W = 300;
const CANVAS_W = SIDE_COL_X + SIDE_COL_W + 24;
const ROW_GAP = 34;
const PAD = 12;
const LINE_H = 17;
const OUTER_MARGIN = 16;
const TEXT_TOP_OFFSET = 12; // baseline offset from box top for the first text line

/** Draws one main-flow-box + side-box row and returns its geometry. */
function renderRow(
  parts: string[],
  y: number,
  mainBlocks: TextLineSpec[],
  sideBlocks: TextLineSpec[] | null
): number {
  const mainLines = wrappedLineCount(mainBlocks, MAIN_COL_W - 2 * PAD);
  const sideLines = sideBlocks ? wrappedLineCount(sideBlocks, SIDE_COL_W - 2 * PAD) : 0;
  const h = Math.max(mainLines, sideLines, 2) * LINE_H + 2 * PAD;

  parts.push(box(MAIN_COL_X, y, MAIN_COL_W, h, PRISMA_COLORS.flowBox));
  parts.push(renderTextBlock(MAIN_COL_X + PAD, y + PAD + TEXT_TOP_OFFSET, MAIN_COL_W - 2 * PAD, mainBlocks, LINE_H));

  if (sideBlocks) {
    parts.push(box(SIDE_COL_X, y, SIDE_COL_W, h, PRISMA_COLORS.flowBox));
    parts.push(renderTextBlock(SIDE_COL_X + PAD, y + PAD + TEXT_TOP_OFFSET, SIDE_COL_W - 2 * PAD, sideBlocks, LINE_H));
    parts.push(rightArrow(MAIN_COL_X + MAIN_COL_W, SIDE_COL_X, y + h / 2));
  }
  return h;
}

export function buildPrismaSvg(model: DiagramModel): { svg: string; width: number; height: number } {
  const { calc } = model;
  const parts: string[] = [];
  let y = OUTER_MARGIN;

  // --- Identification header (gold) -----------------------------------------
  const headerH = 30;
  const fullWidth = MAIN_COL_W + ARROW_GAP + SIDE_COL_W;
  parts.push(box(MAIN_COL_X, y, fullWidth, headerH, PRISMA_COLORS.identificationHeader));
  parts.push(
    `<text x="${MAIN_COL_X + fullWidth / 2}" y="${y + headerH / 2 + 5}" font-family="${FONT}" font-size="14" font-weight="bold" text-anchor="middle" fill="${PRISMA_COLORS.text}">Identification of studies via databases and registers</text>`
  );
  y += headerH + ROW_GAP;

  // --- Row 1: Records identified (main) | Records removed before screening (side) --
  const identificationTop = OUTER_MARGIN;
  const row1Top = y;
  const sourcesLine =
    model.registerCount > 0
      ? `Databases (n = ${fmt(calc.databaseTotal)}) and registers (n = ${fmt(calc.registerTotal)})`
      : `Databases (n = ${fmt(calc.databaseTotal)})`;
  const row1H = renderRow(
    parts,
    y,
    [
      { text: "Records identified from:", bold: true },
      { text: sourcesLine },
    ],
    [
      { text: "Records removed before screening:", bold: true },
      { text: `Duplicate records removed (n = ${fmt(model.duplicatesRemoved)})` },
    ]
  );
  const identificationBottom = row1Top + row1H;
  y += row1H + ROW_GAP;

  // --- Row 2: Records screened | Records excluded ---------------------------
  const screeningTop = y;
  const row2H = renderRow(
    parts,
    y,
    [{ text: "Records screened", bold: true }, { text: `(n = ${fmt(calc.recordsScreened)})` }],
    [{ text: "Records excluded", bold: true }, { text: `(n = ${fmt(model.recordsExcluded)})` }]
  );
  parts.push(downArrow(MAIN_COL_X + MAIN_COL_W / 2, identificationBottom, screeningTop));
  y += row2H + ROW_GAP;

  // --- Row 3: Reports sought for retrieval | Reports not retrieved ----------
  const row3Top = y;
  const row3H = renderRow(
    parts,
    y,
    [{ text: "Reports sought for retrieval", bold: true }, { text: `(n = ${fmt(calc.reportsSought)})` }],
    [{ text: "Reports not retrieved", bold: true }, { text: `(n = ${fmt(model.reportsNotRetrieved)})` }]
  );
  parts.push(downArrow(MAIN_COL_X + MAIN_COL_W / 2, screeningTop + row2H, row3Top));
  y += row3H + ROW_GAP;

  // --- Row 4: Reports assessed for eligibility | Reports excluded (reasons) --
  const row4Top = y;
  const reasonBlocks: TextLineSpec[] =
    model.exclusionReasons.length > 0
      ? [{ text: "Reports excluded:", bold: true }, ...model.exclusionReasons.map((r) => ({ text: `${r.label} (n = ${fmt(r.count)})`, size: 12.5 }))]
      : [{ text: `Reports excluded (n = ${fmt(calc.totalReportsExcluded)})`, bold: true }];
  const row4H = renderRow(
    parts,
    y,
    [{ text: "Reports assessed for eligibility", bold: true }, { text: `(n = ${fmt(calc.reportsAssessed)})` }],
    reasonBlocks
  );
  parts.push(downArrow(MAIN_COL_X + MAIN_COL_W / 2, row3Top + row3H, row4Top));
  const screeningBottom = row4Top + row4H;
  y += row4H + ROW_GAP;

  // --- Row 5: Included --------------------------------------------------
  const includedTop = y;
  const row5H = renderRow(
    parts,
    y,
    [
      { text: "Studies included in review", bold: true },
      { text: `(n = ${fmt(model.studiesIncluded)})` },
      { text: "Reports of included studies", bold: true },
      { text: `(n = ${fmt(model.reportsOfIncludedStudies)})` },
    ],
    null
  );
  parts.push(downArrow(MAIN_COL_X + MAIN_COL_W / 2, screeningBottom, includedTop));
  y += row5H;

  const totalHeight = y + OUTER_MARGIN;

  // --- Vertical stage labels (light blue) -----------------------------------
  const stageLabels: { text: string; top: number; bottom: number }[] = [
    { text: "Identification", top: identificationTop, bottom: identificationBottom },
    { text: "Screening", top: screeningTop, bottom: screeningBottom },
    { text: "Included", top: includedTop, bottom: includedTop + row5H },
  ];
  const stageSvg = stageLabels
    .map(({ text, top, bottom }) => {
      const h = Math.max(30, bottom - top);
      return (
        box(OUTER_MARGIN, top, LABEL_COL_W, h, PRISMA_COLORS.sectionLabel) +
        `<text x="${OUTER_MARGIN + LABEL_COL_W / 2}" y="${top + h / 2}" font-family="${FONT}" font-size="13" font-weight="bold" text-anchor="middle" fill="${PRISMA_COLORS.text}" transform="rotate(-90 ${OUTER_MARGIN + LABEL_COL_W / 2} ${top + h / 2})">${esc(text)}</text>`
      );
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${totalHeight}" viewBox="0 0 ${CANVAS_W} ${totalHeight}" font-family="${FONT}">
    <defs>
      <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8 Z" fill="${PRISMA_COLORS.arrow}"/>
      </marker>
    </defs>
    <rect x="0" y="0" width="${CANVAS_W}" height="${totalHeight}" fill="${PRISMA_COLORS.background}"/>
    ${stageSvg}
    ${parts.join("\n")}
  </svg>`;

  return { svg, width: CANVAS_W, height: totalHeight };
}
