// Meta-Analysis Data Extraction - server-side per-study processing route.
//
// Deliberately ONE STUDY PER REQUEST (not a batch), so the client's own
// queue can process studies individually, retry only a failed study, and
// survive a page refresh without losing already-completed studies (see
// app/tools/data-extraction/DOCS.md's "resumability" section) - matching
// the brief's explicit "process studies individually through a controlled
// queue rather than one enormous AI request" requirement.
//
// DATA HANDLING: the uploaded PDF is read into memory for the lifetime of
// this request only (once for the Gemini call, once for deterministic
// evidence-quote verification against the PDF's own text). Nothing is
// written to disk, no database is used, nothing is retained after the
// response is sent.
import { NextRequest, NextResponse } from "next/server";
import { GeminiProvider, AIRateLimitError, AIResponseInvalidError, AIUnavailableError } from "@/app/lib/ai/GeminiProvider";
import type { StudyExtractionEnvelope } from "@/app/lib/ai/extractionSchemas";
import type { StudyExtraction, StudyProcessResult, GeminiErrorCode } from "@/app/lib/extraction/types";
import { verifyStudyExtraction } from "@/app/lib/extraction/verification";
import { deriveLogEffectAndSE } from "@/app/lib/extraction/deriveGenericIV";
import { convertUnit } from "@/app/lib/extraction/unitConversion";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILE_BYTES = 30 * 1024 * 1024; // 30MB per PDF

function envelopeToExtraction(raw: StudyExtractionEnvelope, studyId: string, filename: string): StudyExtraction {
  return {
    study_id: studyId,
    filename,
    readable: raw.readable,
    readability_note: raw.readability_note,
    study: raw.study,
    study_characteristics: raw.study_characteristics.map((c) => ({ ...c, evidence: { ...c.evidence } })),
    arms: raw.arms.map((a) => ({ ...a, evidence: { ...a.evidence } })),
    baseline_characteristics: raw.baseline_characteristics.map((b) => {
      // Original value/unit is always preserved exactly as reported;
      // conversion is attempted only against a small whitelist of valid,
      // unambiguous conversions and never applied silently - see
      // app/lib/extraction/unitConversion.ts.
      const conv = convertUnit(b.reported_value, b.reported_unit);
      return {
        ...b,
        standardized_value: conv?.standardizedValue ?? null,
        standardized_unit: conv?.standardizedUnit ?? null,
        transformation: conv?.rule ?? null,
        evidence: { ...b.evidence },
      };
    }),
    outcomes: {
      dichotomous: raw.outcomes.dichotomous.map((o) => ({ ...o, evidence: { ...o.evidence } })),
      continuous: raw.outcomes.continuous.map((o) => ({ ...o, evidence: { ...o.evidence } })),
      generic_iv: raw.outcomes.generic_iv.map((o) => {
        const derived = deriveLogEffectAndSE(o);
        return { ...o, derived_log_effect: derived?.log_effect ?? null, derived_se: derived?.se ?? null, evidence: { ...o.evidence } };
      }),
    },
    warnings: [...raw.warnings],
    quality_flags: raw.readable ? [] : ["This PDF may not contain sufficient extractable text for a fully reliable extraction."],
  };
}

function needsReview(extraction: StudyExtraction): boolean {
  if (!extraction.readable) return true;
  if (extraction.quality_flags.length > 0) return true;
  const allEvidence = [
    ...extraction.study_characteristics.map((c) => c.evidence),
    ...extraction.arms.map((a) => a.evidence),
    ...extraction.baseline_characteristics.map((b) => b.evidence),
    ...extraction.outcomes.dichotomous.map((o) => o.evidence),
    ...extraction.outcomes.continuous.map((o) => o.evidence),
    ...extraction.outcomes.generic_iv.map((o) => o.evidence),
  ];
  if (allEvidence.some((e) => e.quote_verified === false)) return true;
  if (allEvidence.filter((e) => e.confidence === "Low" || e.confidence === "Unclear").length > 3) return true;
  return false;
}

export async function POST(req: NextRequest) {
  let provider: GeminiProvider;
  try {
    provider = new GeminiProvider();
  } catch {
    return NextResponse.json({ status: "error", message: "The AI extraction service is not configured on the server (missing GEMINI_API_KEY)." }, { status: 503 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const studyId = String(form.get("studyId") ?? "").trim();
  const experimentalGroup = String(form.get("experimentalGroup") ?? "").trim();
  const controlGroup = String(form.get("controlGroup") ?? "").trim();
  const outcomeTypeHintRaw = form.get("outcomeTypeHint");
  const outcomeTypeHint = typeof outcomeTypeHintRaw === "string" && outcomeTypeHintRaw.trim() && outcomeTypeHintRaw !== "Let AI detect" ? outcomeTypeHintRaw.trim() : null;

  if (!(file instanceof File)) return NextResponse.json({ status: "error", message: "A PDF file is required." }, { status: 400 });
  if (!studyId) return NextResponse.json({ status: "error", message: "A study ID is required." }, { status: 400 });
  if (!experimentalGroup || !controlGroup) return NextResponse.json({ status: "error", message: "Experimental and control group names are required." }, { status: 400 });
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") return NextResponse.json({ status: "error", message: `"${file.name}" is not a PDF file.` }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ status: "error", message: `File exceeds the ${MAX_FILE_BYTES / (1024 * 1024)}MB per-PDF limit.` }, { status: 400 });

  let result: StudyProcessResult;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const raw = await provider.extractStudyData({ filename: file.name, base64: buf.toString("base64") }, experimentalGroup, controlGroup, outcomeTypeHint);
    let extraction = envelopeToExtraction(raw, studyId, file.name);
    extraction = await verifyStudyExtraction(extraction, buf);
    result = { status: needsReview(extraction) ? "needs_review" : "completed", extraction };
  } catch (err) {
    let reason = "An unexpected error occurred while processing this file.";
    let errorCode: GeminiErrorCode = "UNKNOWN";
    let retryAfterMs: number | null | undefined;
    if (err instanceof AIRateLimitError) {
      reason = err.message;
      errorCode = err.code;
      retryAfterMs = err.retryAfterMs;
    } else if (err instanceof AIResponseInvalidError) {
      reason = "The AI's response could not be validated against the required schema after one repair attempt.";
      errorCode = "INVALID_RESPONSE";
    } else if (err instanceof AIUnavailableError) {
      reason = err.message;
      errorCode = "UNAVAILABLE";
    } else {
      console.error(`[extraction/process-study] unexpected error for ${file.name}:`, err);
      errorCode = "UNKNOWN";
    }
    result = { study_id: studyId, filename: file.name, status: "failed", reason, errorCode, retryAfterMs };
  }

  return NextResponse.json({ status: "success", result });
}
