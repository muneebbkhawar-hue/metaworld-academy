"use client";

// Handles file upload + validation + (for PDFs) page selection and
// high-resolution rendering, entirely client-side - no upload to any
// server. Reuses the project's existing PDF.js helpers
// (app/lib/fileConverter/pdf.ts) rather than adding a second PDF pipeline.
import { useState } from "react";
import { UploadCloud, FileWarning } from "lucide-react";
import { loadPdfDocument, renderPageToBlob } from "@/app/lib/fileConverter/pdf";
import type { SourceFileMeta } from "../lib/types";

const MAX_SIZE_BYTES = 40 * 1024 * 1024; // 40MB - generous for a high-res figure/PDF, still bounded
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/tiff"];

interface Props {
  onLoaded: (meta: SourceFileMeta, dataUrl: string, width: number, height: number) => void;
}

export default function UploadStep({ onLoaded }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pdfState, setPdfState] = useState<{ file: File; pageCount: number } | null>(null);
  const [selectedPage, setSelectedPage] = useState(1);

  function validate(file: File): string | null {
    if (file.size === 0) return "The selected file is empty.";
    if (file.size > MAX_SIZE_BYTES) return `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 40MB.`;
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type) || /\.(png|jpe?g|tiff?)$/i.test(file.name);
    if (!isPdf && !isImage) return "Unsupported file type. Please upload a PNG, JPG, TIFF, or PDF.";
    return null;
  }

  async function loadImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("The image file appears to be corrupted or malformed."));
      img.src = dataUrl;
    });
  }

  async function handleFile(file: File) {
    setError(null);
    const validationError = validate(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (isPdf) {
      setBusy(true);
      try {
        const pdf = await loadPdfDocument(file);
        setPdfState({ file, pageCount: pdf.numPages });
        setSelectedPage(1);
      } catch {
        setError("This PDF could not be opened - it may be malformed, corrupted, or password-protected.");
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Could not read the file."));
        reader.readAsDataURL(file);
      });
      const { width, height } = await loadImageDimensions(dataUrl);
      onLoaded(
        { name: file.name, type: file.type || "image", sizeBytes: file.size, uploadedAt: new Date().toISOString() },
        dataUrl,
        width,
        height
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this image.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmPdfPage() {
    if (!pdfState) return;
    setBusy(true);
    setError(null);
    try {
      const pdf = await loadPdfDocument(pdfState.file);
      const blob = await renderPageToBlob(pdf, selectedPage, "publication", "png");
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Could not render the selected page."));
        reader.readAsDataURL(blob);
      });
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("The rendered page image could not be loaded."));
        img.src = dataUrl;
      });
      onLoaded(
        {
          name: pdfState.file.name,
          type: "application/pdf",
          sizeBytes: pdfState.file.size,
          pdfPageNumber: selectedPage,
          pdfPageCount: pdfState.pageCount,
          uploadedAt: new Date().toISOString(),
        },
        dataUrl,
        img.naturalWidth,
        img.naturalHeight
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not render this PDF page.");
    } finally {
      setBusy(false);
    }
  }

  if (pdfState) {
    return (
      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 flex flex-col gap-4 max-w-md">
        <p className="text-sm text-[var(--text-secondary)]">
          {pdfState.file.name} has {pdfState.pageCount} page{pdfState.pageCount === 1 ? "" : "s"}. Select the page containing the
          Kaplan–Meier figure.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={pdfState.pageCount}
            value={selectedPage}
            onChange={(e) => setSelectedPage(Math.min(pdfState.pageCount, Math.max(1, parseInt(e.target.value) || 1)))}
            className="w-24 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-void)] px-3 py-2 text-sm"
          />
          <span className="text-sm text-[var(--text-secondary)]">of {pdfState.pageCount}</span>
        </div>
        {error && <p className="text-sm text-red-500 flex items-center gap-2"><FileWarning size={14} /> {error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={confirmPdfPage}
            disabled={busy}
            className="px-5 py-2 rounded-lg text-white font-semibold text-sm disabled:opacity-60"
            style={{ backgroundImage: "var(--gradient-primary)" }}
          >
            {busy ? "Rendering…" : "Use this page"}
          </button>
          <button
            type="button"
            onClick={() => setPdfState(null)}
            className="px-5 py-2 rounded-lg border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)]"
          >
            Choose a different file
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <label
        className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-10 cursor-pointer hover:border-[var(--purple-bright)] transition"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        <UploadCloud size={32} className="text-[var(--purple-bright)]" />
        <span className="text-sm text-[var(--text-primary)] font-medium">Click or drag a KM figure here</span>
        <span className="text-xs text-[var(--text-secondary)]">PNG, JPG, TIFF, or PDF — up to 40MB</span>
        <input
          type="file"
          accept=".png,.jpg,.jpeg,.tif,.tiff,.pdf,image/png,image/jpeg,image/tiff,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </label>
      {busy && <p className="text-sm text-[var(--text-secondary)] mt-3">Loading…</p>}
      {error && <p className="text-sm text-red-500 mt-3 flex items-center gap-2"><FileWarning size={14} /> {error}</p>}
    </div>
  );
}
