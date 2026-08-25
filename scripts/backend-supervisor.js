#!/usr/bin/env node
/**
 * Backend supervisor for the three R/Plumber statistical services
 * (Forest+Funnel+Sensitivity / TSA / NMA). Run with:
 *
 *   node scripts/backend-supervisor.js
 *
 * or, once wired into package.json:
 *
 *   npm run backends
 *
 * Responsibilities (see AGENTS.md session notes for the full spec this
 * implements):
 *   - start each R service if it isn't already running
 *   - adopt an already-healthy instance instead of spawning a duplicate
 *   - poll each service's /health endpoint continuously
 *   - detect crashes (process exit) and hangs (health-poll failures)
 *   - restart with exponential backoff, capped so a persistently crashing
 *     service is marked "failed" instead of restart-looping forever
 *   - log every lifecycle event to a rotating-by-run log file
 *   - expose an aggregate status endpoint (GET /status) the frontend (or a
 *     developer) can query
 *   - single-instance itself via a PID lockfile, so a second supervisor
 *     started by accident (e.g. two `npm run backends`) exits immediately
 *     instead of double-spawning every R process
 *   - shut down its child R processes cleanly on SIGINT/SIGTERM
 *
 * This is a plain Node script deliberately - no new framework, no Docker,
 * nothing beyond what's already in this project's toolchain.
 */

const { spawn, execSync } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");

const R_BACKEND_DIR = "C:/Users/munee/OneDrive/Desktop/metaworld-r-backend";
const RSCRIPT = "C:/Program Files/R/R-4.5.1/bin/Rscript.exe";
const STATUS_PORT = 8099;
const HEALTH_POLL_MS = 15000;
const HEALTH_TIMEOUT_MS = 4000;
// Discovered via a live crash-recovery test: Plumber's default server is
// single-threaded, so a legitimately slow but successful request (e.g. an
// NMA subgroup analysis fitting several full network models plus forest
// plots can take over a minute) blocks it from answering /health at all -
// a threshold of 3 (~45s at the poll interval below) produced a FALSE
// POSITIVE "hung" kill mid-computation. 8 consecutive failures (~2 minutes)
// gives realistic headroom for the heaviest current endpoints while still
// catching a genuinely wedged process in reasonable time.
const HANG_FAILURE_THRESHOLD = 8;
const BACKOFF_MS = [2000, 5000, 10000, 30000, 60000];
const MAX_CONSECUTIVE_FAILURES = 6; // after this many rapid crashes, stop auto-restarting
const STABLE_UPTIME_MS = 60000; // if a process survives this long, a later crash resets the failure streak
const FAILURE_WINDOW_MS = 10 * 60 * 1000; // consecutive-failure counting window

const SERVICES = [
  { name: "api", label: "Forest / Funnel / Sensitivity", script: "api.R", port: 8000, healthPath: "/health" },
  { name: "tsa-api", label: "Trial Sequential Analysis", script: "tsa-api.R", port: 8001, healthPath: "/health" },
  // nma-api.R's health route predates this supervisor and is already relied
  // on by the NMA frontend's reconnect banner at this exact path - kept as
  // /api/nma/health rather than renamed, to avoid breaking that contract.
  { name: "nma-api", label: "Network Meta-Analysis", script: "nma-api.R", port: 8002, healthPath: "/api/nma/health" },
  { name: "metareg-api", label: "Pairwise Meta-Regression", script: "metareg-api.R", port: 8003, healthPath: "/health" },
  { name: "rob-api", label: "AI-Assisted Risk of Bias (plots)", script: "rob-api.R", port: 8004, healthPath: "/health" },
  { name: "km-digitizer-api", label: "Kaplan-Meier Curve Digitizer (reconstruction)", script: "km-digitizer-api.R", port: 8005, healthPath: "/health" },
  { name: "dta-api", label: "Diagnostic Test Accuracy Meta-Analysis", script: "dta-api.R", port: 8006, healthPath: "/health" },
];

