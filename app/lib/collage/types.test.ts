// Unit tests for the pure, DOM-independent collage helpers.
// Run with: node --experimental-strip-types --test app/lib/collage/types.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { autoArrange, alphabetLabel } from "./types.ts";

test("autoArrange: common panel counts produce sensible grids", () => {
  assert.deepEqual(autoArrange(1), { rows: 1, cols: 1 });
  assert.deepEqual(autoArrange(2), { rows: 1, cols: 2 });
  assert.deepEqual(autoArrange(4), { rows: 2, cols: 2 });
  assert.deepEqual(autoArrange(6), { rows: 2, cols: 3 });
  assert.deepEqual(autoArrange(9), { rows: 3, cols: 3 });
});
test("autoArrange: grid always has enough cells for n panels", () => {
  for (let n = 1; n <= 30; n++) {
    const { rows, cols } = autoArrange(n);
    assert.ok(rows * cols >= n, `n=${n}: grid ${rows}x${cols} has only ${rows * cols} cells`);
  }
});
test("autoArrange: zero or negative panels default to 1x1, not an error", () => {
  assert.deepEqual(autoArrange(0), { rows: 1, cols: 1 });
  assert.deepEqual(autoArrange(-3), { rows: 1, cols: 1 });
});

test("alphabetLabel: first 26 panels are A-Z", () => {
  assert.equal(alphabetLabel(0), "A");
  assert.equal(alphabetLabel(1), "B");
  assert.equal(alphabetLabel(25), "Z");
});
test("alphabetLabel: beyond 26 panels continues AA, AB, ... rather than erroring", () => {
  assert.equal(alphabetLabel(26), "AA");
  assert.equal(alphabetLabel(27), "AB");
  assert.equal(alphabetLabel(51), "AZ");
  assert.equal(alphabetLabel(52), "BA");
});
