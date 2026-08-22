// DOCX -> PDF. ARCHITECTURE NOTE (read before assuming this is
// pixel-perfect): there is no reliable way to convert arbitrary DOCX files
// to a high-fidelity PDF entirely client-side, and this project's
// deployment target (Vercel serverless) has no persistent filesystem and
// cannot run a system dependency like LibreOffice/Word - so a "real"
// DOCX-engine conversion is not available here. Instead:
//
//   DOCX -> semantic HTML (mammoth) -> rendered HTML -> PDF (jsPDF, using
//   html2canvas internally via jsPDF's .html() method)
//
// This preserves text content, headings, paragraphs, basic formatting,
// lists, tables, and links (whatever mammoth extracts), but it is a
// **rendered-HTML-to-image-based PDF**, not a native DOCX layout engine -
// complex Word-specific layout (headers/footers, precise pagination,
// certain styles) will not be reproduced exactly. This is disclosed to the
// user in the tool's UI, not hidden. If pixel-perfect fidelity is ever
// required, the correct fix is a dedicated server-side conversion service
// (e.g., a LibreOffice-based microservice) - deliberately out of scope
// here per the "do not fake it" requirement.
import mammoth from "mammoth";
import jsPDF from "jspdf";

export async function docxToPdfBlob(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

  const container = document.createElement("div");
  container.style.cssText = "position:fixed; left:-99999px; top:0; width:700px; padding:24px; background:#ffffff; color:#111111; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:1.5;";
  container.innerHTML = html || "<p>(This document appears to contain no extractable text.)</p>";
  document.body.appendChild(container);

  try {
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    await pdf.html(container, {
      width: 500, // content width in pt, fits within A4 margins
      windowWidth: 700, // matches container's px width for consistent scaling
      margin: [40, 40, 40, 40],
      autoPaging: "text",
    });
    return pdf.output("blob");
  } finally {
    document.body.removeChild(container);
  }
}
