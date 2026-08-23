// Small shared API client for the R/Plumber backends.
//
// ARCHITECTURE NOTE (why this stays a direct browser -> R client, not a
// Next.js API proxy): the preferred long-term shape is
// browser -> Next.js API layer -> R/Plumber, so the browser never needs to
// know the R server's address at all. This session intentionally did NOT
// introduce that proxy layer - every existing tool page's fetch/parse logic
// (JSON.parse-with-fallback, "status": "success"/"error" handling, plot
// base64 rendering) already works and is regression-tested, and inserting a
// Next.js API route per statistical endpoint right now would be exactly the
// "large architectural rewrite" this task was told to avoid when a smaller
// change suffices. What actually causes the deployment problem - hardcoded
// `127.0.0.1:PORT` literals scattered across tool pages - is fixed by
// centralizing the base URLs (see apiConfig.ts) and this thin client, which
// is enough to change the backend location later without touching a single
// tool page. Introducing the proxy layer remains a reasonable follow-up
// whenever the deployment target is actually decided, not before.
//
// This file provides:
//   - `apiClient.meta / .tsa / .nma` - one object per backend, each exposing
//     its centralized `baseUrl` (for pages that build their own fetch calls
//     with existing, working parsing logic) and a `.post()` helper (for
//     pages that want the shared request/parse/error-message behavior).
//   - `BACKEND_UNAVAILABLE_MESSAGE` - the one user-facing string every tool
//     page shows when a fetch to any backend fails outright, so a user
//     always gets the same clear, non-technical explanation instead of a
//     silently swallowed error or a raw network exception. Technical detail
//     (the actual error object) is only ever logged to the console, not
//     shown to the user.

import { META_API_URL, TSA_API_URL, NMA_API_URL, META_REGRESSION_API_URL, ROB_API_URL, KM_DIGITIZER_API_URL } from "./apiConfig";

export const BACKEND_UNAVAILABLE_MESSAGE =
  "Statistical backend is currently unavailable. Please restart the backend service or try again.";

export const INVALID_RESPONSE_MESSAGE =
  "The statistical backend returned an invalid response. Please check the backend logs or try again.";

export class ApiRequestError extends Error {}

interface PostOptions {
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 120000; // matches the timeout already used on every NMA fetch call

async function postJSON<T = unknown>(
  baseUrl: string,
  path: string,
  body: unknown,
  opts: PostOptions = {}
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (err) {
    console.error(`[apiClient] request to ${baseUrl}${path} failed:`, err);
    throw new ApiRequestError(BACKEND_UNAVAILABLE_MESSAGE);
  }

  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    console.error(`[apiClient] invalid JSON from ${baseUrl}${path}:`, text.slice(0, 500), err);
    throw new ApiRequestError(INVALID_RESPONSE_MESSAGE);
  }
}

function makeService(baseUrl: string) {
  return {
    baseUrl,
    post: <T = unknown>(path: string, body: unknown, opts?: PostOptions) =>
      postJSON<T>(baseUrl, path, body, opts),
  };
}

export const apiClient = {
  /** api.R - Forest / Funnel / Sensitivity (LOO) / Bias / GRADE, port 8000 */
  meta: makeService(META_API_URL),
  /** tsa-api.R - Trial Sequential Analysis, port 8001 */
  tsa: makeService(TSA_API_URL),
  /** nma-api.R - Network Meta-Analysis, port 8002 */
  nma: makeService(NMA_API_URL),
  /** metareg-api.R - Pairwise Meta-Regression, port 8003 */
  metareg: makeService(META_REGRESSION_API_URL),
  /** rob-api.R - Risk of Bias traffic-light/summary plots (robvis), port 8004 */
  rob: makeService(ROB_API_URL),
  /** km-digitizer-api.R - KM curve reconstruction (Guyot 2012/IPDfromKM), port 8005 */
  kmDigitizer: makeService(KM_DIGITIZER_API_URL),
};
