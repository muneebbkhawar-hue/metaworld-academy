// Detects the real content bounding box inside an image, so the Collage
// Maker can crop away a source figure's own blank/whitespace margin before
// laying it into the grid - the actual cause of the uneven blank space in
// mixed-source collages (an R-generated forest plot PNG typically has a lot
// of baked-in white margin around the plot itself, and that margin's size
// varies figure to figure, so using each image's FULL bitmap for the
// grid's aspect-ratio math produces mismatched, letterboxed cells even
// though the actual chart content would tile together tightly).
//
// Structurally typed against ImageData (width/height/data) rather than the
// DOM ImageData class itself, so this pure function is unit-testable in
// plain Node without a DOM/canvas polyfill.
export interface PixelSource {
  width: number;
  height: number;
  data: Uint8ClampedArray | number[];
}

export interface TrimRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function colorDiff(a: readonly [number, number, number, number], b: readonly [number, number, number, number]): number {
  // Max per-channel absolute difference (not Euclidean) - cheaper, and a
  // single channel drifting past tolerance is exactly what should count as
  // "this is no longer the background color", regardless of the others.
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]), Math.abs(a[3] - b[3]));
}

/**
 * Finds the tightest bounding box containing every pixel that is NOT the
 * image's background color, so real chart content is never cropped - only
 * a genuinely uniform border/margin is removed.
 *
 * Background color is taken as whichever of the 4 corner pixels the most
 * OTHER corners agree with (within `tolerance`) - this correctly ignores a
 * single corner that happens to land on an axis line or data point, as
 * long as at least 2 of the 4 corners are genuine background (true for
 * every realistic plot figure, which always has margin in at least two
 * corners).
 *
 * `padding` pixels are kept around the detected content on every side (a
 * safety margin so an anti-aliased edge pixel of the real content is never
 * cut flush against the crop line).
 *
 * If the whole image is background (blank/solid-color image) or the
 * detected box would be degenerate, the FULL image bounds are returned
 * rather than an empty/near-empty crop - trimming never produces a
 * zero-size or suspiciously tiny result.
 */
export function detectContentBounds(img: PixelSource, tolerance = 16, padding = 4): TrimRect {
  const { width, height, data } = img;
  const full: TrimRect = { x: 0, y: 0, width, height };
  if (width <= 2 || height <= 2) return full;

  const at = (x: number, y: number): [number, number, number, number] => {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };

  const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)];
  let bg = corners[0];
  let bestAgreement = -1;
  for (const candidate of corners) {
    const agreement = corners.reduce((n, c) => n + (colorDiff(candidate, c) <= tolerance ? 1 : 0), 0);
    if (agreement > bestAgreement) { bestAgreement = agreement; bg = candidate; }
  }
  // Fewer than 2 corners agree - no reliable background color (e.g. a
  // full-bleed image with no margin at all) - do not attempt to trim.
  if (bestAgreement < 2) return full;

  const isBg = (x: number, y: number) => colorDiff(at(x, y), bg) <= tolerance;

  let top = 0;
  outerTop: for (; top < height; top++) {
    for (let x = 0; x < width; x++) if (!isBg(x, top)) break outerTop;
  }
  let bottom = height - 1;
  outerBottom: for (; bottom >= top; bottom--) {
    for (let x = 0; x < width; x++) if (!isBg(x, bottom)) break outerBottom;
  }
  let left = 0;
  outerLeft: for (; left < width; left++) {
    for (let y = top; y <= bottom; y++) if (!isBg(left, y)) break outerLeft;
  }
  let right = width - 1;
  outerRight: for (; right >= left; right--) {
    for (let y = top; y <= bottom; y++) if (!isBg(right, y)) break outerRight;
  }

  if (top >= height || bottom < top || left >= width || right < left) return full; // fully blank image - never crop to nothing

  const x = Math.max(0, left - padding);
  const y = Math.max(0, top - padding);
  const w = Math.min(width, right + 1 + padding) - x;
  const h = Math.min(height, bottom + 1 + padding) - y;

  if (w < width * 0.05 || h < height * 0.05) return full; // degenerate result - safer to not trim than to over-crop
  return { x, y, width: w, height: h };
}
