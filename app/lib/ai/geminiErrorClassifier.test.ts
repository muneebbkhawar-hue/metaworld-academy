// MOCKED provider-level tests - no live Gemini calls. Each test constructs
// a synthetic error object shaped exactly like the @google/genai SDK's real
// ApiError (status: number, message: JSON-stringified Gemini error body),
// per throwErrorIfNotOK in node_modules/@google/genai/dist/*/index.js.
// Run with: node --experimental-strip-types --test app/lib/ai/geminiErrorClassifier.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyGeminiError, parseRetryDelaySeconds, TRANSIENT_RETRY_DELAY_CEILING_MS } from "./geminiErrorClassifier.ts";

function apiError(status: number, errorBody: Record<string, unknown>) {
  return { status, message: JSON.stringify({ error: errorBody }), name: "ApiError" };
}

test("parseRetryDelaySeconds: parses standard google.rpc.Duration strings", () => {
  assert.equal(parseRetryDelaySeconds("37s"), 37000);
  assert.equal(parseRetryDelaySeconds("1.5s"), 1500);
  assert.equal(parseRetryDelaySeconds("0s"), 0);
});
test("parseRetryDelaySeconds: non-string or malformed input returns null, never throws", () => {
  assert.equal(parseRetryDelaySeconds(undefined), null);
  assert.equal(parseRetryDelaySeconds(42), null);
  assert.equal(parseRetryDelaySeconds("not-a-duration"), null);
});

test("429 with a short RetryInfo delay -> RATE_LIMITED, retryable", () => {
  const err = apiError(429, {
    code: 429, message: "Resource has been exhausted", status: "RESOURCE_EXHAUSTED",
    details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "12s" }],
  });
  const result = classifyGeminiError(err);
  assert.equal(result.code, "RATE_LIMITED");
  assert.equal(result.retryable, true);
  assert.equal(result.retryAfterMs, 12000);
});

test("429 with a QuotaFailure naming a per-day quota -> QUOTA_EXHAUSTED, not retryable", () => {
  const err = apiError(429, {
    code: 429, message: "Quota exceeded", status: "RESOURCE_EXHAUSTED",
    details: [
      { "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier", quotaMetric: "generativelanguage.googleapis.com/generate_requests_per_model_per_day" }] },
      { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "3600s" },
    ],
  });
  const result = classifyGeminiError(err);
  assert.equal(result.code, "QUOTA_EXHAUSTED");
  assert.equal(result.retryable, false);
});

test("429 with a RetryInfo delay longer than the transient ceiling -> QUOTA_EXHAUSTED", () => {
  const err = apiError(429, {
    code: 429, message: "Resource has been exhausted", status: "RESOURCE_EXHAUSTED",
    details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: `${(TRANSIENT_RETRY_DELAY_CEILING_MS / 1000) + 30}s` }],
  });
  const result = classifyGeminiError(err);
  assert.equal(result.code, "QUOTA_EXHAUSTED");
  assert.equal(result.retryable, false);
});

test("429 with no details at all -> conservatively QUOTA_EXHAUSTED (never hammer an unknown 429)", () => {
  const err = apiError(429, { code: 429, message: "Resource has been exhausted", status: "RESOURCE_EXHAUSTED" });
  const result = classifyGeminiError(err);
  assert.equal(result.code, "QUOTA_EXHAUSTED");
  assert.equal(result.retryable, false);
});

test("429 message containing 'quota exceeded' with no structured details -> QUOTA_EXHAUSTED via substring fallback", () => {
  const err = { status: 429, message: "Error: 429 quota exceeded for this project" };
  const result = classifyGeminiError(err);
  assert.equal(result.code, "QUOTA_EXHAUSTED");
});

test("503 UNAVAILABLE -> transient server error, retryable, but code is null (not a rate/quota issue)", () => {
  const err = apiError(503, { code: 503, message: "The model is overloaded", status: "UNAVAILABLE" });
  const result = classifyGeminiError(err);
  assert.equal(result.code, null);
  assert.equal(result.retryable, true);
});

test("a plain network error (no status, no JSON body) is classified as non-retryable, non-rate/quota", () => {
  const err = new Error("fetch failed: ECONNRESET");
  const result = classifyGeminiError(err);
  assert.equal(result.code, null);
  assert.equal(result.retryable, false);
});

test("a 400 validation error is never misclassified as rate limiting", () => {
  const err = apiError(400, { code: 400, message: "Invalid argument", status: "INVALID_ARGUMENT" });
  const result = classifyGeminiError(err);
  assert.equal(result.code, null);
  assert.equal(result.retryable, false);
});
