"use client";

// The interactive digitization workspace: shows the uploaded figure at full
// resolution with zoom/pan, and lets the user place calibration points,
// curve points, and censoring marks by clicking, all in pixel-space
// (conversion to data-space happens in the parent via app/tools/km-digitizer/lib/calibration.ts
// - this component only ever deals in pixel coordinates of the source image).
//
// Native <canvas> 2D, no charting/graphics library - this project's other
// tools already draw plots server-side in R (base64 PNG), so a small
// hand-rolled interactive canvas is the simplest fit for a click-to-place
// tool like this, matching the brief's "do not overcomplicate" instruction.
import { useCallback, useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import type { PixelPoint } from "../lib/types";

export type CanvasMode = "view" | "calibrate-x" | "calibrate-y" | "digitize" | "censoring" | "edit";

export interface CanvasCalibrationRef {
  pixel: PixelPoint;
  label: string;
}

export interface CanvasCurvePoint {
  id: string;
  pixel: PixelPoint;
  color: string;
}

export interface CanvasCensorMark {
  id: string;
  pixel: PixelPoint;
  color: string;
}

interface Props {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  mode: CanvasMode;
  xRefs: CanvasCalibrationRef[];
  yRefs: CanvasCalibrationRef[];
  visibleCurvePoints: CanvasCurvePoint[]; // points from all VISIBLE groups (active group rendered with emphasis by caller via color/order)
  activeGroupPointIds: Set<string>;
  censorMarks: CanvasCensorMark[];
  onCanvasClick: (pixel: PixelPoint) => void;
  onPointDragEnd?: (id: string, pixel: PixelPoint, kind: "curve" | "censor") => void;
  onPointRightClick?: (id: string, kind: "curve" | "censor") => void;
  height?: number;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 12;

export default function DigitizeCanvas({
  imageUrl,
  imageWidth,
  imageHeight,
  mode,
  xRefs,
  yRefs,
  visibleCurvePoints,
  activeGroupPointIds,
  censorMarks,
  onCanvasClick,
  onPointDragEnd,
  onPointRightClick,
  height = 560,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  // view = pan/zoom transform: screen = image*scale + offset
  const [view, setView] = useState({ scale: 1, offsetX: 0, offsetY: 0 });
  const dragState = useRef<{ panning: boolean; lastX: number; lastY: number; draggingPointId: string | null; draggingKind: "curve" | "censor" | null }>({
    panning: false,
    lastX: 0,
    lastY: 0,
    draggingPointId: null,
    draggingKind: null,
  });

  const fitToContainer = useCallback(() => {
    const el = containerRef.current;
    if (!el || !imageWidth || !imageHeight) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const scale = Math.min(cw / imageWidth, ch / imageHeight) * 0.96;
    setView({ scale, offsetX: (cw - imageWidth * scale) / 2, offsetY: (ch - imageHeight * scale) / 2 });
  }, [imageWidth, imageHeight]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (imgLoaded) fitToContainer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgLoaded]);

  const toScreen = useCallback((p: PixelPoint) => ({ x: p.x * view.scale + view.offsetX, y: p.y * view.scale + view.offsetY }), [view]);
  const toImage = useCallback((sx: number, sy: number): PixelPoint => ({ x: (sx - view.offsetX) / view.scale, y: (sy - view.offsetY) / view.scale }), [view]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const el = containerRef.current;
    const img = imgRef.current;
    if (!canvas || !el || !img) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    ctx.drawImage(img, view.offsetX, view.offsetY, imageWidth * view.scale, imageHeight * view.scale);

    // Calibration reference points (X = orange diamond, Y = teal diamond)
    const drawDiamond = (p: PixelPoint, color: string, label: string) => {
      const s = toScreen(p);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = color;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.fillRect(-6, -6, 12, 12);
      ctx.strokeRect(-6, -6, 12, 12);
      ctx.restore();
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "rgba(0,0,0,0.8)";
      ctx.font = "bold 11px sans-serif";
      ctx.lineWidth = 3;
      ctx.strokeText(label, s.x + 9, s.y - 9);
      ctx.fillText(label, s.x + 9, s.y - 9);
    };
    xRefs.forEach((r, i) => drawDiamond(r.pixel, "#f97316", `X${i + 1}: ${r.label}`));
    yRefs.forEach((r, i) => drawDiamond(r.pixel, "#0ea5e9", `Y${i + 1}: ${r.label}`));

    // Digitized curve points
    for (const p of visibleCurvePoints) {
      const s = toScreen(p.pixel);
      const isActive = activeGroupPointIds.has(p.id);
      ctx.beginPath();
      ctx.arc(s.x, s.y, isActive ? 5.5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = isActive ? 1 : 0.55;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = isActive ? "#ffffff" : "rgba(255,255,255,0.6)";
      ctx.lineWidth = isActive ? 1.5 : 1;
      ctx.stroke();
    }

    // Censoring marks: distinct tick/cross shape, always visually different from curve points
    for (const m of censorMarks) {
      const s = toScreen(m.pixel);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-5, -5);
      ctx.lineTo(5, 5);
      ctx.moveTo(5, -5);
      ctx.lineTo(-5, 5);
      ctx.stroke();
      ctx.restore();
    }
  }, [view, imageWidth, imageHeight, xRefs, yRefs, visibleCurvePoints, activeGroupPointIds, censorMarks, toScreen]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  function hitTestPoint(sx: number, sy: number): { id: string; kind: "curve" | "censor" } | null {
    const RADIUS = 9;
    for (const m of censorMarks) {
      const s = toScreen(m.pixel);
      if (Math.hypot(s.x - sx, s.y - sy) <= RADIUS) return { id: m.id, kind: "censor" };
    }
    for (const p of visibleCurvePoints) {
      const s = toScreen(p.pixel);
      if (Math.hypot(s.x - sx, s.y - sy) <= RADIUS) return { id: p.id, kind: "curve" };
    }
    return null;
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (mode === "edit") {
      const hit = hitTestPoint(sx, sy);
      if (hit) {
        dragState.current.draggingPointId = hit.id;
        dragState.current.draggingKind = hit.kind;
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        return;
      }
    }

    if (e.button === 1 || e.button === 2 || mode === "view") {
      dragState.current.panning = true;
      dragState.current.lastX = e.clientX;
      dragState.current.lastY = e.clientY;
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      return;
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (dragState.current.draggingPointId) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const img = toImage(e.clientX - rect.left, e.clientY - rect.top);
      onPointDragEnd?.(dragState.current.draggingPointId, img, dragState.current.draggingKind!);
      return;
    }
    if (dragState.current.panning) {
      const dx = e.clientX - dragState.current.lastX;
      const dy = e.clientY - dragState.current.lastY;
      dragState.current.lastX = e.clientX;
      dragState.current.lastY = e.clientY;
      setView((v) => ({ ...v, offsetX: v.offsetX + dx, offsetY: v.offsetY + dy }));
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (dragState.current.draggingPointId) {
      dragState.current.draggingPointId = null;
      dragState.current.draggingKind = null;
      return;
    }
    if (dragState.current.panning) {
      dragState.current.panning = false;
      return;
    }
    // A plain click (not a drag/pan) in a placement mode adds a point.
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    if (["calibrate-x", "calibrate-y", "digitize", "censoring"].includes(mode)) {
      onCanvasClick(toImage(sx, sy));
    } else if (mode === "edit") {
      const hit = hitTestPoint(sx, sy);
      if (hit && e.button === 2) onPointRightClick?.(hit.id, hit.kind);
    }
  }

  function handleContextMenu(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (mode !== "edit") return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const hit = hitTestPoint(e.clientX - rect.left, e.clientY - rect.top);
    if (hit) onPointRightClick?.(hit.id, hit.kind);
  }

  function handleWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setView((v) => {
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      const imgX = (sx - v.offsetX) / v.scale;
      const imgY = (sy - v.offsetY) / v.scale;
      return { scale: newScale, offsetX: sx - imgX * newScale, offsetY: sy - imgY * newScale };
    });
  }

  function zoomBy(factor: number) {
    const el = containerRef.current;
    if (!el) return;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    setView((v) => {
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      const imgX = (cx - v.offsetX) / v.scale;
      const imgY = (cy - v.offsetY) / v.scale;
      return { scale: newScale, offsetX: cx - imgX * newScale, offsetY: cy - imgY * newScale };
    });
  }

  const cursorClass =
    mode === "view" ? "cursor-grab" : mode === "edit" ? "cursor-move" : "cursor-crosshair";

  return (
    <div className="relative rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-void)] overflow-hidden" style={{ height }}>
      <div ref={containerRef} className="absolute inset-0">
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 ${cursorClass}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
          onContextMenu={handleContextMenu}
        />
      </div>
      <div className="absolute bottom-3 right-3 flex gap-1 bg-[var(--bg-elevated)]/90 backdrop-blur rounded-lg border border-[var(--border-subtle)] p-1">
        <button type="button" title="Zoom in" onClick={() => zoomBy(1.25)} className="p-2 rounded hover:bg-white/10 text-[var(--text-primary)]">
          <ZoomIn size={16} />
        </button>
        <button type="button" title="Zoom out" onClick={() => zoomBy(0.8)} className="p-2 rounded hover:bg-white/10 text-[var(--text-primary)]">
          <ZoomOut size={16} />
        </button>
        <button type="button" title="Reset view" onClick={fitToContainer} className="p-2 rounded hover:bg-white/10 text-[var(--text-primary)]">
          <Maximize2 size={16} />
        </button>
      </div>
      {!imgLoaded && (
        <div className="absolute inset-0 flex items-center justify-center text-[var(--text-secondary)] text-sm">Loading figure…</div>
      )}
    </div>
  );
}