const LOG_DIR = path.join(R_BACKEND_DIR, "supervisor-logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const LOG_FILE = path.join(LOG_DIR, "supervisor.log");
const LOCK_FILE = path.join(R_BACKEND_DIR, "supervisor.lock");

function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`;
  console.log(stamped);
  try { fs.appendFileSync(LOG_FILE, stamped + "\n"); } catch { /* best effort */ }
}

// ---- Single-instance lock ---------------------------------------------------

function pidIsAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function acquireLock() {
  if (fs.existsSync(LOCK_FILE)) {
    const existingPid = parseInt(fs.readFileSync(LOCK_FILE, "utf8").trim(), 10);
    if (existingPid && pidIsAlive(existingPid)) {
      log(`Another supervisor is already running (PID ${existingPid}). Exiting to avoid duplicate R processes.`);
      process.exit(0);
    }
    log(`Found a stale lock file (PID ${existingPid} is not running) - taking over.`);
  }
  fs.writeFileSync(LOCK_FILE, String(process.pid));
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE) && parseInt(fs.readFileSync(LOCK_FILE, "utf8").trim(), 10) === process.pid) {
      fs.unlinkSync(LOCK_FILE);
    }
  } catch { /* best effort */ }
}

// ---- Health check ------------------------------------------------------------

function checkHealth(port, healthPath) {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port, path: healthPath, timeout: HEALTH_TIMEOUT_MS }, (res) => {
      res.on("data", () => {}); // drain the response so 'end' fires; body content is irrelevant to a health check
      res.on("end", () => resolve(res.statusCode === 200));
    });
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.on("error", () => resolve(false));
  });
}

function killPort(port) {
  // Best-effort: find whatever owns the port on Windows and stop it. Only
  // used when a port is occupied by something unresponsive (not our own
  // tracked child), so we can spawn a clean replacement instead of failing.
  try {
    const out = execSync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`,
      { encoding: "utf8" }
    ).trim();
    if (!out) return;
    out.split(/\s+/).forEach((pidStr) => {
      const pid = parseInt(pidStr, 10);
      if (pid) {
        try {
          execSync(`powershell -NoProfile -Command "Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue"`);
          log(`Killed unresponsive process PID ${pid} occupying port ${port}.`);
        } catch { /* ignore */ }
      }
    });
  } catch { /* ignore - best effort */ }
}

// ---- Per-service state / lifecycle -------------------------------------------

class ServiceSupervisor {
  constructor(cfg) {
    this.cfg = cfg;
    this.proc = null;
    this.status = "starting"; // starting | ok | restarting | failed | adopted
    this.startedAt = null;
    this.restarts = 0;
    this.failureTimestamps = [];
    this.consecutiveHealthFailures = 0;
    this.lastError = null;
    this.shuttingDown = false;
  }

  scriptPath() { return `${R_BACKEND_DIR}/${this.cfg.script}`; }

  async start() {
    const alreadyHealthy = await checkHealth(this.cfg.port, this.cfg.healthPath);
    if (alreadyHealthy) {
      log(`[${this.cfg.name}] Port ${this.cfg.port} already answers /health - adopting existing instance instead of spawning a duplicate.`);
      this.status = "adopted";
      this.startedAt = Date.now();
      return;
    }
    killPort(this.cfg.port); // clear anything unresponsive squatting the port
    this.spawn();
  }

  spawn() {
    // Rscript.exe on Windows launches an x64 grandchild process that is the
    // ACTUAL port holder - killing only the tracked direct child (see
    // shutdown()/pollHealth() below) leaves that grandchild alive and bound
    // to the port, so the next spawn collides with "address already in
    // use". killPort() finds and kills whatever really owns the port
    // (parent or grandchild) as a safety net before every spawn.
    killPort(this.cfg.port);
    const rExpr = `plumber::pr('${this.scriptPath()}')$run(host='127.0.0.1', port=${this.cfg.port})`;
    log(`[${this.cfg.name}] Starting Rscript on port ${this.cfg.port} (attempt #${this.restarts + 1})...`);
    const outLog = fs.openSync(path.join(LOG_DIR, `${this.cfg.name}-stdout.log`), "a");
    const errLog = fs.openSync(path.join(LOG_DIR, `${this.cfg.name}-stderr.log`), "a");
    const child = spawn(RSCRIPT, ["-e", rExpr], { stdio: ["ignore", outLog, errLog] });
    this.proc = child;
    this.startedAt = Date.now();
    this.status = "restarting";

    child.on("exit", (code, signal) => {
      this.proc = null;
      if (this.shuttingDown) {
        log(`[${this.cfg.name}] Process exited during supervisor shutdown (code=${code}, signal=${signal}).`);
        return;
      }
      const uptimeMs = Date.now() - this.startedAt;
      log(`[${this.cfg.name}] CRASHED (code=${code}, signal=${signal}) after ${Math.round(uptimeMs / 1000)}s uptime.`);
      this.lastError = `Process exited with code ${code}${signal ? `, signal ${signal}` : ""} after ${Math.round(uptimeMs / 1000)}s`;
      if (uptimeMs >= STABLE_UPTIME_MS) {
        // It ran stably for a while before dying - treat this as a fresh
        // failure streak rather than piling onto rapid crash-loop counting.
        this.failureTimestamps = [];
      }
      this.scheduleRestart();
    });
  }

