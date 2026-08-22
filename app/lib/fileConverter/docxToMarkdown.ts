// DOCX -> Markdown, via mammoth (DOCX -> semantic HTML, preserving
// headings/paragraphs/bold/italic/lists/tables/links) then Turndown
// (HTML -> Markdown, with the GFM plugin for table syntax). Both run
// entirely client-side.
import mammoth from "mammoth";
import TurndownService from "turndown";
// @ts-expect-error - turndown-plugin-gfm has no bundled type declarations.
import { gfm } from "turndown-plugin-gfm";

export interface DocxMarkdownResult {
  markdown: string;
  warnings: string[];
}

export async function docxToMarkdown(file: File): Promise<DocxMarkdownResult> {
  const arrayBuffer = await file.arrayBuffer();
  const { value: html, messages } = await mammoth.convertToHtml({ arrayBuffer });

  const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced" });
  turndown.use(gfm);
  const markdown = turndown.turndown(html);

  const warnings = messages.filter((m) => m.type === "warning" || m.type === "error").map((m) => m.message);
  return { markdown, warnings };
}
