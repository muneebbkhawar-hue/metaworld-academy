// Client-side image conversion/resize/compress - pure canvas, no server, no
// upload. Used by Utilities A, B, and I (JPG<->PNG, resize/compress).

export interface ImageConvertOptions {
  format: "png" | "jpg";
  quality?: number; // 0-1, JPG only
  background?: string; // fill color when flattening transparency onto JPG
  width?: number; // target width - if set without height, aspect is preserved
  height?: number;
  maintainAspect?: boolean;
}

export async function loadBitmap(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

export function convertImage(bitmap: ImageBitmap, opts: ImageConvertOptions): Promise<Blob> {
  let targetW = opts.width ?? bitmap.width;
  let targetH = opts.height ?? bitmap.height;
  if (opts.maintainAspect !== false) {
    const aspect = bitmap.width / bitmap.height;
    if (opts.width && !opts.height) targetH = Math.round(opts.width / aspect);
    else if (opts.height && !opts.width) targetW = Math.round(opts.height * aspect);
    else if (opts.width && opts.height) {
      // fit within box, preserving aspect
      const boxAspect = opts.width / opts.height;
      if (aspect > boxAspect) { targetW = opts.width; targetH = Math.round(opts.width / aspect); }
      else { targetH = opts.height; targetW = Math.round(opts.height * aspect); }
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(targetW));
  canvas.height = Math.max(1, Math.round(targetH));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is not available in this browser.");

  if (opts.format === "jpg") {
    // JPG has no alpha channel - flatten transparency onto the chosen
    // background color rather than letting the browser silently composite
    // onto black (the default canvas behavior for toBlob('image/jpeg')).
    ctx.fillStyle = opts.background ?? "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Image encoding failed."))),
      opts.format === "jpg" ? "image/jpeg" : "image/png",
      opts.format === "jpg" ? (opts.quality ?? 0.9) : undefined
    );
  });
}
