import { test } from "node:test";
import assert from "node:assert/strict";
import { detectContentBounds, type PixelSource } from "./trim.ts";

// Builds a synthetic RGBA buffer: a solid background color everywhere,
// with a solid "content" rectangle painted at the given position.
function makeImage(width: number, height: number, bg: [number, number, number, number], content: { x: number; y: number; w: number; h: number; color: [number, number, number, number] } | null): PixelSource {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const inside = content && x >= content.x && x < content.x + content.w && y >= content.y && y < content.y + content.h;
      const c = inside ? content!.color : bg;
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = c[3];
    }
  }
  return { width, height, data };
}

test("detects a centered content block and trims the surrounding whitespace", () => {
  const img = makeImage(100, 100, [255, 255, 255, 255], { x: 30, y: 40, w: 20, h: 10, color: [0, 0, 0, 255] });
  const box = detectContentBounds(img, 16, 0); // no padding, for an exact assertion
  assert.equal(box.x, 30);
  assert.equal(box.y, 40);
  assert.equal(box.width, 20);
  assert.equal(box.height, 10);
});

test("padding expands the box but never past the image edges", () => {
  const img = makeImage(100, 100, [255, 255, 255, 255], { x: 30, y: 40, w: 20, h: 10, color: [0, 0, 0, 255] });
  const box = detectContentBounds(img, 16, 5);
  assert.equal(box.x, 25);
  assert.equal(box.y, 35);
  assert.equal(box.width, 30); // 20 + 5 padding on each side
  assert.equal(box.height, 20);
});

test("padding near the edge clamps to the image bounds instead of going negative", () => {
  const img = makeImage(100, 100, [255, 255, 255, 255], { x: 2, y: 2, w: 10, h: 10, color: [0, 0, 0, 255] });
  const box = detectContentBounds(img, 16, 5);
  assert.equal(box.x, 0);
  assert.equal(box.y, 0);
});

test("a fully blank (all-background) image is never trimmed to nothing - returns the full image", () => {
  const img = makeImage(50, 50, [255, 255, 255, 255], null);
  const box = detectContentBounds(img);
  assert.deepEqual(box, { x: 0, y: 0, width: 50, height: 50 });
});

test("content touching all four corners (no reliable background) is left untrimmed", () => {
  // content spans nearly the whole image, including all 4 corners
  const img = makeImage(50, 50, [255, 255, 255, 255], { x: 0, y: 0, w: 50, h: 50, color: [0, 0, 0, 255] });
  const box = detectContentBounds(img);
  assert.deepEqual(box, { x: 0, y: 0, width: 50, height: 50 });
});

test("a stray non-background pixel in exactly one corner still resolves the correct background color (3-of-4 corners agree), even though the row containing that stray pixel is itself correctly left untrimmed (never erode a real, isolated mark near the edge - e.g. an axis tick)", () => {
  const img = makeImage(100, 100, [255, 255, 255, 255], { x: 40, y: 40, w: 20, h: 20, color: [0, 0, 0, 255] });
  // Paint a single dark pixel at the top-left corner, simulating a stray axis tick or artifact.
  img.data[0] = 0; img.data[1] = 0; img.data[2] = 0; img.data[3] = 255;
  const box = detectContentBounds(img, 16, 0);
  // The stray pixel is on row 0 / col 0, so the top/left edges correctly
  // cannot be trimmed past it - but the bottom/right edges, unaffected by
  // it, must still be trimmed tightly to the real content block, proving
  // background-color detection wasn't corrupted by the single stray pixel.
  assert.equal(box.x, 0);
  assert.equal(box.y, 0);
  assert.equal(box.width, 60); // right edge trimmed to 40+20=60
  assert.equal(box.height, 60); // bottom edge trimmed to 40+20=60
});

test("small anti-aliasing-level color differences (within tolerance) are still treated as background", () => {
  const img = makeImage(60, 60, [255, 255, 255, 255], { x: 20, y: 20, w: 10, h: 10, color: [0, 0, 0, 255] });
  // Slightly off-white noise (within default tolerance of 16) surrounding the content.
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i] === 255) { img.data[i] = 250; img.data[i + 1] = 248; img.data[i + 2] = 252; }
  }
  const box = detectContentBounds(img, 16, 0);
  assert.equal(box.x, 20);
  assert.equal(box.width, 10);
});

test("real-world-shaped example: wide whitespace margin around a small chart is substantially trimmed", () => {
  // Mimics an R-generated forest plot PNG: lots of white margin, actual
  // plot content only in the middle portion of the canvas.
  const img = makeImage(800, 600, [255, 255, 255, 255], { x: 150, y: 200, w: 500, h: 200, color: [50, 50, 200, 255] });
  const box = detectContentBounds(img, 16, 4);
  assert.ok(box.width < 600, "trimmed width should be well under the full 800px width");
  assert.ok(box.height < 400, "trimmed height should be well under the full 600px height");
  assert.equal(box.x, 146); // 150 - 4 padding
  assert.equal(box.y, 196);
});