  scheduleRestart() {
    const now = Date.now();
    this.failureTimestamps = this.failureTimestamps.filter((t) => now - t < FAILURE_WINDOW_MS);
    this.failureTimestamps.push(now);
    const consecutiveFailures = this.failureTimestamps.length;

    if (consecutiveFailures > MAX_CONSECUTIVE_FAILURES) {
      this.status = "failed";
      log(`[${this.cfg.name}] ${consecutiveFailures} failures within ${FAILURE_WINDOW_MS / 60000} minutes - giving up automatic restarts. Manual intervention required (check ${LOG_DIR}/${this.cfg.name}-stderr.log).`);
      return;
    }

    const delay = BACKOFF_MS[Math.min(consecutiveFailures - 1, BACKOFF_MS.length - 1)];
    this.restarts += 1;
    log(`[${this.cfg.name}] Restart attempt ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES} in ${delay / 1000}s (total restarts this session: ${this.restarts}).`);
    setTimeout(() => { if (!this.shuttingDown) this.spawn(); }, delay);
  }

  async pollHealth() {
    if (this.status === "failed") return;
    const healthy = await checkHealth(this.cfg.port, this.cfg.healthPath);
    if (healthy) {
      if (this.status !== "ok") log(`[${this.cfg.name}] Health check passed - status OK.`);
      this.status = "ok";
      this.consecutiveHealthFailures = 0;
      return;
    }
    this.consecutiveHealthFailures += 1;
    log(`[${this.cfg.name}] Health check FAILED (${this.consecutiveHealthFailures}/${HANG_FAILURE_THRESHOLD}).`);
    if (this.consecutiveHealthFailures >= HANG_FAILURE_THRESHOLD) {
      this.consecutiveHealthFailures = 0;
      if (this.proc) {
        log(`[${this.cfg.name}] Treating process as hung - killing it to trigger a restart.`);
        this.lastError = "Health checks failed repeatedly - process treated as hung and restarted.";
        this.proc.kill();
      } else {
        // Adopted process (or previously failed) is no longer responding - try a fresh spawn.
        log(`[${this.cfg.name}] No tracked process handle and health is failing - attempting a fresh start.`);
        this.status = "restarting";
        killPort(this.cfg.port);
        this.spawn();
      }
    }
  }

  shutdown() {
    this.shuttingDown = true;
    if (this.proc) {
      log(`[${this.cfg.name}] Stopping process (PID ${this.proc.pid}) for graceful shutdown.`);
      try { this.proc.kill(); } catch { /* ignore */ }
    }
    // Also kill whatever actually holds the port (see note in spawn()) so
    // shutdown never leaves an orphaned R process behind.
    killPort(this.cfg.port);
  }

  toJSON() {
    return {
      name: this.cfg.name, label: this.cfg.label, port: this.cfg.port,
      status: this.status, pid: this.proc ? this.proc.pid : null,
      restarts: this.restarts,
      uptime_seconds: this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : null,
      lastError: this.lastError,
    };
  }
}

// ---- Main --------------------------------------------------------------------

async function main() {
  acquireLock();
  log("Backend supervisor starting.");

  const supervisors = SERVICES.map((cfg) => new ServiceSupervisor(cfg));
  for (const sv of supervisors) {
    await sv.start();
  }

  const pollTimer = setInterval(() => {
    supervisors.forEach((sv) => sv.pollHealth());
  }, HEALTH_POLL_MS);

  const statusServer = http.createServer((req, res) => {
    if (req.url === "/status") {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ services: supervisors.map((s) => s.toJSON()) }, null, 2));
    } else {
      res.writeHead(404); res.end();
    }
  });
  statusServer.listen(STATUS_PORT, "127.0.0.1", () => {
    log(`Aggregate status endpoint listening at http://127.0.0.1:${STATUS_PORT}/status`);
  });

  const shutdown = (signal) => {
    log(`Received ${signal} - shutting down supervisor and its R processes.`);
    clearInterval(pollTimer);
    supervisors.forEach((sv) => sv.shutdown());
    statusServer.close();
    releaseLock();
    setTimeout(() => process.exit(0), 500);
  };
  // NOTE (tested, documented honestly): these handlers correctly run a
  // clean shutdown when the supervisor exits via Ctrl+C in the terminal
  // it's running in (the standard, documented way to stop it) or via
  // `process.kill(pid)`/SIGTERM from another Node process on the SAME
  // machine in a normal foreground scenario. What they can NOT catch -
  // because no Node process can, on Windows - is a hard kill (Task
  // Manager "End Process", PowerShell `Stop-Process -Force`, or killing a
  // fully-detached background instance from outside its own console),
  // which bypasses all in-process signal handlers at the OS level. If that
  // happens, any orphaned R processes are still self-healed on the next
  // supervisor start: start() adopts an already-healthy orphan instead of
  // spawning a duplicate, and pollHealth()'s fallback path (see above)
  // respawns anything left unhealthy.
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("exit", releaseLock);
}

main().catch((err) => {
  log(`FATAL: supervisor failed to start: ${err.stack || err}`);
  releaseLock();
  process.exit(1);
});
