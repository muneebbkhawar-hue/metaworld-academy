"use client";

// Collage Maker - entirely client-side (privacy: images never leave the
// browser). Uses the shared canvas rendering engine in
// app/lib/collage/render.ts for both the live preview and the final export,
// so what you see is exactly what gets downloaded.
import { useEffect, useMemo, useRef, useState } from "react";
import { UploadCloud, Trash2, Copy, GripVertical, Download, RotateCcw, LayoutGrid } from "lucide-react";
import NavComp from "@/app/components/Nav";
import Footer from "@/app/components/Footer";
import FadeIn from "@/app/components/FadeIn";
import { autoArrange, alphabetLabel, type Panel, type CollageConfig, type LabelPosition, type FitMode } from "@/app/lib/collage/types";
import { renderCollage, canvasToBlob } from "@/app/lib/collage/render";

const PRESET_LAYOUTS: { rows: number; cols: number; label: string }[] = [
  { rows: 1, cols: 1, label: "1 × 1" }, { rows: 1, cols: 2, label: "1 × 2" }, { rows: 2, cols: 1, label: "2 × 1" },
  { rows: 2, cols: 2, label: "2 × 2" }, { rows: 2, cols: 3, label: "2 × 3" }, { rows: 3, cols: 2, label: "3 × 2" },
  { rows: 3, cols: 3, label: "3 × 3" },
];

let idCounter = 0;

