"use client";

import { useState } from "react";
import { convertImage, loadBitmap } from "@/app/lib/fileConverter/imageConvert";
import { DropZone, DownloadLink, Busy, ErrText } from "./shared";

export default function ImageResizeCompress() {
  const [file, setFile] = useState<File | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [maintainAspect, setMaintainAspect] = useState(true);
  const [format, setFormat] = useState<"png" | "jpg">("jpg");
  const [quality, setQuality] = useState(0.85);
  const [result, setResult] = useState<{ url: string; name: string; sizeKB: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(files: FileList) {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    const bmp = await loadBitmap(f);
    setNaturalSize({ w: bmp.width, h: bmp.height });
    setWidth(String(bmp.width));
    setHeight(String(bmp.height));
  }

  async function convert() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const bitmap = await loadBitmap(file);
      const blob = await convertImage(bitmap, {
        format, quality, maintainAspect,
        width: width ? Number(width) : undefined,
        height: height ? Number(height) : undefined,
      });
      const name = file.name.replace(/\.[^.]+$/, "") + (format === "jpg" ? ".jpg" : ".png");
      setResult({ url: URL.createObjectURL(blob), name, sizeKB: Math.round(blob.size / 1024) });
    } catch (err) {
      console.error("[file-converter] resize/compress failed:", err);
      setError("This image could not be processed. Please try a different file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <DropZone accept="image/*" onFiles={handleFile} label="Drop an image here" />
      {file && naturalSize && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-tertiary)]">{file.name} — original {naturalSize.w}×{naturalSize.h}px, {Math.round(file.size / 1024)} KB</p>
          <div className="grid sm:grid-cols-4 gap-3">
            <div>
              <label htmlFor="rc-width" className="block text-xs text-[var(--text-tertiary)] mb-1">Width (px)</label>
              <input id="rc-width" type="number" value={width} onChange={(e) => setWidth(e.target.value)} className="w-full bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label htmlFor="rc-height" className="block text-xs text-[var(--text-tertiary)] mb-1">Height (px)</label>
              <input id="rc-height" type="number" value={height} onChange={(e) => setHeight(e.target.value)} className="w-full bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label htmlFor="rc-format" className="block text-xs text-[var(--text-tertiary)] mb-1">Format</label>
              <select id="rc-format" value={format} onChange={(e) => setFormat(e.target.value as "png" | "jpg")} className="w-full bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg px-2 py-1.5 text-sm">
                <option value="jpg">JPG</option>
                <option value="png">PNG</option>
              </select>
            </div>
            {format === "jpg" && (
              <div>
                <label htmlFor="rc-quality" className="block text-xs text-[var(--text-tertiary)] mb-1">Quality ({Math.round(quality * 100)}%)</label>
                <input id="rc-quality" type="range" min={0.3} max={1} step={0.01} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full mt-2.5" />
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input type="checkbox" checked={maintainAspect} onChange={(e) => setMaintainAspect(e.target.checked)} /> Maintain aspect ratio
          </label>
          <button onClick={convert} className="px-4 py-2 rounded-lg text-white font-semibold text-sm" style={{ backgroundImage: "var(--gradient-primary)" }}>Process image</button>
        </div>
      )}
      {busy && <Busy label="Processing…" />}
      {error && <ErrText>{error}</ErrText>}
      {result && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--bg-void)] px-3 py-2 text-xs">
          <span className="text-[var(--text-secondary)]">{result.name} — {result.sizeKB} KB</span>
          <DownloadLink href={result.url} filename={result.name} />
        </div>
      )}
    </div>
  );
}
