import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLinearMap, applyLinearMap, inverseLinearMap, pixelToData } from "./calibration.ts";

test("buildLinearMap returns null with fewer than 2 refs", () => {
  assert.equal(buildLinearMap([]), null);
  assert.equal(buildLinearMap([{ pixelCoord: 10, value: 0 }]), null);
});

test("buildLinearMap returns null for two refs at the same pixel (division by zero guard)", () => {
  assert.equal(
    buildLinearMap([
      { pixelCoord: 50, value: 0 },
      { pixelCoord: 50, value: 60 },
    ]),
    null
  );
});

test("buildLinearMap + applyLinearMap correctly maps pixel A -> 0 and pixel B -> 60 (X-axis example from the spec)", () => {
  const map = buildLinearMap([
    { pixelCoord: 100, value: 0 },
    { pixelCoord: 700, value: 60 },
  ]);
  assert.ok(map);
  assert.equal(applyLinearMap(map!, 100), 0);
  assert.equal(applyLinearMap(map!, 700), 60);
  assert.equal(applyLinearMap(map!, 400), 30); // midpoint
});

test("buildLinearMap correctly maps an inverted Y-axis (pixel A=1.0 at top, pixel B=0.0 at bottom, from the spec example)", () => {
  const map = buildLinearMap([
    { pixelCoord: 50, value: 1.0 }, // top of the plot, high pixel-Y typically means low value on screen, but calibration doesn't assume direction
    { pixelCoord: 450, value: 0.0 },
  ]);
  assert.ok(map);
  assert.equal(applyLinearMap(map!, 50), 1.0);
  assert.equal(applyLinearMap(map!, 450), 0.0);
  assert.equal(applyLinearMap(map!, 250), 0.5);
});

test("inverseLinearMap is the true inverse of applyLinearMap", () => {
  const map = buildLinearMap([
    { pixelCoord: 100, value: 0 },
    { pixelCoord: 700, value: 60 },
  ]);
  assert.ok(map);
  const val = applyLinearMap(map!, 325);
  assert.ok(Math.abs(inverseLinearMap(map!, val) - 325) < 1e-9);
});

test("pixelToData normalizes a percentage-scale Y-axis down to a 0-1 proportion", () => {
  const xMap = buildLinearMap([
    { pixelCoord: 0, value: 0 },
    { pixelCoord: 100, value: 60 },
  ])!;
  const yMap = buildLinearMap([
    { pixelCoord: 0, value: 100 },
    { pixelCoord: 100, value: 0 },
  ])!;
  const result = pixelToData({ x: 50, y: 50 }, xMap, yMap, "percentage");
  assert.equal(result.time, 30);
  assert.equal(result.survival, 0.5);
});

test("pixelToData leaves a proportion-scale Y-axis unchanged", () => {
  const xMap = buildLinearMap([
    { pixelCoord: 0, value: 0 },
    { pixelCoord: 100, value: 60 },
  ])!;
  const yMap = buildLinearMap([
    { pixelCoord: 0, value: 1 },
    { pixelCoord: 100, value: 0 },
  ])!;
  const result = pixelToData({ x: 0, y: 25 }, xMap, yMap, "proportion");
  assert.equal(result.time, 0);
  assert.equal(result.survival, 0.75);
});
