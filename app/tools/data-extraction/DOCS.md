# Meta-Analysis Data Extraction — developer notes

**Purpose:** AI-assisted, evidence-grounded extraction of study characteristics, baseline characteristics, and clinical outcomes (dichotomous / continuous / generic inverse-variance) from included-study PDFs into a review-ready Excel/CSV extraction sheet, with every value traceable to a page/quote.

## Architecture (Stages A–E)

Each uploaded PDF becomes an independent job, processed by the client's own **sequential** queue (one study in flight at a time, with a ~2s pacing gap between studies) calling `POST /api/extraction/process-study` **once per study** — never a batch, never all PDFs in one request, and never in parallel. This is deliberate: it lets one failed/rate-limited study be retried without losing already-completed studies, gives real per-study progress, and avoids bursting a free-tier Gemini quota with concurrent requests (an earlier version of this tool used concurrency 2, which turned out to be exactly why a 7-study batch failed after study 1 - see "Rate-limit and quota resilience" below).

## Rate-limit and quota resilience

`app/lib/ai/geminiErrorClassifier.ts` (pure, dependency-free, unit-tested) classifies every Gemini 429/RESOURCE_EXHAUSTED error using the real error body the `@google/genai` SDK throws (`ApiError.status` + a JSON-stringified `{error:{status,details}}`), distinguishing:
- **RATE_LIMITED** — a short provider-suggested `retryDelay` was present (≤20s): `GeminiProvider`'s bounded 3-attempt backoff retries this transparently.
- **QUOTA_EXHAUSTED** — a day-level quota violation, a long/absent retry delay, or no structured detail at all (the conservative default for an unrecognized 429, so the app never hammers an unknown quota condition): the request fails fast (no wasted retries) with this code.

The frontend queue (`page.tsx`) reads `result.errorCode` from the API response: a `QUOTA_EXHAUSTED`/`RATE_LIMITED` result immediately **pauses the whole queue** (marks that study `RATE_LIMITED`, leaves every remaining study `QUEUED`, never touches already-`COMPLETE`/`NEEDS_REVIEW` studies) and shows a "Resume Processing" control; any other failure (validation, malformed response) is marked `FAILED` and the queue **continues** to the next study. A "Pause Queue" button lets the user voluntarily stop between studies, and "Cancel remaining" marks still-`QUEUED` studies `CANCELLED` (requeueable). Completed results are mirrored to `localStorage` after every single study finishes, not just at the end of a batch, so a mid-batch quota pause is never lost even across a refresh.

- **Stage A/B/C/D (server, one Gemini call per study):** `app/api/extraction/process-study/route.ts` reads the PDF, calls `GeminiProvider.extractStudyData()` (`app/lib/ai/GeminiProvider.ts`, extending the same provider already used by the Risk of Bias tool) with a single comprehensive prompt (`app/lib/ai/prompts/extraction.ts`) covering study characteristics, baseline characteristics, arms, and all three outcome structures in one request. The response is Zod-validated (`app/lib/ai/extractionSchemas.ts`) with one JSON self-repair retry.
- **Deterministic post-processing (server, zero extra AI cost):**
  - `app/lib/extraction/verification.ts` re-extracts the PDF's own text server-side (`serverPdfText.ts`, using `pdfjs-dist`'s legacy/Node build) and checks every evidence quote against it with a fuzzy substring match — a quote that can't be located is flagged `quote_verified: false`, never silently trusted.
  - `app/lib/extraction/unitConversion.ts` applies a small, explicit whitelist of unit conversions (lb→kg, in→cm, mg/dL↔mmol/L) and always preserves the original value alongside the converted one.
  - `app/lib/extraction/deriveGenericIV.ts` derives log-effect/SE for OR/RR/HR outcomes by reusing the exact, already-tested formula from the Statistical Conversions tool (`app/lib/statConversions/conversions.ts`) — one source of truth for that formula across the app.
