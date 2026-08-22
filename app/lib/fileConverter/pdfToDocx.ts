// PDF -> Word (DOCX). Best-effort text/structure extraction (via the same
// heuristics as pdfToMarkdown.ts - heading detection by relative font
// size, bullet detection, paragraph grouping) rendered into a real .docx
// using the `docx` package (pure JS, runs entirely in the browser). This
// does NOT attempt to reproduce the original page layout, fonts, images,
// or exact positioning - PDF is a fixed-layout format and this project
// does not claim otherwise (see the honesty requirement this was built to
// satisfy). For a scanned/image-based PDF, isLikelyScanned() should be
// checked by the caller BEFORE calling this, and the user warned instead.
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import type { PageTextResult } from "./pdf";
import { groupIntoLines, computeBodyFontSize } from "./pdfToMarkdown";

export async function pagesToDocxBlob(pages: PageTextResult[]): Promise<Blob> {
  const bodySize = computeBodyFontSize(pages);
  const paragraphs: Paragraph[] = [];

  pages.forEach((page, pageIdx) => {
    const lines = groupIntoLines(page.items);
    let buffer: string[] = [];
    const flush = () => {
      if (buffer.length > 0) {
        paragraphs.push(new Paragraph({ children: [new TextRun(buffer.join(" "))] }));
        buffer = [];
      }
    };

    for (const line of lines) {
      const isHeading = line.fontSize > bodySize * 1.15 && line.text.length < 120 && line.text.length > 0;
      const isBullet = /^[•\-\*▪●]\s+/.test(line.text) || /^\(?\d+[.)]\s+/.test(line.text);

      if (isHeading) {
        flush();
        const level = line.fontSize > bodySize * 1.8 ? HeadingLevel.HEADING_1 : line.fontSize > bodySize * 1.45 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
        paragraphs.push(new Paragraph({ text: line.text, heading: level }));
      } else if (isBullet) {
        flush();
        paragraphs.push(new Paragraph({ text: line.text.replace(/^[•\-\*▪●]\s+/, "").replace(/^\(?\d+[.)]\s+/, ""), bullet: { level: 0 } }));
      } else {
        buffer.push(line.text);
      }
    }
    flush();

    if (page.links.length > 0) {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: "Links on this page:", bold: true })] }));
      for (const link of page.links) paragraphs.push(new Paragraph({ text: link.url }));
    }
    if (pageIdx < pages.length - 1) paragraphs.push(new Paragraph({ text: "", pageBreakBefore: true }));
  });

  if (paragraphs.length === 0) {
    paragraphs.push(new Paragraph({ text: "No extractable text was found in this PDF." }));
  }

  const doc = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBlob(doc);
}
