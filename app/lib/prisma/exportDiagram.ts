// Export helpers for the PRISMA diagram — rasterizes the exact SVG string
// produced by svgBuilder.ts (never a DOM screenshot of the page), so the
// exported file contains only the diagram: no nav, no form, no buttons.
"use client";

export type ExportResolution = "standard" | "high";

const SCALE: Record<ExportResolution, number> = { standard: 2, high: 4 };

function svgToDataUrl(svg: string): string {
  const encoded = encodeURIComponent(svg).replace(/'/g, "%27").replace(/"/g, "%22");
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

function triggerDownload(href: string, filename: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadSvg(svg: string, filename: string) {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  URL.revokeObjectURL(url);
}

/** Rasterizes the SVG onto an offscreen canvas at the given resolution and returns a Blob. */
function rasterize(svg: string, width: number, height: number, resolution: ExportResolution, format: "png" | "jpeg", jpegBackground = "#FFFFFF"): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    const scale = SCALE[resolution];
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported in this browser."));
      if (format === "jpeg") {
        ctx.fillStyle = jpegBackground;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(blob),
        format === "jpeg" ? "image/jpeg" : "image/png",
        format === "jpeg" ? 0.95 : undefined
      );
    };
    img.onerror = () => reject(new Error("Failed to rasterize the diagram. Try SVG export instead."));
    img.src = svgToDataUrl(svg);
  });
}

export async function downloadPng(svg: string, width: number, height: number, filename: string, resolution: ExportResolution) {
  const blob = await rasterize(svg, width, height, resolution, "png");
  if (!blob) throw new Error("Could not generate a PNG image.");
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  URL.revokeObjectURL(url);
}

export async function downloadJpeg(svg: string, width: number, height: number, filename: string, resolution: ExportResolution) {
  const blob = await rasterize(svg, width, height, resolution, "jpeg");
  if (!blob) throw new Error("Could not generate a JPEG image.");
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  URL.revokeObjectURL(url);
}

// Optional PDF export — reuses the `jspdf` dependency already installed for
// other tools (no new package added). Embeds a high-resolution rasterized
// PNG of the diagram on a single page sized to the diagram itself, so the
// PDF contains only the figure, at a size suitable for a manuscript.
export async function downloadPdf(svg: string, width: number, height: number, filename: string) {
  const blob = await rasterize(svg, width, height, "high", "png");
  if (!blob) throw new Error("Could not generate a PDF.");
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the rasterized image."));
    reader.readAsDataURL(blob);
  });
  const { default: jsPDF } = await import("jspdf");
  // Points (72/in) at a 96dpi-equivalent scale so the page matches the
  // diagram's own aspect ratio rather than forcing it onto a fixed A4 page.
  const pdf = new jsPDF({ orientation: width >= height ? "landscape" : "portrait", unit: "pt", format: [width * 0.75, height * 0.75] });
  pdf.addImage(dataUrl, "PNG", 0, 0, width * 0.75, height * 0.75);
  pdf.save(filename);
}
