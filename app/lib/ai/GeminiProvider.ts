// Gemini implementation of AIProvider. SERVER-SIDE ONLY - this file must
// never be imported by a "use client" component. process.env.GEMINI_API_KEY
// is read here and nowhere else in the frontend; it is never logged, never
// included in any response sent back to the browser, and never given a
// NEXT_PUBLIC_ prefix.
import { GoogleGenAI } from "@google/genai";
import type { Framework } from "@/app/lib/rob/types";
import { ROB2_PROMPT } from "./prompts/rob2";
import { ROBINS_I_PROMPT } from "./prompts/robinsI";
import { QUADAS2_PROMPT } from "./prompts/quadas2";
import { buildExtractionPrompt } from "./prompts/extraction";
import { AIAssessmentResponseSchema, type AIAssessmentResponse } from "./schemas";
import { StudyExtractionEnvelopeSchema, type StudyExtractionEnvelope } from "./extractionSchemas";
import type { AIProvider, PdfInput } from "./AIProvider";
import { classifyGeminiError } from "./geminiErrorClassifier";

export class AIResponseInvalidError extends Error {}
export class AIUnavailableError extends Error {}

// Carries the provider-error classification (see classifyGeminiError below)
// so callers - the API route, and ultimately the frontend queue - can react
// differently to a short-lived throttle vs. a day-level quota exhaustion,
// instead of treating every 429 identically.
export class AIRateLimitError extends Error {
  code: "RATE_LIMITED" | "QUOTA_EXHAUSTED";
  retryAfterMs: number | null;
  constructor(message: string, code: "RATE_LIMITED" | "QUOTA_EXHAUSTED", retryAfterMs: number | null) {
    super(message);
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
// Bounded, small retry policy for a TRANSIENT throttle only (never used for
// quota exhaustion - see classifyGeminiError). 3 attempts total, short
// backoff - long enough to ride out a brief burst, short enough that one
// study's retries don't eat into the next study's turn for long.
const BACKOFF_MS = [1000, 3000, 8000];

function promptFor(framework: Framework): string {
  if (framework === "RoB2") return ROB2_PROMPT;
  if (framework === "ROBINS-I") return ROBINS_I_PROMPT;
  return QUADAS2_PROMPT;
}

// Strips ```json ... ``` fences some models add despite instructions not to.
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

export class GeminiProvider implements AIProvider {
  private client: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new AIUnavailableError("GEMINI_API_KEY is not configured on the server.");
    this.client = new GoogleGenAI({ apiKey });
  }

  private async generateOnce(prompt: string, pdf: PdfInput): Promise<string> {
    const response = await this.client.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }, { inlineData: { mimeType: "application/pdf", data: pdf.base64 } }],
        },
      ],
      config: { responseMimeType: "application/json", temperature: 0.1 },
    });
    const text = response.text;
    if (!text) throw new AIResponseInvalidError("Gemini returned an empty response.");
    return text;
  }

  private async generateWithBackoff(prompt: string, pdf: PdfInput): Promise<string> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
      try {
        return await this.generateOnce(prompt, pdf);
      } catch (err) {
        lastErr = err;
        const classification = classifyGeminiError(err);

        // Day-level quota exhaustion: retrying will not help, and doing so
        // anyway just burns the remaining request budget of every other
        // study still waiting in the batch. Fail this call immediately -
        // the caller (the API route, then the frontend queue) is
        // responsible for pausing the whole batch, not just this study.
        if (classification.code === "QUOTA_EXHAUSTED") {
          throw new AIRateLimitError(
            "The Gemini API free-tier quota has been reached. Processing is paused - already-completed studies are preserved, and you can resume once quota is available again.",
            "QUOTA_EXHAUSTED",
            classification.retryAfterMs
          );
        }

        if (!classification.retryable || attempt === BACKOFF_MS.length) break;
        // Honor the provider's own suggested delay when it gave one and
        // it's short enough to be worth waiting on inline; otherwise fall
        // back to our own fixed backoff schedule.
        const waitMs = classification.retryAfterMs ?? BACKOFF_MS[attempt];
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }

    const finalClassification = classifyGeminiError(lastErr);
    if (finalClassification.code === "RATE_LIMITED") {
      throw new AIRateLimitError(
        "The Gemini API rate limit was reached and retries were exhausted. Processing is paused - already-completed studies are preserved.",
        "RATE_LIMITED",
        finalClassification.retryAfterMs
      );
    }
    throw new AIUnavailableError(`Gemini request failed: ${String((lastErr as { message?: string })?.message ?? lastErr)}`);
  }

  // Shared "generate, validate, one safe-repair-retry" flow, factored out of
  // the original assess() implementation so extractStudyData() below can
  // reuse it against a different prompt/schema without duplicating the
  // repair logic. assess()'s own public behavior is unchanged.
  private async generateValidated<T>(prompt: string, pdf: PdfInput, schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }): Promise<T> {
    const rawText = await this.generateWithBackoff(prompt, pdf);

    const tryParse = (text: string): T | null => {
      try {
        const json = JSON.parse(extractJson(text));
        const result = schema.safeParse(json);
        return result.success ? (result.data as T) : null;
      } catch {
        return null;
      }
    };

    let parsed = tryParse(rawText);
    if (parsed) return parsed;

    // One repair attempt: ask Gemini to fix its own malformed JSON rather
    // than re-reading the whole PDF again (cheaper, faster, and the brief
    // explicitly asks for "safe repair" before giving up).
    const repairPrompt = `Your previous response could not be parsed as valid JSON matching the required schema. Return ONLY the corrected JSON object, with no markdown fences and no commentary. Previous response:\n\n${rawText.slice(0, 8000)}`;
    try {
      const repaired = await this.generateOnce(repairPrompt, pdf);
      parsed = tryParse(repaired);
    } catch {
      // fall through to the error below
    }

    if (!parsed) throw new AIResponseInvalidError("Gemini's response could not be validated against the required schema after one repair attempt.");
    return parsed;
  }

  async assess(pdf: PdfInput, framework: Framework): Promise<AIAssessmentResponse> {
    return this.generateValidated(promptFor(framework), pdf, AIAssessmentResponseSchema);
  }

  /** Meta-Analysis Data Extraction tool: one comprehensive structured-output
   * call per study - see prompts/extraction.ts for the cost-efficiency
   * rationale. */
  async extractStudyData(pdf: PdfInput, experimentalGroup: string, controlGroup: string, outcomeTypeHint: string | null): Promise<StudyExtractionEnvelope> {
    const prompt = buildExtractionPrompt(experimentalGroup, controlGroup, outcomeTypeHint);
    return this.generateValidated(prompt, pdf, StudyExtractionEnvelopeSchema);
  }
}
