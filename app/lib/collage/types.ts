// Shared types for the Collage Maker - kept separate from rendering logic
// (render.ts) and from the page's UI state, matching the convention used
// elsewhere in this app (editor state vs. rendering/calculation layer).
import type { TrimRect } from "./trim";

export type LabelPosition = "top-left" | "top-center" | "bottom-left" | "bottom-center";
export type FitMode = "contain" | "cover";
export type ExportFormat = "png" | "jpg";

export interface Panel {
  id: string;
  file: File;
  bitmap: ImageBitmap;
  label: string; // "A", "B", ... or user-edited
  /**
   * Optional short text shown IN the label badge itself, in parentheses
   * after the letter - e.g. label "A" + subLabel "Lesion Length" renders
   * as "A (Lesion Length)". Distinct from `caption`, which is a longer
   * text block rendered BELOW the whole panel, not inside the badge.
   */
  subLabel: string;
  caption: string;
  /**
   * The detected real-content bounding box within `bitmap` (see trim.ts),
   * computed once at upload time. When present and trimming is enabled,
   * rendering uses THIS rect (not the full bitmap) for both aspect-ratio
   * layout math and as the drawImage source rect - undefined means
   * trimming hasn't been computed yet or found nothing to trim (in which
   * case the full bitmap is used, matching pre-trim behavior exactly).
   */
  contentRect?: TrimRect;
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
  /** When true, panels with a computed `contentRect` are cropped/measured by that rect instead of their full bitmap - see Panel.contentRect. */
  trimWhitespace: boolean;
}

export type GridOrientation = "landscape" | "portrait";

// Landscape (the original behavior): as close to square as possible,
// favoring more COLUMNS than rows when n isn't a perfect square - good for
// a wide screen/slide, bad for inserting into a portrait Word page (5
// panels becomes 2 rows x 3 cols, which is wider than it is tall).
// Portrait: the same near-square principle, but favoring more ROWS than
// columns instead - stacks panels taller, which fits a portrait document
// page width far better without shrinking each panel down to fit.
export function autoArrange(n: number, orientation: GridOrientation = "landscape"): GridLayout {
  if (n <= 0) return { rows: 1, cols: 1 };
  if (orientation === "portrait") {
    const rows = Math.ceil(Math.sqrt(n));
    const cols = Math.ceil(n / rows);
    return { rows, cols };
  }
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
