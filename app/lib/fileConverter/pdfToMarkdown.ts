// PDF -> Markdown extraction. Heuristic, best-effort text-layout analysis
// on top of PDF.js's real extracted text items (never invented text) -
// headings are inferred from relative font size, paragraphs from vertical
// line spacing, lists from leading bullet/number markers, and simple
// aligned-column tables from consistent horizontal gaps between text
// clusters. This is explicitly a heuristic, not a guaranteed-correct
// layout parser - PDF has no semantic structure to recover perfectly.
import type { TextItemInfo, PageTextResult } from "./pdf";

export interface Line { text: string; y: number; fontSize: number; items: TextItemInfo[] }

// "Body" font size = the size with the most total extracted CHARACTERS
// (not the most text ITEMS, and not a plain median) - body paragraphs
// contain far more characters than headings do, so this is a more robust
// way to find the dominant reading-text size than a simple median, which
// can be skewed by a document with few but large items.
export function computeBodyFontSize(pages: PageTextResult[]): number {
  const charsBySize = new Map<number, number>();
  for (const page of pages) {
    for (const item of page.items) {
      if (item.fontSize <= 0) continue;
      const rounded = Math.round(item.fontSize * 10) / 10;
      charsBySize.set(rounded, (charsBySize.get(rounded) ?? 0) + Math.max(1, item.text.trim().length));
    }
  }
  if (charsBySize.size === 0) return 10;
  let bestSize = 10, bestChars = -1;
  for (const [size, chars] of charsBySize) {
    if (chars > bestChars) { bestChars = chars; bestSize = size; }
  }
  return bestSize;
}

export function groupIntoLines(items: TextItemInfo[]): Line[] {
  const sorted = [...items].filter((i) => i.text.trim().length > 0).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];
  const tolerance = 3;
  for (const item of sorted) {
    const line = lines.find((l) => Math.abs(l.y - item.y) < tolerance);
    if (line) {
      line.items.push(item);
      line.fontSize = Math.max(line.fontSize, item.fontSize);
    } else {
      lines.push({ text: "", y: item.y, fontSize: item.fontSize, items: [item] });
    }
  }
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    line.text = joinItemsToText(line.items);
  }
  return lines.sort((a, b) => b.y - a.y);
}

function joinItemsToText(items: TextItemInfo[]): string {
  let out = "";
  for (let i = 0; i < items.length; i++) {
    const cur = items[i];
    if (i > 0) {
      const prev = items[i - 1];
      const gap = cur.x - (prev.x + prev.fontSize * 0.5 * prev.text.length); // rough estimate of prev item's end x
      if (gap > prev.fontSize * 0.3) out += " ";
    }
    out += cur.text;
  }
  return out.replace(/\s+/g, " ").trim();
}

// Detects large horizontal gaps within a line's items to split it into
// "columns" for table-row detection - a genuine heuristic, not fabricated
// content: the text in each cell is exactly what PDF.js extracted.
function splitIntoColumns(items: TextItemInfo[]): string[] {
  if (items.length === 0) return [];
  const avgFont = items.reduce((s, i) => s + i.fontSize, 0) / items.length;
  const gapThreshold = avgFont * 1.8;
  const cols: string[][] = [[]];
  for (let i = 0; i < items.length; i++) {
    if (i > 0) {
      const prev = items[i - 1];
      const gap = items[i].x - (prev.x + prev.fontSize * 0.5 * prev.text.length);
      if (gap > gapThreshold) cols.push([]);
    }
    cols[cols.length - 1].push(items[i].text);
  }
  return cols.map((c) => c.join(" ").trim()).filter((c) => c.length > 0);
}

export interface MarkdownExtractionResult {
  markdown: string;
  likelyScanned: boolean;
  pageCount: number;
  linkCount: number;
}

export function pagesToMarkdown(pages: PageTextResult[]): string {
  const bodySize = computeBodyFontSize(pages);

  const out: string[] = [];
  for (const page of pages) {
    const lines = groupIntoLines(page.items);
    if (lines.length === 0) continue;
    out.push(`<!-- Page ${page.pageNum} -->`);

    let paragraphBuffer: string[] = [];
    let lastY: number | null = null;
    let pendingTableRows: string[][] = [];

    const flushParagraph = () => {
      if (paragraphBuffer.length > 0) {
        out.push(paragraphBuffer.join(" "));
        out.push("");
        paragraphBuffer = [];
      }
    };
    const flushTable = () => {
      if (pendingTableRows.length >= 2) {
        const colCount = pendingTableRows[0].length;
        out.push(`| ${pendingTableRows[0].join(" | ")} |`);
        out.push(`| ${Array(colCount).fill("---").join(" | ")} |`);
        for (const row of pendingTableRows.slice(1)) out.push(`| ${row.join(" | ")} |`);
        out.push("");
      } else if (pendingTableRows.length === 1) {
        paragraphBuffer.push(pendingTableRows[0].join(" "));
      }
      pendingTableRows = [];
    };

    for (const line of lines) {
      const gapFromPrev = lastY !== null ? lastY - line.y : 0;
      const isHeading = line.fontSize > bodySize * 1.15 && line.text.length < 120 && line.text.length > 0;
      const isBullet = /^[•\-\*▪●]\s+/.test(line.text) || /^\(?\d+[.)]\s+/.test(line.text);
      const columns = splitIntoColumns(line.items);
      const looksTabular = columns.length >= 3;

      if (looksTabular) {
        flushParagraph();
        pendingTableRows.push(columns);
        lastY = line.y;
        continue;
      } else if (pendingTableRows.length > 0) {
        flushTable();
      }

      if (isHeading) {
        flushParagraph();
        const level = line.fontSize > bodySize * 1.8 ? 1 : line.fontSize > bodySize * 1.45 ? 2 : 3;
        out.push(`${"#".repeat(level)} ${line.text}`);
        out.push("");
      } else if (isBullet) {
        flushParagraph();
        out.push(`- ${line.text.replace(/^[•\-\*▪●]\s+/, "").replace(/^\(?\d+[.)]\s+/, "")}`);
      } else {
        // A larger-than-normal vertical gap starts a new paragraph.
        if (gapFromPrev > line.fontSize * 1.8) flushParagraph();
        paragraphBuffer.push(line.text);
      }
      lastY = line.y;
    }
    flushTable();
    flushParagraph();

    if (page.links.length > 0) {
      out.push("**Links on this page:**");
      for (const link of page.links) out.push(`- ${link.url}`);
      out.push("");
    }
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
