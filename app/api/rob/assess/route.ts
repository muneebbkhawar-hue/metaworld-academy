// AI-Assisted Risk of Bias Assessment - server-side orchestration route.
// This is the first Next.js API route in this app (see apiClient.ts's
// architecture note - every other tool talks directly to an R backend from
// the browser; Gemini calls MUST be server-side to keep GEMINI_API_KEY out
// of the client bundle, so this route is a deliberate, narrowly-scoped
// exception, not a broader architectural rewrite).
//
// DATA HANDLING: uploaded PDFs are read into memory for the lifetime of
// this request only. Nothing is written to disk, no database is used, and
// nothing is retained after the response is sent - see MethodologyPanel's
// "what we retain" copy for the same statement shown to users.
import { NextRequest, NextResponse } from "next/server";
import type { Framework, StudyAssessment, StudyResult, DomainAssessment, ClassificationResult } from "@/app/lib/rob/types";
import { GeminiProvider, AIRateLimitError, AIResponseInvalidError, AIUnavailableError } from "@/app/lib/ai/GeminiProvider";
import { toSignallingRecords } from "@/app/lib/ai/evidenceValidator";
import { checkCompatibility } from "@/app/lib/rob/compatibilityGate";
import { needsHumanReview, overallAIConfidence } from "@/app/lib/rob/reviewFlags";
import { ROB2_DOMAINS, ROB2_DOMAIN_FN, rob2Overall } from "@/app/lib/rob/rob2";
import { ROBINS_I_DOMAINS, ROBINS_I_DOMAIN_FN, robinsIOverall } from "@/app/lib/rob/robinsI";
import { QUADAS2_DOMAINS, quadas2RobJudgment, quadas2ApplicabilityJudgment, quadas2Overall } from "@/app/lib/rob/quadas2";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILE_BYTES = 30 * 1024 * 1024; // 30MB per PDF
const MAX_FILES = 25;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
const CONCURRENCY = 2; // conservative - avoid hammering a free-tier Gemini quota

function slugId(filename: string, index: number, used: Set<string>): string {
  const base = filename.replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 40) || `study-${index + 1}`;
  let id = base;
  let n = 1;
  while (used.has(id)) id = `${base}-${++n}`;
  used.add(id);
  return id;
}

async function runPool<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function buildDomains<J extends string>(
  domainDefs: { key: string; label: string }[],
  recordsByDomain: Record<string, ReturnType<typeof toSignallingRecords>[string]>,
  judge: (key: string, qs: ReturnType<typeof toSignallingRecords>[string]) => J
): DomainAssessment<J>[] {
  return domainDefs.map((d) => {
    const qs = recordsByDomain[d.key] ?? [];
    const judgment = judge(d.key, qs);
    return {
      domain_key: d.key,
      domain_label: d.label,
      ai_judgment: judgment,
      human_judgment: judgment,
      human_override_applied: false,
      reviewer_rationale: null,
      questions: qs,
    };
  });
}

