// Pure, dependency-free classification of a Gemini API error into
// "transient rate limit" vs "quota exhausted" vs "not a rate/quota issue at
// all". Deliberately has NO imports from anywhere else in this app (not
// even a relative one) so it can be unit-tested directly with
// `node --experimental-strip-types --test`, and so GeminiProvider.ts (which
// does pull in the app's path-aliased rob/*.ts modules) doesn't need to be
// imported just to exercise this logic.
//
// The @google/genai SDK throws an ApiError whose `.status` is the raw HTTP
// status code and whose `.message` is the JSON-stringified Gemini error
// body (confirmed by reading node_modules/@google/genai's
// throwErrorIfNotOK implementation - not guessed):
//   { error: { code, message, status, details } }
// `details` may include a google.rpc.QuotaFailure (naming which quota was
// exceeded - "PerDay" vs "PerMinute" in the metric/quotaId) and/or a
// google.rpc.RetryInfo (a suggested `retryDelay`, e.g. "37s"). Both are
// used when present; when the body can't be parsed at all (e.g. a plain
// network error) this falls back to a substring check on the raw message
// so classification still degrades safely rather than throwing.

// A provider-suggested retry delay this short is treated as "the API is
// momentarily busy, try again shortly" (RATE_LIMITED). Anything longer, or
// no delay information at all, is treated as QUOTA_EXHAUSTED - retrying
// wouldn't succeed soon enough to be worth it, so the caller should pause
// rather than burn its retry budget.
export const TRANSIENT_RETRY_DELAY_CEILING_MS = 20_000;

export interface GeminiErrorClassification {
  retryable: boolean; // worth an immediate bounded retry (transient)
  code: "RATE_LIMITED" | "QUOTA_EXHAUSTED" | null; // null = not a rate/quota error at all
  retryAfterMs: number | null;
}

/** Parses a google.rpc.RetryInfo-style duration string ("37s", "1.500s")
 * into milliseconds. Returns null if not parseable. */
export function parseRetryDelaySeconds(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^([\d.]+)s$/);
  if (!match) return null;
  const seconds = parseFloat(match[1]);
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : null;
}

export function classifyGeminiError(err: unknown): GeminiErrorClassification {
  const status = (err as { status?: number })?.status;
  const rawMessage = String((err as { message?: string })?.message ?? err);

  let details: unknown[] = [];
  let googleStatus = "";
  try {
    const parsed = JSON.parse(rawMessage) as { error?: { status?: string; details?: unknown[] } };
    googleStatus = parsed.error?.status ?? "";
    details = parsed.error?.details ?? [];
  } catch {
    // Non-JSON error message (network failure, etc.) - handled by the
    // substring fallback below.
  }

  const isRateOrQuota = status === 429 || googleStatus === "RESOURCE_EXHAUSTED" || /429|RESOURCE_EXHAUSTED/i.test(rawMessage);
  if (!isRateOrQuota) {
    const isTransientServerError = status === 503 || /503|UNAVAILABLE|overloaded/i.test(rawMessage);
    return { retryable: isTransientServerError, code: null, retryAfterMs: null };
  }

  let retryAfterMs: number | null = null;
  let sawDayQuota = false;
  for (const d of details) {
    const detail = d as { ["@type"]?: string; retryDelay?: string; violations?: { quotaId?: string; quotaMetric?: string }[] };
    if (detail["@type"]?.includes("RetryInfo")) {
      retryAfterMs = parseRetryDelaySeconds(detail.retryDelay);
    }
    if (detail["@type"]?.includes("QuotaFailure")) {
      for (const v of detail.violations ?? []) {
        if (/day/i.test(v.quotaId ?? "") || /day/i.test(v.quotaMetric ?? "")) sawDayQuota = true;
      }
    }
  }
  if (!details.length && /per[\s_-]?day|daily quota|quota exceeded/i.test(rawMessage)) sawDayQuota = true;

  const isQuotaExhausted = sawDayQuota || retryAfterMs === null || retryAfterMs > TRANSIENT_RETRY_DELAY_CEILING_MS;
  return {
    retryable: !isQuotaExhausted,
    code: isQuotaExhausted ? "QUOTA_EXHAUSTED" : "RATE_LIMITED",
    retryAfterMs,
  };
}
