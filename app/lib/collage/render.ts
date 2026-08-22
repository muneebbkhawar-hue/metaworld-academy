// Collage rendering engine - pure canvas drawing logic, kept separate from
// React/UI code so it can be unit-reasoned-about and reused identically for
// both the live preview canvas and the final export canvas (same function,
// same output, no "preview looks different from export" surprises).
import type { CollageConfig, Panel } from "./types";

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
    const aspect = p.bitmap.width / p.bitmap.height;
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

  const rowTotalHeights = rowContentHeights.map((h, r) => h + 2 * panelPadding + rowCaptionBoxHeights[r]);

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
    const contentH = rowContentHeights[row];
    const contentX = cellX + panelPadding;
    const contentY = cellY + panelPadding;
    const contentW = cellWidth - 2 * panelPadding;

    // Border around the full cell (image + caption box)
    if (borderWidth > 0) {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.strokeRect(cellX + borderWidth / 2, cellY + borderWidth / 2, cellWidth - borderWidth, rowTotalHeights[row] - borderWidth);
    }

    // Fit image into content box
    const aspect = p.bitmap.width / p.bitmap.height;
    const boxAspect = contentW / contentH;
    let drawW: number, drawH: number, drawX: number, drawY: number;
    if (config.fit === "contain") {
      if (aspect > boxAspect) { drawW = contentW; drawH = contentW / aspect; } else { drawH = contentH; drawW = contentH * aspect; }
      drawX = contentX + (contentW - drawW) / 2;
      drawY = contentY + (contentH - drawH) / 2;
      ctx.drawImage(p.bitmap, drawX, drawY, drawW, drawH);
    } else {
      // cover: scale to fill, crop overflow via clip
      if (aspect > boxAspect) { drawH = contentH; drawW = contentH * aspect; } else { drawW = contentW; drawH = contentW / aspect; }
      drawX = contentX + (contentW - drawW) / 2;
      drawY = contentY + (contentH - drawH) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(contentX, contentY, contentW, contentH);
      ctx.clip();
      ctx.drawImage(p.bitmap, drawX, drawY, drawW, drawH);
      ctx.restore();
    }

    // Label badge
    if (config.labels.enabled && p.label) {
      const pad = 6;
      ctx.font = `${config.labels.bold ? "bold " : ""}${config.labels.fontSize}px ${config.labels.fontFamily}`;
      const textW = ctx.measureText(p.label).width;
      const boxW = textW + pad * 2;
      const boxH = config.labels.fontSize + pad * 1.4;
      let lx = contentX + 6, ly = contentY + 6;
      if (config.labels.position.includes("center")) lx = contentX + contentW / 2 - boxW / 2;
      if (config.labels.position.startsWith("bottom")) ly = contentY + contentH - boxH - 6;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillRect(lx, ly, boxW, boxH);
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(lx, ly, boxW, boxH);
      ctx.fillStyle = "#111111";
      ctx.textBaseline = "middle";
      ctx.fillText(p.label, lx + pad, ly + boxH / 2);
    }

    // Caption
    if (config.captionsEnabled && p.caption) {
      ctx.font = `${captionFontSize}px ${config.labels.fontFamily}`;
      ctx.fillStyle = "#222222";
      ctx.textBaseline = "top";
      ctx.textAlign = "center";
      const lines = wrapText(ctx, p.caption, contentW);
      let ly = cellY + panelPadding + contentH + 4;
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