async function assessOne(file: File, framework: Framework, studyId: string, provider: GeminiProvider): Promise<StudyResult> {
  if (file.size > MAX_FILE_BYTES) {
    return { study_id: studyId, filename: file.name, status: "failed", reason: `File exceeds the ${MAX_FILE_BYTES / (1024 * 1024)}MB per-PDF limit.` };
  }

  let raw;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    raw = await provider.assess({ filename: file.name, base64: buf.toString("base64") }, framework);
  } catch (err) {
    if (err instanceof AIRateLimitError) return { study_id: studyId, filename: file.name, status: "failed", reason: err.message };
    if (err instanceof AIResponseInvalidError) return { study_id: studyId, filename: file.name, status: "failed", reason: "AI response could not be validated against the required schema." };
    if (err instanceof AIUnavailableError) return { study_id: studyId, filename: file.name, status: "failed", reason: err.message };
    console.error(`[rob/assess] unexpected error for ${file.name}:`, err);
    return { study_id: studyId, filename: file.name, status: "failed", reason: "An unexpected error occurred while processing this file." };
  }

  const classification: ClassificationResult = { ...raw.study_design, human_override: null };
  const compatibility = checkCompatibility(classification.study_design, classification.confidence, framework);

  if (!compatibility.compatible) {
    return { study_id: studyId, filename: file.name, status: "rejected", reason: compatibility.reason };
  }

  const recordsByDomain = toSignallingRecords(raw);
  const allQuestions = Object.values(recordsByDomain).flat();
  const review = needsHumanReview(classification, compatibility, allQuestions, raw.readable);
  const confidence = overallAIConfidence(allQuestions, classification);

  const base = {
    study_id: studyId,
    filename: file.name,
    classification,
    compatibility,
    ai_confidence: confidence,
    human_review_required: review.required,
    human_review_reasons: review.reasons,
    overall_notes: raw.readable ? "" : raw.readability_note ?? "The uploaded PDF may not contain sufficient extractable text for a fully reliable assessment.",
  };

  let assessment: StudyAssessment;
  if (framework === "RoB2") {
    const domains = buildDomains(ROB2_DOMAINS, recordsByDomain, (k, qs) => ROB2_DOMAIN_FN[k](qs));
    assessment = { ...base, framework: "RoB2", domains, ai_overall: rob2Overall(domains.map((d) => d.ai_judgment)), human_overall: rob2Overall(domains.map((d) => d.human_judgment)) };
  } else if (framework === "ROBINS-I") {
    const domains = buildDomains(ROBINS_I_DOMAINS, recordsByDomain, (k, qs) => ROBINS_I_DOMAIN_FN[k](qs));
    assessment = { ...base, framework: "ROBINS-I", domains, ai_overall: robinsIOverall(domains.map((d) => d.ai_judgment)), human_overall: robinsIOverall(domains.map((d) => d.human_judgment)) };
  } else {
    const domains = buildDomains(QUADAS2_DOMAINS, recordsByDomain, (k, qs) => quadas2RobJudgment(k, qs));
    const applicabilityDomains = QUADAS2_DOMAINS.filter((d) => d.key !== "D4").map((d) => {
      const qs = recordsByDomain[d.key] ?? [];
      const j = quadas2ApplicabilityJudgment(d.key, qs) ?? "Unclear";
      return { domain_key: d.key, domain_label: d.label, ai_judgment: j, human_judgment: j, human_override_applied: false, reviewer_rationale: null, questions: qs };
    });
    assessment = {
      ...base, framework: "QUADAS-2", domains, applicability: applicabilityDomains,
      ai_overall: quadas2Overall(domains.map((d) => d.ai_judgment)),
      human_overall: quadas2Overall(domains.map((d) => d.human_judgment)),
    };
  }

  return { status: review.required ? "needs_review" : "completed", assessment };
}

export async function POST(req: NextRequest) {
  let provider: GeminiProvider;
  try {
    provider = new GeminiProvider();
  } catch {
    return NextResponse.json({ status: "error", message: "The AI assessment service is not configured on the server (missing GEMINI_API_KEY)." }, { status: 503 });
  }

  const form = await req.formData();
  const framework = form.get("framework") as Framework | null;
  if (!framework || !["RoB2", "ROBINS-I", "QUADAS-2"].includes(framework)) {
    return NextResponse.json({ status: "error", message: "A valid framework (RoB2, ROBINS-I, or QUADAS-2) is required." }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ status: "error", message: "At least one PDF file is required." }, { status: 400 });
  if (files.length > MAX_FILES) return NextResponse.json({ status: "error", message: `A maximum of ${MAX_FILES} files can be processed in one batch.` }, { status: 400 });
  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) return NextResponse.json({ status: "error", message: `Total batch size exceeds the ${MAX_TOTAL_BYTES / (1024 * 1024)}MB limit.` }, { status: 400 });
  for (const f of files) {
    if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") {
      return NextResponse.json({ status: "error", message: `"${f.name}" is not a PDF file.` }, { status: 400 });
    }
  }

  const used = new Set<string>();
  const studyIds = files.map((f, i) => slugId(f.name, i, used));

  const results = await runPool(files, CONCURRENCY, (file, i) => assessOne(file, framework, studyIds[i], provider));

  return NextResponse.json({ status: "success", results });
}
