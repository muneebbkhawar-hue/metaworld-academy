#!/usr/bin/env node
// Next.js's "standalone" output (next.config.ts: output: "standalone") does
// NOT include the static asset folder or the public/ folder inside it - per
// Next's own deployment docs these must be copied in manually so the
// standalone server.js can find and serve them. Run after `next build`
// and before packaging (see package.json's "desktop:build" script).

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const STANDALONE = path.join(ROOT, ".next", "standalone");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[desktop:prepare] Skipping missing source: ${src}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (!fs.existsSync(STANDALONE)) {
  console.error(`[desktop:prepare] ${STANDALONE} does not exist - did "next build" run first?`);
  process.exit(1);
}

copyDir(path.join(ROOT, ".next", "static"), path.join(STANDALONE, ".next", "static"));
copyDir(path.join(ROOT, "public"), path.join(STANDALONE, "public"));

console.log("[desktop:prepare] Copied .next/static and public/ into the standalone output.");
