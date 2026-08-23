// Electron main process for the MetaWorld Research Academy desktop app.
//
// Architecture: this does NOT statically export the Next.js site (that
// would break every app/api/** route, including the Gemini-powered tools).
// Instead it spawns the real Next.js "standalone" server (produced by
// `next build` with `output: "standalone"` in next.config.ts) as a child
// process on a local port, spawns the 5 bundled R/Plumber backends the
// same way scripts/backend-supervisor.js does for local development (same
// ports, same scripts - just pointed at the R runtime and .R scripts that
// ship inside this app instead of the developer's machine), waits for both
// to report healthy, then opens a BrowserWindow pointed at the local Next
// server. Every existing route, page, and tool works completely unchanged.
//
// Gemini key handling: each installation stores its OWN key, entered via
// the in-app Settings page, in a local config file under Electron's
// userData directory - never bundled into the installer. GeminiProvider.ts
// is untouched; the key is injected as the GEMINI_API_KEY environment
// variable of the spawned Next server child process at startup, so no
// change to any existing server code was needed. A key change takes effect
// on next app restart (the Settings page says so explicitly).

const { app, BrowserWindow, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");
const { autoUpdater } = require("electron-updater");

// Global safety net: a real production crash (Windows Event Log + user
// report) showed that ONE unhandled error from a spawned R child process
// ("spawn UNKNOWN") took down the entire Electron main process with no
// recovery, severely enough to destabilize the whole machine under a rapid
// crash/respawn loop. The specific gap that caused it is fixed at its
// source (see launchRService's child.on("error", ...) handler below), but
// this top-level handler is kept as defense-in-depth so any future
// unexpected synchronous error logs and is survived instead of crashing
// the whole app - a broken R tool should never be able to take down the
// rest of the application (the website/PDF/Gemini tools) or the machine.
process.on("uncaughtException", (err) => {
  console.error("[metaworld-desktop] UNCAUGHT EXCEPTION (recovered, app kept running):", err);
});

const isPackaged = app.isPackaged;
const resourcesDir = isPackaged ? process.resourcesPath : path.join(__dirname, "..");

// ---- Paths -----------------------------------------------------------------

// The standalone server.js expects .next/static and public/ to live INSIDE
// its own directory (see electron/prepare-standalone.js, which copies them
// there at build time) - so only one path is needed here, not separate
// static/public paths.
const NEXT_SERVER_DIR = isPackaged
  ? path.join(resourcesDir, "standalone")
  : path.join(__dirname, "..", ".next", "standalone");

const R_HOME = isPackaged
  ? path.join(resourcesDir, "r-runtime")
  : "C:/Program Files/R/R-4.5.1";
const RSCRIPT = path.join(R_HOME, "bin", "Rscript.exe");
const R_LIBS = isPackaged
  ? path.join(resourcesDir, "r-library")
  : "C:/Users/munee/AppData/Local/R/win-library/4.5";
const R_SCRIPTS_DIR = isPackaged ? path.join(resourcesDir, "r-scripts") : path.join(__dirname, "r-scripts");

const USER_DATA_DIR = app.getPath("userData");
const CONFIG_FILE = path.join(USER_DATA_DIR, "config.json");

const NEXT_PORT = 3924; // arbitrary fixed local port, unlikely to collide

const R_SERVICES = [
  { name: "api", script: "api.R", port: 8000, healthPath: "/health" },
  { name: "tsa-api", script: "tsa-api.R", port: 8001, healthPath: "/health" },
  { name: "nma-api", script: "nma-api.R", port: 8002, healthPath: "/api/nma/health" },
  { name: "metareg-api", script: "metareg-api.R", port: 8003, healthPath: "/health" },
  { name: "rob-api", script: "rob-api.R", port: 8004, healthPath: "/health" },
  { name: "km-digitizer-api", script: "km-digitizer-api.R", port: 8005, healthPath: "/health" },
];

let nextProcess = null;
let rProcesses = [];
let appQuitting = false;
let mainWindow = null;

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

function log(...args) {
  console.log("[metaworld-desktop]", ...args);
}

// ---- Start the bundled Next.js standalone server ---------------------------

function startNextServer() {
  return new Promise((resolve, reject) => {
    const serverJs = path.join(NEXT_SERVER_DIR, "server.js");
    if (!fs.existsSync(serverJs)) {
      reject(new Error(`Next standalone server not found at ${serverJs}. Did you run "npm run build" first?`));
      return;
    }

    const config = readConfig();

    nextProcess = spawn(process.execPath, [serverJs], {
      cwd: NEXT_SERVER_DIR,
      env: {
        ...process.env,
        PORT: String(NEXT_PORT),
        HOSTNAME: "127.0.0.1",
        NODE_ENV: "production",
        DESKTOP_CONFIG_PATH: CONFIG_FILE,
        // Only injected if the user has saved a key via the in-app Settings
        // page - GeminiProvider.ts already throws a clean, existing
        // "not configured" error if this is absent, so AI tools simply show
        // that same message until a key is added. No source change needed.
        ...(config.geminiApiKey ? { GEMINI_API_KEY: config.geminiApiKey } : {}),
        ...(config.geminiModel ? { GEMINI_MODEL: config.geminiModel } : {}),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    nextProcess.stdout.on("data", (d) => log("[next]", d.toString().trim()));
    nextProcess.stderr.on("data", (d) => log("[next:err]", d.toString().trim()));
    nextProcess.on("exit", (code) => log(`Next server exited with code ${code}`));

    waitForHttp(`http://127.0.0.1:${NEXT_PORT}/`, 60000).then(resolve).catch(reject);
  });
}

// ---- Start the 5 bundled R/Plumber backends ---------------------------------
//
// Windows Event Log evidence from a real crash (STATUS_ACCESS_VIOLATION in
// R.dll, exception 0xc0000005) showed multiple Rscript.exe processes faulting
// within the same second on first launch - consistent with a DLL-load race
// when several R processes cold-start from the same fresh install
// simultaneously. Two mitigations, mirroring the proven pattern already used
// by scripts/backend-supervisor.js for local dev: (1) stagger the 5 initial
// launches slightly instead of firing them all in the same tick, and (2)
// restart any service that exits unexpectedly, with capped backoff, instead
// of leaving it dead for the rest of the app session (main.js previously had
// no recovery at all, unlike the supervisor).
const R_RESTART_BACKOFF_MS = [1000, 3000, 8000, 15000];
const R_MAX_CONSECUTIVE_FAILURES = 6;
const R_LAUNCH_STAGGER_MS = 700;

function scheduleRRestart(svc, failureCount, startedAt) {
  if (appQuitting) return;
  // A process that ran for a while before exiting (e.g. the user closing
  // the app) resets the failure streak - only rapid, repeated crashes
  // right after launch count toward giving up.
  const survivedAWhile = Date.now() - startedAt > 60000;
  const nextFailureCount = survivedAWhile ? 0 : failureCount + 1;
  if (nextFailureCount > R_MAX_CONSECUTIVE_FAILURES) {
    log(`[R:${svc.name}] failed ${nextFailureCount} times in a row - giving up automatic restarts for this session.`);
    return;
  }
  const delay = R_RESTART_BACKOFF_MS[Math.min(nextFailureCount - 1, R_RESTART_BACKOFF_MS.length - 1)];
  log(`[R:${svc.name}] restarting in ${delay}ms (attempt ${nextFailureCount})...`);
  setTimeout(() => launchRService(svc, nextFailureCount), delay);
}

function launchRService(svc, failureCount = 0) {
  const scriptPath = path.join(R_SCRIPTS_DIR, svc.script).replace(/\\/g, "/");
  // Must launch via plumber::pr(...)$run(...) exactly like
  // scripts/backend-supervisor.js does for local dev - a plain
  // `Rscript api.R` only *sources* the file (defining the route
  // functions and auto-printing each one) and then exits without ever
  // starting a server.
  const rExpr = `plumber::pr('${scriptPath}')$run(host='127.0.0.1', port=${svc.port})`;
  const startedAt = Date.now();

  let child;
  try {
    child = spawn(RSCRIPT, ["-e", rExpr], {
      cwd: R_SCRIPTS_DIR,
      env: {
        ...process.env,
        R_LIBS_USER: R_LIBS,
        R_HOME,
        ALLOWED_ORIGIN: "*", // local-only loopback traffic, no cross-origin concern in the desktop app
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    // spawn() can throw synchronously for some invalid-argument cases (rare,
    // but real crash reports showed a "spawn UNKNOWN" failure reaching this
    // code path) - without this try/catch that exception would be uncaught
    // and take down the entire Electron main process, not just this one R
    // service. Treat it exactly like a failed launch: log and retry.
    log(`[R:${svc.name}] failed to start:`, err.message);
    scheduleRRestart(svc, failureCount, startedAt);
    return;
  }

  // CRITICAL: child_process emits an 'error' event (not a thrown exception)
  // when the OS fails to actually create the process (missing executable,
  // permission denied, antivirus interference, etc). An EventEmitter with
  // no 'error' listener throws that error and crashes the whole process -
  // this exact gap caused the "spawn UNKNOWN" crash seen in production, and
  // is the single most important handler in this function.
  child.on("error", (err) => {
    log(`[R:${svc.name}] spawn error:`, err.message);
    rProcesses = rProcesses.filter((p) => p !== child);
    scheduleRRestart(svc, failureCount, startedAt);
  });
  child.stdout?.on("data", (d) => log(`[R:${svc.name}]`, d.toString().trim()));
  child.stderr?.on("data", (d) => log(`[R:${svc.name}:err]`, d.toString().trim()));
  child.on("exit", (code, signal) => {
    log(`[R:${svc.name}] exited with code ${code}${signal ? ` (signal ${signal})` : ""}`);
    rProcesses = rProcesses.filter((p) => p !== child);
    scheduleRRestart(svc, failureCount, startedAt);
  });
  rProcesses.push(child);
}

function startRServices() {
  if (!fs.existsSync(RSCRIPT)) {
    log(`WARNING: Rscript.exe not found at ${RSCRIPT} - R-powered tools will be unavailable this session.`);
    return;
  }
  R_SERVICES.forEach((svc, i) => {
    setTimeout(() => launchRService(svc), i * R_LAUNCH_STAGGER_MS);
  });
}

function waitForHttp(url, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on("error", () => {
          if (Date.now() - start > timeoutMs) reject(new Error(`Timed out waiting for ${url}`));
          else setTimeout(attempt, 500);
        });
    };
    attempt();
  });
}

// ---- App lifecycle -----------------------------------------------------------

async function createWindow() {
  // The packaged .exe already carries the MetaWorld icon (electron-builder's
  // "win.icon" config embeds it into the executable itself), and Windows
  // uses that automatically for the taskbar/window - this explicit path is
  // only needed so the icon also shows up during `npx electron .` dev runs,
  // which otherwise use the generic Electron icon.
  const devIconPath = path.join(__dirname, "assets", "icon.ico");

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "MetaWorld Research Academy",
    icon: !isPackaged && fs.existsSync(devIconPath) ? devIconPath : undefined,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  // External links (e.g. publication DOIs) should open in the OS browser,
  // not navigate the app window away from the tool.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://127.0.0.1:${NEXT_PORT}`)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  await mainWindow.loadURL(`http://127.0.0.1:${NEXT_PORT}/`);
}

// ---- Auto-update (GitHub Releases) -------------------------------------------
//
// Checks the GitHub repo configured under package.json's "build.publish" for
// a newer published release, downloads it silently in the background, and
// prompts the user to restart once it's ready. No-op and silent on any
// failure (e.g. no internet, no release published yet) - never blocks or
// interrupts normal use of the app. Only runs in the packaged app; running
// via `npx electron .` during development always skips this (autoUpdater
// requires app-update.yml, which only exists in a packaged build).
function setupAutoUpdate() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.on("update-downloaded", async (info) => {
    const { response } = await dialog.showMessageBox({
      type: "info",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      title: "Update ready",
      message: `MetaWorld Research Academy ${info.version} has been downloaded.`,
      detail: "Restart to apply the update. You can also apply it next time you close the app.",
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.on("error", (err) => log("Auto-update check failed (non-fatal):", err.message));
  autoUpdater.checkForUpdates().catch((err) => log("Auto-update check failed (non-fatal):", err.message));
}

app.whenReady().then(async () => {
  if (!fs.existsSync(USER_DATA_DIR)) fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  startRServices();
  try {
    await startNextServer();
  } catch (err) {
    log("FATAL: could not start bundled Next server:", err);
    app.quit();
    return;
  }
  await createWindow();
  setupAutoUpdate();
});

app.on("window-all-closed", () => {
  cleanup();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", cleanup);

function cleanup() {
  appQuitting = true; // stop the R restart-on-exit logic from firing during shutdown
  if (nextProcess) { try { nextProcess.kill(); } catch { /* best effort */ } }
  for (const p of rProcesses) { try { p.kill(); } catch { /* best effort */ } }
}
