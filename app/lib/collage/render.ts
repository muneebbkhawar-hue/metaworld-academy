// Collage rendering engine - pure canvas drawing logic, kept separate from
// React/UI code so it can be unit-reasoned-about and reused identically for
// both the live preview canvas and the final export canvas (same function,
// same output, no "preview looks different from export" surprises).
import type { CollageConfig, Panel } from "./types";

// The rect of `p.bitmap` actually used for layout math and drawing - the
// full bitmap unless whitespace-trimming is enabled AND a content rect was
// successfully detected for this panel (see trim.ts / Panel.contentRect).
function sourceRect(p: Panel, trimWhitespace: boolean) {
  if (trimWhitespace && p.contentRect) return p.contentRect;
  return { x: 0, y: 0, width: p.bitmap.width, height: p.bitmap.height };
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function renderCollage(canvas: HTMLCanvasElement, panels: Panel[], config: CollageConfig) {
  const { rows, cols } = config.layout;
  const { outerMargin, gapH, gapV, panelPadding, background, borderWidth, borderColor } = config.spacing;
  const width = config.outputWidth;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const cellWidth = (width - 2 * outerMargin - gapH * Math.max(0, cols - 1)) / cols;
  const captionFontSize = Math.max(11, Math.round(config.labels.fontSize * 0.8));
  const captionLineHeight = captionFontSize * 1.35;

  // Measure caption line counts and row content heights in a first pass
  // (captions need the real font set on the context to measure correctly).
  ctx.font = `${captionFontSize}px ${config.labels.fontFamily}`;
  const captionAreaWidth = cellWidth - 2 * panelPadding;

  const rowContentHeights: number[] = new Array(rows).fill(0);
  const rowNaturalHeights: number[][] = new Array(rows).fill(null).map(() => []);
  const panelCaptionLineCounts: number[] = [];

  panels.forEach((p, i) => {
    const row = Math.floor(i / cols);
    if (row >= rows) return;
    const rect = sourceRect(p, config.trimWhitespace);
    const aspect = rect.width / rect.height;
    const naturalHeightAtCellWidth = cellWidth / aspect;
    rowNaturalHeights[row].push(naturalHeightAtCellWidth);
    const lines = config.captionsEnabled && p.caption ? wrapText(ctx, p.caption, captionAreaWidth) : [];
    panelCaptionLineCounts[i] = lines.length;
  });
  for (let r = 0; r < rows; r++) {
    rowContentHeights[r] = rowNaturalHeights[r].length > 0 ? median(rowNaturalHeights[r]) : cellWidth * 0.66;
  }
  const rowCaptionBoxHeights: number[] = new Array(rows).fill(0);
  if (config.captionsEnabled) {
    for (let i = 0; i < panels.length; i++) {
      const row = Math.floor(i / cols);
      if (row >= rows) continue;
      const lines = panelCaptionLineCounts[i] || 0;
      const h = lines > 0 ? lines * captionLineHeight + 8 : 0;
      rowCaptionBoxHeights[row] = Math.max(rowCaptionBoxHeights[row], h);
    }
  }

  // Reserved strip for the label badge ("A", or "A (Lesion Length)" when a
  // subLabel is set) - a FIXED bar outside the image area, not an overlay
  // drawn on top of the image. Auto-trimming whitespace (trim.ts) removes a
  // figure's own blank margin, which used to be exactly where the badge
  // sat "for free" - without a reserved bar, the badge would now cover the
  // real chart content (e.g. the "Study" column header) instead of empty
  // space above it.
  const labelBarHeight = config.labels.enabled ? Math.ceil(config.labels.fontSize * 1.5 + 10) : 0;

  const rowTotalHeights = rowContentHeights.map((h, r) => h + labelBarHeight + 2 * panelPadding + rowCaptionBoxHeights[r]);

  ctx.font = `${config.labels.fontSize}px ${config.labels.fontFamily}`;
  const sharedCaptionLines = config.sharedCaption ? wrapText(ctx, config.sharedCaption, width - 2 * outerMargin) : [];
  const sharedCaptionHeight = sharedCaptionLines.length > 0 ? sharedCaptionLines.length * (captionFontSize * 1.4) + 16 : 0;

  const totalHeight = Math.ceil(
    2 * outerMargin + rowTotalHeights.reduce((a, b) => a + b, 0) + gapV * Math.max(0, rows - 1) + sharedCaptionHeight
  );

  canvas.width = Math.round(width);
  canvas.height = Math.max(1, totalHeight);

  // Background
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let yCursor = outerMargin;
  const rowYStart: number[] = [];
  for (let r = 0; r < rows; r++) {
    rowYStart[r] = yCursor;
    yCursor += rowTotalHeights[r] + gapV;
  }

  panels.forEach((p, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    if (row >= rows) return;

    const cellX = outerMargin + col * (cellWidth + gapH);
    const cellY = rowYStart[row];
    const contentH = rowContentHeights[row]; // pure image height - the label bar is reserved SEPARATELY, never overlaps it
    const contentX = cellX + panelPadding;
    const contentW = cellWidth - 2 * panelPadding;
    const isTopLabel = config.labels.position.startsWith("top");
    // The label bar sits ABOVE the image for a top-* position, or BELOW it
    // for a bottom-* position - either way it's dedicated space, not an
    // overlay, so it can never obscure real chart content (this is what
    // fixed the "A/B/C/D covering the Study column header" issue: trimming
    // removes a figure's own blank margin, so there is no longer any free
    // space for an overlaid badge to sit in without covering content).
    const contentY = cellY + panelPadding + (isTopLabel ? labelBarHeight : 0);

    // Border around the full cell (label bar + image + caption box)
    if (borderWidth > 0) {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.strokeRect(cellX + borderWidth / 2, cellY + borderWidth / 2, cellWidth - borderWidth, rowTotalHeights[row] - borderWidth);
    }

    // Fit image into content box - sourced from the trimmed content rect
    // when whitespace-trimming is enabled, so a figure's own baked-in
    // margin is never drawn (and never counted in its aspect ratio).
    const rect = sourceRect(p, config.trimWhitespace);
    const aspect = rect.width / rect.height;
    const boxAspect = contentW / contentH;
    let drawW: number, drawH: number, drawX: number, drawY: number;
    if (config.fit === "contain") {
      if (aspect > boxAspect) { drawW = contentW; drawH = contentW / aspect; } else { drawH = contentH; drawW = contentH * aspect; }
      drawX = contentX + (contentW - drawW) / 2;
      drawY = contentY + (contentH - drawH) / 2;
      ctx.drawImage(p.bitmap, rect.x, rect.y, rect.width, rect.height, drawX, drawY, drawW, drawH);
    } else {
      // cover: scale to fill, crop overflow via clip
      if (aspect > boxAspect) { drawH = contentH; drawW = contentH * aspect; } else { drawW = contentW; drawH = contentW / aspect; }
      drawX = contentX + (contentW - drawW) / 2;
      drawY = contentY + (contentH - drawH) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(contentX, contentY, contentW, contentH);
      ctx.clip();
      ctx.drawImage(p.bitmap, rect.x, rect.y, rect.width, rect.height, drawX, drawY, drawW, drawH);
      ctx.restore();
    }

    // Label badge - drawn in its OWN reserved bar (see contentY/labelBarHeight
    // above), never overlaid on top of the image. Combines the letter with
    // an optional subLabel, e.g. "A" + "Lesion Length" -> "A (Lesion Length)".
    if (config.labels.enabled && p.label) {
      const badgeText = p.subLabel ? `${p.label} (${p.subLabel})` : p.label;
      const pad = 6;
      ctx.font = `${config.labels.bold ? "bold " : ""}${config.labels.fontSize}px ${config.labels.fontFamily}`;
      const textW = ctx.measureText(badgeText).width;
      const boxW = Math.min(textW + pad * 2, contentW);
      const boxH = Math.min(config.labels.fontSize + pad * 1.4, labelBarHeight - 2);
      const barY = isTopLabel ? cellY + panelPadding : cellY + panelPadding + contentH;
      let lx = contentX;
      if (config.labels.position.includes("center")) lx = contentX + contentW / 2 - boxW / 2;
      const ly = barY + (labelBarHeight - boxH) / 2;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillRect(lx, ly, boxW, boxH);
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(lx, ly, boxW, boxH);
      ctx.fillStyle = "#111111";
      ctx.textBaseline = "middle";
      // Clip long "Letter (subLabel)" text to the badge width rather than
      // overflowing into the neighboring panel.
      ctx.save();
      ctx.beginPath();
      ctx.rect(lx, ly, boxW, boxH);
      ctx.clip();
      ctx.fillText(badgeText, lx + pad, ly + boxH / 2);
      ctx.restore();
    }

    // Caption
    if (config.captionsEnabled && p.caption) {
      ctx.font = `${captionFontSize}px ${config.labels.fontFamily}`;
      ctx.fillStyle = "#222222";
      ctx.textBaseline = "top";
      ctx.textAlign = "center";
      const lines = wrapText(ctx, p.caption, contentW);
      let ly = cellY + panelPadding + labelBarHeight + contentH + 4;
      for (const line of lines) {
        ctx.fillText(line, cellX + cellWidth / 2, ly);
        ly += captionLineHeight;
      }
      ctx.textAlign = "left";
    }
  });

  if (sharedCaptionLines.length > 0) {
    ctx.font = `${captionFontSize}px ${config.labels.fontFamily}`;
    ctx.fillStyle = "#111111";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    let ly = canvas.height - sharedCaptionHeight + 8;
    for (const line of sharedCaptionLines) {
      ctx.fillText(line, canvas.width / 2, ly);
      ly += captionFontSize * 1.4;
    }
    ctx.textAlign = "left";
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement, format: "png" | "jpg", quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), format === "jpg" ? "image/jpeg" : "image/png", format === "jpg" ? quality : undefined);
  });
}