export default function CollageMakerPage() {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [layoutMode, setLayoutMode] = useState<"auto" | "preset" | "custom">("auto");
  const [presetIdx, setPresetIdx] = useState(3);
  const [customRows, setCustomRows] = useState(2);
  const [customCols, setCustomCols] = useState(2);
  const [fit, setFit] = useState<FitMode>("contain");
  const [labelsEnabled, setLabelsEnabled] = useState(true);
  const [autoLabels, setAutoLabels] = useState(true);
  const [labelPosition, setLabelPosition] = useState<LabelPosition>("top-left");
  const [labelSize, setLabelSize] = useState(22);
  const [labelBold, setLabelBold] = useState(true);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [sharedCaption, setSharedCaption] = useState("");
  const [outerMargin, setOuterMargin] = useState(24);
  const [gapH, setGapH] = useState(12);
  const [gapV, setGapV] = useState(12);
  const [panelPadding, setPanelPadding] = useState(8);
  const [background, setBackground] = useState("#ffffff");
  const [borderWidth, setBorderWidth] = useState(1);
  const [borderColor, setBorderColor] = useState("#d0d0d0");
  const [outputWidth, setOutputWidth] = useState(2000);
  const [format, setFormat] = useState<"png" | "jpg">("png");
  const [quality, setQuality] = useState(0.92);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const layout = useMemo(() => {
    if (layoutMode === "auto") return autoArrange(panels.length);
    if (layoutMode === "preset") return { rows: PRESET_LAYOUTS[presetIdx].rows, cols: PRESET_LAYOUTS[presetIdx].cols };
    return { rows: Math.max(1, customRows), cols: Math.max(1, customCols) };
  }, [layoutMode, presetIdx, customRows, customCols, panels.length]);

  const config: CollageConfig = useMemo(
    () => ({
      layout,
      fit,
      labels: { enabled: labelsEnabled, position: labelPosition, fontSize: labelSize, bold: labelBold, fontFamily: "Arial, sans-serif" },
      spacing: { outerMargin, gapH, gapV, panelPadding, background, borderWidth, borderColor },
      sharedCaption,
      captionsEnabled,
      outputWidth,
    }),
    [layout, fit, labelsEnabled, labelPosition, labelSize, labelBold, outerMargin, gapH, gapV, panelPadding, background, borderWidth, borderColor, sharedCaption, captionsEnabled, outputWidth]
  );

  useEffect(() => {
    if (canvasRef.current && panels.length > 0) renderCollage(canvasRef.current, panels, config);
  }, [panels, config]);

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => /^image\/(png|jpe?g|webp|svg\+xml)$/.test(f.type));
    const newPanels: Panel[] = [];
    for (const file of list) {
      try {
        const bitmap = await createImageBitmap(file);
        newPanels.push({ id: `p${idCounter++}`, file, bitmap, label: "", caption: "" });
      } catch (err) {
        console.error("[collage-maker] failed to decode image:", file.name, err);
      }
    }
    setPanels((prev) => {
      const merged = [...prev, ...newPanels];
      return autoLabels ? merged.map((p, i) => ({ ...p, label: alphabetLabel(i) })) : merged;
    });
  }

  function removePanel(id: string) {
    setPanels((prev) => {
      const next = prev.filter((p) => p.id !== id);
      return autoLabels ? next.map((p, i) => ({ ...p, label: alphabetLabel(i) })) : next;
    });
  }
  function duplicatePanel(id: string) {
    setPanels((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx === -1) return prev;
      const copy: Panel = { ...prev[idx], id: `p${idCounter++}` };
      const next = [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
      return autoLabels ? next.map((p, i) => ({ ...p, label: alphabetLabel(i) })) : next;
    });
  }
  function updateCaption(id: string, caption: string) {
    setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, caption } : p)));
  }
  function updateLabel(id: string, label: string) {
    setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, label } : p)));
  }
  function reorder(from: number, to: number) {
    setPanels((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return autoLabels ? next.map((p, i) => ({ ...p, label: alphabetLabel(i) })) : next;
    });
  }
  function resetAll() {
    setPanels([]);
    setLayoutMode("auto");
  }

  async function exportCollage() {
    if (!canvasRef.current || panels.length === 0) return;
    const blob = await canvasToBlob(canvasRef.current, format, quality);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `collage.${format === "jpg" ? "jpg" : "png"}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportPanel(p: Panel) {
    const c = document.createElement("canvas");
    c.width = p.bitmap.width;
    c.height = p.bitmap.height;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(p.bitmap, 0, 0);
    const blob = await canvasToBlob(c, "png", 1);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${p.label || "panel"}.png`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)] font-sans">
      <NavComp />
      <main className="max-w-7xl mx-auto px-6 py-16 space-y-10">
        <FadeIn>
          <div className="flex items-center gap-3 mb-3">
            <LayoutGrid size={26} className="text-[var(--purple-bright)]" />
            <h1 className="text-3xl md:text-4xl font-bold">Collage Maker</h1>
          </div>
          <p className="text-[var(--text-secondary)] max-w-2xl">
            Build publication-ready figure collages with panel labels (A, B, C…) and captions - entirely in your browser.
            Nothing is uploaded anywhere.
          </p>
        </FadeIn>

        <FadeIn delay={0.05}>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            className="rounded-2xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center"
          >
            <UploadCloud size={26} className="mx-auto text-[var(--text-tertiary)] mb-2" />
            <p className="text-[var(--text-secondary)] mb-3 text-sm">Drag &amp; drop images here (PNG, JPG, WebP, SVG)</p>
            <label className="inline-block px-4 py-2 rounded-lg text-white font-medium cursor-pointer text-sm" style={{ backgroundImage: "var(--gradient-primary)" }}>
              Choose images
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" multiple className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
            </label>
          </div>
        </FadeIn>

        {panels.length > 0 && (
          <>
            <FadeIn delay={0.08}>
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Panels ({panels.length}) — drag to reorder</h2>
              <div className="flex flex-wrap gap-3">
                {panels.map((p, i) => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (dragIndex !== null && dragIndex !== i) reorder(dragIndex, i); setDragIndex(null); }}
                    className="w-40 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 space-y-1.5 cursor-move"
                  >
                    <div className="flex items-center justify-between">
                      <GripVertical size={14} className="text-[var(--text-tertiary)]" />
                      <div className="flex gap-1">
                        <button onClick={() => duplicatePanel(p.id)} aria-label={`Duplicate panel ${p.label}`} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--purple-bright)]"><Copy size={13} /></button>
                        <button onClick={() => removePanel(p.id)} aria-label={`Delete panel ${p.label}`} className="p-1 text-[var(--text-tertiary)] hover:text-rose-400"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={URL.createObjectURL(p.file)} alt={`Panel ${p.label}`} className="w-full h-20 object-contain bg-[var(--bg-void)] rounded" />
                    <input
                      value={p.label}
                      onChange={(e) => updateLabel(p.id, e.target.value)}
                      disabled={autoLabels}
                      aria-label={`Label for panel ${i + 1}`}
                      className="w-full bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-primary)] disabled:opacity-50"
                    />
                    {captionsEnabled && (
                      <input
                        value={p.caption}
                        onChange={(e) => updateCaption(p.id, e.target.value)}
                        placeholder="Caption…"
                        aria-label={`Caption for panel ${i + 1}`}
                        className="w-full bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
                      />
                    )}
                    <button onClick={() => exportPanel(p)} className="w-full text-[11px] text-[var(--purple-bright)] hover:underline">Download panel</button>
                  </div>
                ))}
              </div>
            </FadeIn>

            <FadeIn delay={0.1}>
              <div className="grid lg:grid-cols-[320px_1fr] gap-6">
                <div className="space-y-5">
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-3">
                    <h3 className="text-sm font-semibold">Layout</h3>
                    <div className="flex gap-2 text-xs">
                      {(["auto", "preset", "custom"] as const).map((m) => (
                        <button key={m} onClick={() => setLayoutMode(m)} aria-pressed={layoutMode === m}
                          className={`px-2.5 py-1.5 rounded-md border ${layoutMode === m ? "border-[var(--border-hover)] text-[var(--purple-bright)]" : "border-[var(--border-subtle)] text-[var(--text-tertiary)]"}`}>
                          {m === "auto" ? "Auto arrange" : m === "preset" ? "Preset grid" : "Custom grid"}
                        </button>
                      ))}
                    </div>
                    {layoutMode === "preset" && (
                      <select value={presetIdx} onChange={(e) => setPresetIdx(Number(e.target.value))} className="w-full bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg px-2 py-1.5 text-sm">
                        {PRESET_LAYOUTS.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}
                      </select>
                    )}
                    {layoutMode === "custom" && (
                      <div className="flex gap-2">
                        <input type="number" min={1} value={customRows} onChange={(e) => setCustomRows(Number(e.target.value))} className="w-full bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg px-2 py-1.5 text-sm" aria-label="Rows" />
                        <input type="number" min={1} value={customCols} onChange={(e) => setCustomCols(Number(e.target.value))} className="w-full bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg px-2 py-1.5 text-sm" aria-label="Columns" />
                      </div>
                    )}
                    <p className="text-[11px] text-[var(--text-tertiary)]">Current: {layout.rows} × {layout.cols}</p>
                    <div>
                      <label htmlFor="fit-select" className="block text-xs text-[var(--text-tertiary)] mb-1">Image fit</label>
                      <select id="fit-select" value={fit} onChange={(e) => setFit(e.target.value as FitMode)} className="w-full bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg px-2 py-1.5 text-sm">
                        <option value="contain">Contain (never crop)</option>
                        <option value="cover">Cover (fills cell, may crop)</option>
                      </select>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-3">
                    <h3 className="text-sm font-semibold">Labels</h3>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={labelsEnabled} onChange={(e) => setLabelsEnabled(e.target.checked)} /> Show panel labels</label>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={autoLabels} onChange={(e) => { setAutoLabels(e.target.checked); if (e.target.checked) setPanels((prev) => prev.map((p, i) => ({ ...p, label: alphabetLabel(i) }))); }} /> Automatic alphabetical labels</label>
                    <select value={labelPosition} onChange={(e) => setLabelPosition(e.target.value as LabelPosition)} className="w-full bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg px-2 py-1.5 text-sm">
                      <option value="top-left">Top left</option>
                      <option value="top-center">Top center</option>
                      <option value="bottom-left">Bottom left</option>
                      <option value="bottom-center">Bottom center</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <label htmlFor="label-size" className="text-xs text-[var(--text-tertiary)]">Size</label>
                      <input id="label-size" type="number" value={labelSize} onChange={(e) => setLabelSize(Number(e.target.value))} className="w-20 bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg px-2 py-1 text-sm" />
                      <label className="flex items-center gap-1.5 text-xs ml-auto"><input type="checkbox" checked={labelBold} onChange={(e) => setLabelBold(e.target.checked)} /> Bold</label>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-3">
                    <h3 className="text-sm font-semibold">Captions</h3>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={captionsEnabled} onChange={(e) => setCaptionsEnabled(e.target.checked)} /> Show per-panel captions</label>
                    <div>
                      <label htmlFor="shared-caption" className="block text-xs text-[var(--text-tertiary)] mb-1">Shared caption (beneath entire collage)</label>
                      <textarea id="shared-caption" value={sharedCaption} onChange={(e) => setSharedCaption(e.target.value)} rows={2} className="w-full bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg px-2 py-1.5 text-sm" />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-3">
                    <h3 className="text-sm font-semibold">Spacing</h3>
                    {([
                      ["Outer margin", outerMargin, setOuterMargin], ["Gap (horizontal)", gapH, setGapH],
                      ["Gap (vertical)", gapV, setGapV], ["Panel padding", panelPadding, setPanelPadding],
                      ["Border width", borderWidth, setBorderWidth],
                    ] as [string, number, (n: number) => void][]).map(([label, val, setter]) => (
                      <div key={label} className="flex items-center justify-between gap-2">
                        <label className="text-xs text-[var(--text-tertiary)]">{label}</label>
                        <input type="number" min={0} value={val} onChange={(e) => setter(Number(e.target.value))} className="w-20 bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg px-2 py-1 text-sm" />
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="bg-color" className="text-xs text-[var(--text-tertiary)]">Background</label>
                      <input id="bg-color" type="color" value={background} onChange={(e) => setBackground(e.target.value)} className="w-10 h-8 rounded" />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="border-color" className="text-xs text-[var(--text-tertiary)]">Border color</label>
                      <input id="border-color" type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} className="w-10 h-8 rounded" />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-3">
                    <h3 className="text-sm font-semibold">Export</h3>
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="out-width" className="text-xs text-[var(--text-tertiary)]">Output width (px)</label>
                      <input id="out-width" type="number" min={200} step={100} value={outputWidth} onChange={(e) => setOutputWidth(Number(e.target.value))} className="w-24 bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg px-2 py-1 text-sm" />
                    </div>
                    <div className="flex gap-2 text-xs">
                      <button onClick={() => setFormat("png")} aria-pressed={format === "png"} className={`px-3 py-1.5 rounded-md border ${format === "png" ? "border-[var(--border-hover)] text-[var(--purple-bright)]" : "border-[var(--border-subtle)] text-[var(--text-tertiary)]"}`}>PNG (lossless)</button>
                      <button onClick={() => setFormat("jpg")} aria-pressed={format === "jpg"} className={`px-3 py-1.5 rounded-md border ${format === "jpg" ? "border-[var(--border-hover)] text-[var(--purple-bright)]" : "border-[var(--border-subtle)] text-[var(--text-tertiary)]"}`}>JPG</button>
                    </div>
                    {format === "jpg" && (
                      <div className="flex items-center gap-2">
                        <label htmlFor="jpg-quality" className="text-xs text-[var(--text-tertiary)]">Quality</label>
                        <input id="jpg-quality" type="range" min={0.5} max={1} step={0.01} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="flex-1" />
                        <span className="text-xs text-[var(--text-tertiary)] w-10">{Math.round(quality * 100)}%</span>
                      </div>
                    )}
                    <button onClick={exportCollage} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-white font-semibold text-sm" style={{ backgroundImage: "var(--gradient-primary)" }}>
                      <Download size={15} /> Download {format.toUpperCase()}
                    </button>
                    <button onClick={resetAll} className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                      <RotateCcw size={14} /> Reset
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
                  <p className="text-xs text-[var(--text-tertiary)] mb-2">Live preview</p>
                  <div className="overflow-auto max-h-[80vh] rounded-lg border border-[var(--border-subtle)] bg-[repeating-conic-gradient(#e5e5e5_0%_25%,#ffffff_0%_50%)] [background-size:20px_20px]">
                    <canvas ref={canvasRef} className="max-w-full" />
                  </div>
                </div>
              </div>
            </FadeIn>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
