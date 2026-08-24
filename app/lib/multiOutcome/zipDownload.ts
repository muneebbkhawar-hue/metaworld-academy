"use client";

// Batch "download all X plots" helper - bundles every successful outcome's
// base64 PNG into one ZIP, using this project's existing jszip dependency
// (already used elsewhere - not a new dependency).
import JSZip from "jszip";
import { sanitizeFilenamePart } from "./filenames";

export interface ZipEntry {
  outcomeName: string;
  base64Png: string; // "data:image/png;base64,...."
}

export async function downloadPlotsAsZip(entries: ZipEntry[], zipFilename: string, filenamePrefix: string) {
  const zip = new JSZip();
  for (const entry of entries) {
    const base64Data = entry.base64Png.split(",")[1] ?? entry.base64Png;
    zip.file(`${filenamePrefix}_${sanitizeFilenamePart(entry.outcomeName)}.png`, base64Data, { base64: true });
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = zipFilename;
  link.click();
  URL.revokeObjectURL(link.href);
}
