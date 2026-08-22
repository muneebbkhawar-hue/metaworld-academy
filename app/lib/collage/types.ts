// Shared types for the Collage Maker - kept separate from rendering logic
// (render.ts) and from the page's UI state, matching the convention used
// elsewhere in this app (editor state vs. rendering/calculation layer).

export type LabelPosition = "top-left" | "top-center" | "bottom-left" | "bottom-center";
export type FitMode = "contain" | "cover";
export type ExportFormat = "png" | "jpg";

export interface Panel {
  id: string;
  file: File;
  bitmap: ImageBitmap;
  label: string; // "A", "B", ... or user-edited
  caption: string;
}

export interface LabelSettings {
  enabled: boolean;
  position: LabelPosition;
  fontSize: number; // px, at 96 DPI baseline - scaled with export resolution
  bold: boolean;
  fontFamily: string;
}

export interface SpacingSettings {
  outerMargin: number; // px
  gapH: number;
  gapV: number;
  panelPadding: number;
  background: string; // CSS color
  borderWidth: number;
  borderColor: string;
}

export interface GridLayout {
  rows: number;
  cols: number;
}

export interface CollageConfig {
  layout: GridLayout;
  fit: FitMode;
  labels: LabelSettings;
  spacing: SpacingSettings;
  sharedCaption: string;
  captionsEnabled: boolean;
  outputWidth: number; // px, total canvas width at export time
}

export function autoArrange(n: number): GridLayout {
  if (n <= 0) return { rows: 1, cols: 1 };
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  return { rows, cols };
}

export function alphabetLabel(index: number): string {
  // A, B, ..., Z, AA, AB, ... (spreadsheet-column style) - handles more
  // than 26 panels gracefully instead of silently running out of letters.
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}
