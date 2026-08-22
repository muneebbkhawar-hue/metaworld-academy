// Deterministic (zero-AI-cost) evidence verification, run server-side on
// every extraction before it's returned to the client. Two layers, mirroring
// app/lib/ai/evidenceValidator.ts's pattern for the Risk of Bias tool:
//
//  1. Semantic consistency checks a Zod shape schema can't express (e.g. a
//     "reported" status requires a non-empty quote; a page number must be
//     within the PDF's actual page count).
//  2. A genuine substring check of every evidence quote against the PDF's
//     OWN real extracted text (serverPdfText.ts) - catching a fabricated or
//     paraphrased-as-verbatim quote that Gemini claims is a direct citation.
//
// Never silently "fixes" a record - only flags it (quote_verified=false,
// verification_note set) so the UI and quality_flags surface it.
import type { Evidence, StudyExtraction } from "./types";
import { extractServerPdfText, type ServerPageText } from "./serverPdfText.ts";

// Normalizes whitespace/case/hyphenation for a forgiving-but-genuine
// substring match - real PDF text extraction often collapses/adds spaces
// around hyphens, ligatures, and line-wraps that don't affect the actual
// content match.
function normalize(s: string): string {
  return s.toLowerCase().replace(/[‐-―]/g, "-").replace(/\s+/g, " ").trim();
}

function quoteAppearsOnPage(quote: string, page: ServerPageText | undefined): boolean {
  if (!page) return false;
  const needle = normalize(quote);
  if (needle.length < 3) return false;
  return normalize(page.text).includes(needle);
}

function quoteAppearsAnywhere(quote: string, pages: ServerPageText[]): boolean {
  return pages.some((p) => quoteAppearsOnPage(quote, p));
}

/** Verifies one evidence object in place (returns a new object; never
 * mutates). `pages` is null when PDF text extraction failed - in that case
 * verification is marked unavailable (quote_verified=null), never "false". */
export function verifyEvidence(evidence: Evidence, pages: ServerPageText[] | null, pageCount: number | null): Evidence {
  const out: Evidence = { ...evidence, quote_verified: null, verification_note: null };

  // Semantic rule: a "reported" status should carry a quote when a quote is
  // meaningfully expected. Not an error by itself (short-form table data
  // may reasonably have no verbatim quote), but flagged if BOTH quote and
  // location are missing for a "reported" claim.
  if (evidence.status === "reported" && !evidence.quote && !evidence.location) {
    out.verification_note = "Marked as reported but no supporting quote or location was given - verify manually.";
  }

  if (evidence.page !== null && pageCount !== null && (evidence.page < 1 || evidence.page > pageCount)) {
    out.quote_verified = false;
    out.verification_note = `Cited page ${evidence.page} is outside this PDF's actual page range (1-${pageCount}).`;
    return out;
  }

  if (!evidence.quote) {
    // Nothing to verify - leave quote_verified as null ("not applicable"),
    // not false.
    return out;
  }

  if (!pages) {
    out.verification_note = "PDF text could not be re-extracted server-side for quote verification (verification unavailable, not a failure of the quote itself).";
    return out;
  }

  const page = evidence.page !== null ? pages.find((p) => p.pageNum === evidence.page) : undefined;
  const foundOnCitedPage = page ? quoteAppearsOnPage(evidence.quote, page) : false;
  if (foundOnCitedPage) {
    out.quote_verified = true;
    return out;
  }

  const foundAnywhere = quoteAppearsAnywhere(evidence.quote, pages);
  if (foundAnywhere) {
    out.quote_verified = true;
    out.verification_note = evidence.page !== null ? "Quote found in the PDF, but not on the cited page - page number may be incorrect." : "Quote found in the PDF.";
    return out;
  }

  out.quote_verified = false;
  out.verification_note = "This exact quote could not be located in the PDF's extracted text - it may be paraphrased, fabricated, or from a scanned/image region with no text layer.";
  return out;
}

/** Runs verification over an entire study extraction, returning a new
 * StudyExtraction with every evidence object verified and quality_flags
 * populated with a summary count. Never throws - a PDF text extraction
 * failure degrades to "verification unavailable" per-item, not a crash. */
export async function verifyStudyExtraction(extraction: StudyExtraction, pdfBuffer: Buffer): Promise<StudyExtraction> {
  const pages = await extractServerPdfText(pdfBuffer);
  const pageCount = pages ? pages.length : null;

  const mapEv = (e: Evidence) => verifyEvidence(e, pages, pageCount);

  const verified: StudyExtraction = {
    ...extraction,
    study_characteristics: extraction.study_characteristics.map((c) => ({ ...c, evidence: mapEv(c.evidence) })),
    arms: extraction.arms.map((a) => ({ ...a, evidence: mapEv(a.evidence) })),
    baseline_characteristics: extraction.baseline_characteristics.map((b) => ({ ...b, evidence: mapEv(b.evidence) })),
    outcomes: {
      dichotomous: extraction.outcomes.dichotomous.map((o) => ({ ...o, evidence: mapEv(o.evidence) })),
      continuous: extraction.outcomes.continuous.map((o) => ({ ...o, evidence: mapEv(o.evidence) })),
      generic_iv: extraction.outcomes.generic_iv.map((o) => ({ ...o, evidence: mapEv(o.evidence) })),
    },
    quality_flags: [...extraction.quality_flags],
  };

  const allEvidence = [
    ...verified.study_characteristics.map((c) => c.evidence),
    ...verified.arms.map((a) => a.evidence),
    ...verified.baseline_characteristics.map((b) => b.evidence),
    ...verified.outcomes.dichotomous.map((o) => o.evidence),
    ...verified.outcomes.continuous.map((o) => o.evidence),
    ...verified.outcomes.generic_iv.map((o) => o.evidence),
  ];
  const unverifiedCount = allEvidence.filter((e) => e.quote_verified === false).length;
  if (unverifiedCount > 0) {
    verified.quality_flags.push(`${unverifiedCount} evidence quote${unverifiedCount === 1 ? "" : "s"} could not be verified against the PDF's extracted text.`);
  }
  if (!pages) {
    verified.quality_flags.push("Server-side PDF text re-extraction failed - evidence quotes could not be automatically verified for this study.");
  }

  return verified;
}
