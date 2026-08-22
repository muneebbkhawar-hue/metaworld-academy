// Unit tests for the DOM/browser-independent pieces of the PDF utilities:
// the Markdown-generation heuristics (pdfToMarkdown.ts) and page-range
// parser (pdf.ts). Rendering/text-extraction themselves require a real
// browser (Canvas, pdf.js's worker, File APIs) and are NOT exercised here -
// see the session's final report for what was and wasn't actually tested.
// Run with: node --experimental-strip-types --test app/lib/fileConverter/pdfToMarkdown.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { pagesToMarkdown } from "./pdfToMarkdown.ts";
import { parsePageRange, isLikelyScanned } from "./pdf.ts";
import type { PageTextResult, TextItemInfo } from "./pdf.ts";

function item(text: string, x: number, y: number, fontSize = 10): TextItemInfo {
  return { text, x, y, fontSize, fontName: "" };
}

test("parsePageRange: simple list and ranges", () => {
  assert.deepEqual(parsePageRange("1,3,5", 10), [1, 3, 5]);
  assert.deepEqual(parsePageRange("1-3", 10), [1, 2, 3]);
  assert.deepEqual(parsePageRange("1-3,7", 10), [1, 2, 3, 7]);
});
test("parsePageRange: out-of-range and reversed ranges handled", () => {
  assert.deepEqual(parsePageRange("5-3", 10), [3, 4, 5]); // reversed range still works
  assert.deepEqual(parsePageRange("1,99", 10), [1]); // 99 is out of range, dropped
  assert.deepEqual(parsePageRange("", 10), []);
  assert.deepEqual(parsePageRange("abc", 10), []);
});
test("parsePageRange: deduplicates overlapping input", () => {
  assert.deepEqual(parsePageRange("1-3,2-4", 10), [1, 2, 3, 4]);
});

test("isLikelyScanned: empty pages flagged as likely scanned", () => {
  const pages: PageTextResult[] = [{ pageNum: 1, items: [], links: [] }];
  assert.equal(isLikelyScanned(pages), true);
});
test("isLikelyScanned: pages with substantial text are not flagged", () => {
  const pages: PageTextResult[] = [{
    pageNum: 1,
    items: Array.from({ length: 50 }, (_, i) => item(`word${i}`, i * 20, 700)),
    links: [],
  }];
  assert.equal(isLikelyScanned(pages), false);
});

test("pagesToMarkdown: larger font line becomes a heading", () => {
  const pages: PageTextResult[] = [{
    pageNum: 1,
    items: [item("Introduction", 50, 750, 20), item("This is body text.", 50, 700, 10)],
    links: [],
  }];
  const md = pagesToMarkdown(pages);
  assert.match(md, /^#{1,3} Introduction/m);
  assert.match(md, /This is body text\./);
});

test("pagesToMarkdown: bullet lines become a Markdown list", () => {
  const pages: PageTextResult[] = [{
    pageNum: 1,
    items: [
      item("• First point", 50, 750, 10),
      item("• Second point", 50, 730, 10),
      item("- Third point", 50, 710, 10),
    ],
    links: [],
  }];
  const md = pagesToMarkdown(pages);
  assert.match(md, /- First point/);
  assert.match(md, /- Second point/);
  assert.match(md, /- Third point/);
});

test("pagesToMarkdown: links are listed, not fabricated inline", () => {
  const pages: PageTextResult[] = [{
    pageNum: 1,
    items: [item("See reference below.", 50, 750, 10)],
    links: [{ url: "https://example.com/paper", text: "" }],
  }];
  const md = pagesToMarkdown(pages);
  assert.match(md, /https:\/\/example\.com\/paper/);
});

test("pagesToMarkdown: empty input produces empty output, not an error", () => {
  const md = pagesToMarkdown([]);
  assert.equal(typeof md, "string");
});

test("pagesToMarkdown: never fabricates text not present in the input items", () => {
  const pages: PageTextResult[] = [{ pageNum: 1, items: [item("ExactWordXYZ", 50, 750, 10)], links: [] }];
  const md = pagesToMarkdown(pages);
  assert.ok(md.includes("ExactWordXYZ"));
  // sanity: nothing wildly unrelated was injected
  assert.ok(!md.includes("Lorem ipsum"));
});
