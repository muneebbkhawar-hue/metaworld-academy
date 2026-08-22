// Provider abstraction so a future AI provider (besides Gemini) can be
// added without touching route.ts or any framework logic. Only
// GeminiProvider implements this today - see brief §4.
import type { Framework } from "@/app/lib/rob/types";
import type { AIAssessmentResponse } from "./schemas";

export interface PdfInput {
  filename: string;
  base64: string; // raw PDF bytes, base64-encoded, no data: prefix
}

export interface AIProvider {
  /**
   * Reads one PDF and answers every signalling question for the given
   * framework. Returns the RAW (Zod-validated by the caller) AI response -
   * this function itself does not compute any judgment; that happens in
   * app/lib/rob/{rob2,robinsI,quadas2}.ts.
   */
  assess(pdf: PdfInput, framework: Framework): Promise<AIAssessmentResponse>;
}
