"use client";

// File Converter dashboard - PDF/Word/Image utilities. Every conversion
// runs entirely in the browser (privacy: files never leave the device),
// except none of these need a server at all - see DOCS.md for the
// per-utility client/server breakdown and Vercel-compatibility notes.
import { FileStack, Image as ImageIcon, FileText, FileType, Files } from "lucide-react";
import NavComp from "@/app/components/Nav";
import Footer from "@/app/components/Footer";
import FadeIn from "@/app/components/FadeIn";
import Accordion from "@/app/components/Accordion";
import ImageFormatConverter from "./components/ImageFormatConverter";
import ImageResizeCompress from "./components/ImageResizeCompress";
import PdfToImage from "./components/PdfToImage";
import PdfToMarkdown from "./components/PdfToMarkdown";
import PdfToWord from "./components/PdfToWord";
import DocxToMarkdown from "./components/DocxToMarkdown";
import DocxToPdf from "./components/DocxToPdf";

export default function FileConverterPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)] font-sans">
      <NavComp />
      <main className="max-w-4xl mx-auto px-6 py-16 space-y-8">
        <FadeIn>
          <div className="flex items-center gap-3 mb-3">
            <Files size={26} className="text-[var(--purple-bright)]" />
            <h1 className="text-3xl md:text-4xl font-bold">PDF / Word / Image Utilities</h1>
          </div>
          <p className="text-[var(--text-secondary)] max-w-2xl">
            Practical document and image conversion tools for manuscript preparation and journal submission. All
            processing happens in your browser - files are never uploaded anywhere.
          </p>
        </FadeIn>

        <FadeIn delay={0.05}>
          <Accordion title="JPG/JPEG → PNG" description="Batch-convert JPG images to PNG, preserving dimensions and quality." icon={<ImageIcon size={18} className="text-[var(--purple-bright)]" />}>
            <ImageFormatConverter targetFormat="png" accept="image/jpeg" />
          </Accordion>
        </FadeIn>
        <FadeIn delay={0.07}>
          <Accordion title="PNG → JPG" description="Batch-convert PNG images to JPG, with background and quality control for transparency." icon={<ImageIcon size={18} className="text-[var(--purple-bright)]" />}>
            <ImageFormatConverter targetFormat="jpg" accept="image/png" />
          </Accordion>
        </FadeIn>
        <FadeIn delay={0.09}>
          <Accordion title="PDF → PNG" description="Render selected PDF pages as high-resolution PNG images." icon={<FileStack size={18} className="text-[var(--purple-bright)]" />}>
            <PdfToImage format="png" />
          </Accordion>
        </FadeIn>
        <FadeIn delay={0.11}>
          <Accordion title="PDF → JPG" description="Render selected PDF pages as JPG images." icon={<FileStack size={18} className="text-[var(--purple-bright)]" />}>
            <PdfToImage format="jpg" />
          </Accordion>
        </FadeIn>
        <FadeIn delay={0.13}>
          <Accordion title="Word → PDF" description="Convert a .docx file to PDF via HTML rendering (see the in-tool notice for fidelity limitations)." icon={<FileType size={18} className="text-[var(--purple-bright)]" />}>
            <DocxToPdf />
          </Accordion>
        </FadeIn>
        <FadeIn delay={0.15}>
          <Accordion title="PDF → Word" description="Extract text and basic structure from a PDF into a .docx file." icon={<FileText size={18} className="text-[var(--purple-bright)]" />}>
            <PdfToWord />
          </Accordion>
        </FadeIn>
        <FadeIn delay={0.17}>
          <Accordion title="PDF → Markdown" description="Extract headings, paragraphs, lists, tables, and links from a PDF as Markdown." icon={<FileText size={18} className="text-[var(--purple-bright)]" />}>
            <PdfToMarkdown />
          </Accordion>
        </FadeIn>
        <FadeIn delay={0.19}>
          <Accordion title="DOCX → Markdown" description="Convert a .docx file to Markdown, preserving headings, formatting, lists, tables, and links." icon={<FileText size={18} className="text-[var(--purple-bright)]" />}>
            <DocxToMarkdown />
          </Accordion>
        </FadeIn>
        <FadeIn delay={0.21}>
          <Accordion title="Image Resize / Compress" description="Resize and compress a single image for journal submission requirements." icon={<ImageIcon size={18} className="text-[var(--purple-bright)]" />}>
            <ImageResizeCompress />
          </Accordion>
        </FadeIn>
      </main>
      <Footer />
    </div>
  );
}
