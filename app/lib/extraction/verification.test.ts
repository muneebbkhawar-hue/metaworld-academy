// Run with: node --experimental-strip-types --test app/lib/extraction/verification.test.ts
// Tests verifyEvidence() only (pure, sync) - verifyStudyExtraction()'s real
// PDF-parsing path (serverPdfText.ts, pdfjs-dist legacy build) is exercised
// by the real end-to-end test against a running dev server, not here (see
// the final report's "tests actually performed" section - Node's test
// runner is not the place to load a full PDF parser for a unit test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyEvidence } from "./verification.ts";
import type { Evidence } from "./types.ts";

const page1 = { pageNum: 1, text: "The mean age was 56.4 ± 8.2 years at baseline, as shown in Table 1." };
const page2 = { pageNum: 2, text: "A total of 120 patients were randomized to the two treatment groups." };

function ev(overrides: Partial<Evidence>): Evidence {
  return { page: 1, location: "Table 1", quote: null, status: "reported", confidence: "High", ...overrides };
}

test("quote found verbatim on the cited page is verified true", () => {
  const result = verifyEvidence(ev({ quote: "The mean age was 56.4 ± 8.2 years" }), [page1, page2], 2);
  assert.equal(result.quote_verified, true);
  assert.equal(result.verification_note, null);
});

test("quote found on a different page than cited is verified true with a note", () => {
  const result = verifyEvidence(ev({ page: 2, quote: "mean age was 56.4 ± 8.2 years" }), [page1, page2], 2);
  assert.equal(result.quote_verified, true);
  assert.match(result.verification_note ?? "", /not on the cited page/);
});

test("fabricated/non-matching quote is flagged NOT verified", () => {
  const result = verifyEvidence(ev({ quote: "no adverse events were observed in either group" }), [page1, page2], 2);
  assert.equal(result.quote_verified, false);
  assert.match(result.verification_note ?? "", /could not be located/);
});

test("page number outside the PDF's actual range is flagged", () => {
  const result = verifyEvidence(ev({ page: 99, quote: "The mean age was 56.4" }), [page1, page2], 2);
  assert.equal(result.quote_verified, false);
  assert.match(result.verification_note ?? "", /outside this PDF's actual page range/);
});

test("null quote is not treated as verified false - it's simply not applicable", () => {
  const result = verifyEvidence(ev({ quote: null, status: "not_reported" }), [page1, page2], 2);
  assert.equal(result.quote_verified, null);
});

test("PDF text extraction failure degrades to 'unavailable', never to a false negative", () => {
  const result = verifyEvidence(ev({ quote: "The mean age was 56.4" }), null, null);
  assert.equal(result.quote_verified, null);
  assert.match(result.verification_note ?? "", /could not be re-extracted/);
});

test("whitespace/case differences do not cause a false 'not verified'", () => {
  const page = { pageNum: 1, text: "Follow-up  was   12 months for all participants." };
  const result = verifyEvidence(ev({ quote: "follow-up was 12 months" }), [page], 1);
  assert.equal(result.quote_verified, true);
});
