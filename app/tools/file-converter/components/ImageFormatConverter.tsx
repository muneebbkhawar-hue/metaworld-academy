"use client";

import { useState } from "react";
import JSZip from "jszip";
import { convertImage, loadBitmap } from "@/app/lib/fileConverter/imageConvert";
import { DropZone, DownloadLink, Busy, ErrText } from "./shared";

interface Converted { name: string; url: string; }

export default function ImageFormatConverter({ targetFormat, accept }: { targetFormat: "png" | "jpg"; accept: string }) {
  const [items, setItems] = useState<Converted[]>([]);
  const [background, setBackground] = useState("#ffffff");
  const [quality, setQuality] = useState(0.92);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList) {
    setBusy(true);
    setError(null);
    try {
      const results: Converted[] = [];
      for (const file of Array.from(files)) {
        const bitmap = await loadBitmap(file);
        const blob = await convertImage(bitmap, { format: targetFormat, background, quality });
        const name = file.name.replace(/\.[^.]+$/, "") + (targetFormat === "jpg" ? ".jpg" : ".png");
        results.push({ name, url: URL.createObjectURL(blob) });
      }
      setItems((prev) => [...prev, ...results]);
    } catch (err) {
      console.error("[file-converter] image conversion failed:", err);
      setError("One or more files could not be converted. Please check the file format and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadZip() {
    const zip = new JSZip();
    for (const item of items) {
      const blob = await fetch(item.url).then((r) => r.blob());
      zip.file(item.name, blob);
    }
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `converted-images.zip`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <DropZone accept={accept} multiple onFiles={handleFiles} label={`Drop ${targetFormat === "jpg" ? "PNG" : "JPG/JPEG"} files here (batch supported)`} />
      {targetFormat === "jpg" && (
        <div className="flex items-center gap-3 text-xs">
          <label htmlFor={`bg-${targetFormat}`} className="text-[var(--text-tertiary)]">Background for transparent areas</label>
          <input id={`bg-${targetFormat}`} type="color" value={background} onChange={(e) => setBackground(e.target.value)} className="w-8 h-6 rounded" />
          <label htmlFor={`q-${targetFormat}`} className="text-[var(--text-tertiary)] ml-3">Quality</label>
          <input id={`q-${targetFormat}`} type="range" min={0.5} max={1} step={0.01} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-24" />
          <span className="text-[var(--text-tertiary)]">{Math.round(quality * 100)}%</span>
        </div>
      )}
      {busy && <Busy label="Converting…" />}
      {error && <ErrText>{error}</ErrText>}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.length > 1 && (
            <button onClick={downloadZip} className="text-xs font-medium text-[var(--purple-bright)] hover:underline">Download all as ZIP ({items.length} files)</button>
          )}
          <div className="grid sm:grid-cols-2 gap-2">
            {items.map((it, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--bg-void)] px-3 py-2 text-xs">
                <span className="truncate text-[var(--text-secondary)]">{it.name}</span>
                <DownloadLink href={it.url} filename={it.name} label="Download" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
