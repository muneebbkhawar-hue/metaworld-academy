#!/usr/bin/env node
/**
 * Single-command startup for local development: runs the Next.js dev
 * server AND the R backend supervisor together, so `npm run dev:all` from
 * VS Code is enough to get the whole application running - no need to
 * remember to start both pieces separately (the actual root cause of the
 * "site can't be reached" incident this script was added to prevent: the
 * frontend dev server was killed independently of the R supervisor during
 * unrelated process cleanup, and nothing surfaced that only half the
 * application was still running).
 *
 * This does NOT replace `npm run dev` or `npm run backends` - both still
 * work standalone exactly as before. This is purely additive.
 */
const { spawn } = require("child_process");
const path = require("path");

const procs = [];

function run(name, command, args, color) {
  const child = spawn(command, args, { cwd: path.resolve(__dirname, ".."), shell: true });
  procs.push(child);
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  child.stdout.on("data", (d) => process.stdout.write(prefix + d.toString().replace(/\n(?!$)/g, "\n" + prefix)));
  child.stderr.on("data", (d) => process.stderr.write(prefix + d.toString().replace(/\n(?!$)/g, "\n" + prefix)));
  child.on("exit", (code, signal) => {
    console.log(`${prefix}exited (code=${code}, signal=${signal})`);
  });
  return child;
}

console.log("Starting frontend (next dev) and R backend supervisor together...\n");
run("frontend", "npm", ["run", "dev"], "36");   // cyan
run("backends", "npm", ["run", "backends"], "35"); // magenta

function shutdown() {
  console.log("\nShutting down both processes...");
  procs.forEach((p) => { try { p.kill(); } catch { /* ignore */ } });
  setTimeout(() => process.exit(0), 500);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