- **Stage C (client, instant, deterministic):** `app/lib/extraction/harmonization.ts` builds the cross-study variable dictionary (frequency, %, threshold-based recommendation, moderator flagging) once all studies are in, and `app/lib/extraction/conflictDetection.ts` flags same-study inconsistencies (e.g. Table 1 N vs. Methods-text N).
- **Stage E (frontend):** `page.tsx`'s review dashboard (tabs for study characteristics / baseline / each outcome type / variable frequency / warnings), with a click-to-view evidence modal on every cell.

### Why one Gemini call per study, not one per section

The brief's "separate specialized prompts" suggestion (study characteristics / baseline / outcomes / evidence verification as 4+ separate calls) would multiply Gemini API usage 4-5x per study, which is impractical against a free-tier quota for batches of 10+ studies. Instead: one well-organized prompt/schema per study, and evidence verification is a **deterministic, zero-AI-cost pass** against the PDF's own real text (see above) rather than a second AI call asking the same model to check its own work — genuinely more reliable, not just cheaper.

### Why harmonization is deterministic TypeScript, not a second AI call

Each per-study extraction already asks Gemini for both the original label and a canonical name per variable. Grouping across studies is then pure code operating on that already-consistent vocabulary — fully reviewable, and avoids the risk of an AI "harmonization" pass silently merging two differently-defined variables (e.g. "current smoker" vs. "ever smoker" — explicitly never merged; see `harmonization.test.ts`).

## Resumability model — read this before assuming more than it claims

**This app has no server-side database or job store anywhere** (by design — see the app's existing architecture). "Resumable" here specifically means: each study is processed via its own independent, retryable request, and every **completed** result is mirrored to the browser's `localStorage` (keyed by a generated job ID) as it finishes. A page refresh therefore does **not** lose already-completed studies — they're offered back via a "Resume previous session" banner on reload. However, uploaded `File` objects cannot be serialized to `localStorage`, so **pending or failed studies must be re-selected/re-uploaded** after a refresh; only their study ID and prior results (if any) are recalled. This is the honest, actual behavior — not a claim of full server-side job persistence, which this app does not have.

## Known bug found and fixed during testing

`pdfjs-dist`'s Node fallback ("fake worker") normally locates its worker module by dynamically `import()`-ing a path string at runtime. That resolution broke once bundled into a Next.js/Turbopack server chunk (`Cannot find module ... pdf.worker.mjs`), even though the package is installed — confirmed via a direct debug route that this failed under Turbopack even though the identical code worked under plain Node. **Fix:** `serverPdfText.ts` statically imports the worker module itself and registers it on `globalThis.pdfjsWorker`, which pdfjs's fake-worker setup checks *before* ever attempting the broken dynamic path-based import — verified fixed via a direct debug route hitting the real Turbopack-bundled server (200 response, correct extracted text), see the final report for what was and wasn't re-verified through a live Gemini call afterward.

## Vercel / deployment compatibility

Everything here is either fully client-side (harmonization, workbook building, exports) or a stateless server route reading `process.env.GEMINI_API_KEY` (never exposed to the browser, never `NEXT_PUBLIC_`) — no persistent filesystem, no long-running background process, no local executable. `maxDuration = 300` is set on the route the same way the existing `/api/rob/assess` route does.

## Limitations (disclosed, not hidden)

- No OCR — a PDF with very little extractable text is still sent to Gemini (which has native PDF/image understanding and may still extract meaningfully), but the deterministic quote-verification pass will correctly flag quotes it can't locate in the (sparse or absent) extracted text layer.
- Outcome export sheets use a **long/tidy format** (one row per outcome-per-arm, with an explicit Arm Role column) rather than fixed "Experimental/Control" columns, specifically so a study with more than 2 arms is never silently mispaired — a reviewer doing a standard 2-arm comparison can filter by Arm Role in Excel.
- Unit conversion is a small, explicit whitelist (lb/in/ft/glucose/cholesterol) — an unrecognized unit is left exactly as reported, never guessed.
- Evidence-quote verification is deterministic (substring match against re-extracted PDF text), not a second AI pass — see the architecture note above for why this is a deliberate choice, not a corner cut.
