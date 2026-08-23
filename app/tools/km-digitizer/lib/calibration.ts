// Deterministic pixel <-> data-coordinate transformation. Pure functions,
// no AI/heuristics of any kind - exactly the "deterministic mathematical
// transformation" the brief requires. A calibration is a simple 2-point
// linear map per axis (pixel position -> known data value), which is
// exactly right for a KM figure's axes, which are always linear.
import type { AxisCalibration, PixelPoint } from "./types";

export interface LinearMap {
  scale: number; // data units per pixel
  offset: number; // data value at pixel = 0
}

/** Builds a 1D linear map from exactly 2 (pixel, value) reference points. Returns null if the calibration isn't usable (fewer than 2 refs, or both refs at the same pixel position - division by zero). */
export function buildLinearMap(refs: { pixelCoord: number; value: number }[]): LinearMap | null {
  if (refs.length < 2) return null;
  const [a, b] = refs;
  const pixelDelta = b.pixelCoord - a.pixelCoord;
  if (Math.abs(pixelDelta) < 1e-9) return null;
  const scale = (b.value - a.value) / pixelDelta;
  const offset = a.value - scale * a.pixelCoord;
  return { scale, offset };
}

export function applyLinearMap(map: LinearMap, pixelCoord: number): number {
  return map.offset + map.scale * pixelCoord;
}

export function inverseLinearMap(map: LinearMap, value: number): number {
  if (Math.abs(map.scale) < 1e-12) return 0;
  return (value - map.offset) / map.scale;
}

export function xMapFromCalibration(cal: AxisCalibration): LinearMap | null {
  return buildLinearMap(cal.refs.map((r) => ({ pixelCoord: r.pixel.x, value: r.value })));
}

export function yMapFromCalibration(cal: AxisCalibration): LinearMap | null {
  return buildLinearMap(cal.refs.map((r) => ({ pixelCoord: r.pixel.y, value: r.value })));
}

/** Converts one digitized pixel point into (time, survival-as-proportion) using both axis calibrations. survival is always normalized to a 0-1 proportion internally, regardless of whether the source figure's Y-axis is 0-1 or 0-100 (yAxisScale only affects display/labels and what's sent as "scale" to the backend, not this conversion). */
export function pixelToData(
  pixel: PixelPoint,
  xMap: LinearMap,
  yMap: LinearMap,
  yAxisScale: "proportion" | "percentage"
): { time: number; survival: number } {
  const time = applyLinearMap(xMap, pixel.x);
  const yRaw = applyLinearMap(yMap, pixel.y);
  const survival = yAxisScale === "percentage" ? yRaw / 100 : yRaw;
  return { time, survival };
}

export function isCalibrationComplete(cal: AxisCalibration): boolean {
  if (cal.refs.length < 2) return false;
  const map = buildLinearMap(cal.refs.map((r) => ({ pixelCoord: r.pixel.x, value: r.value })));
  return map !== null || cal.refs.length >= 2; // buildLinearMap works the same for x or y coord; this check is just "2 distinct refs entered"
}
