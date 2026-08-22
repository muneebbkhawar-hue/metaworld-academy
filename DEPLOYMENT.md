# Deployment Guide — MetaWorld Research Academy

This document is the practical, project-specific reference for deploying and maintaining this application. It assumes the reader is comfortable with Git and Vercel's dashboard but is not necessarily familiar with this codebase's architecture.

## 1. Prerequisites

- A GitHub account (or another Git host Vercel supports).
- A Vercel account, linked to that GitHub account.
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) (used by the Risk of Bias and Data Extraction tools).
- A place to host the 5 R/Plumber statistical backends — **these cannot run on Vercel** (see §5). Any host that can keep a long-running R process alive and reachable over HTTPS works (a small VPS, a container platform, etc.). This project does not include or prescribe that hosting - it is a separate piece of infrastructure this app calls over HTTP.

## 2. GitHub setup

This project is **not currently a Git repository** (no `.git` directory exists). Before anything else:

```
git init
git add .
git commit -m "Initial commit"
```

Before your first commit, double-check `.gitignore` already excludes `.env*` (it does, with a carve-out for `.env.example`) so no secret is ever committed. Then create a new GitHub repository and push:

```
git remote add origin https://github.com/<you>/<repo>.git
git branch -M main
git push -u origin main
```

## 3. Vercel setup

1. In the Vercel dashboard, "Add New… → Project", import the GitHub repository above.
2. Framework preset: Next.js (auto-detected). Build command `next build`, output is auto-detected — no changes needed.
3. Before the first deploy, add the environment variables from §4 in the project's Settings → Environment Variables.
4. Deploy.

## 4. Required environment variables

| Variable | Scope | Required for | Notes |
|---|---|---|---|
| `GEMINI_API_KEY` | **Server only** | Risk of Bias + Data Extraction tools | Secret. Set in Vercel's Environment Variables (Production **and** Preview if you test PR previews). Never prefix with `NEXT_PUBLIC_`. |
| `GEMINI_MODEL` | Server only | Same two tools | Optional — has a code default (`gemini-3.6-flash`). Set only to override. |
| `NEXT_PUBLIC_META_API_URL` | Client (inlined into the browser bundle) | Forest Plot, Funnel Plot, Sensitivity, GRADE | The public HTTPS URL of your hosted `api.R` service. Not a secret — it's just a base URL, but it becomes visible in the compiled JS regardless. |
| `NEXT_PUBLIC_TSA_API_URL` | Client | Trial Sequential Analysis | Hosted `tsa-api.R` URL. |
| `NEXT_PUBLIC_NMA_API_URL` | Client | Network Meta-Analysis | Hosted `nma-api.R` URL. |
| `NEXT_PUBLIC_META_REGRESSION_API_URL` | Client | Pairwise Meta-Regression | Hosted `metareg-api.R` URL. |
| `NEXT_PUBLIC_ROB_API_URL` | Client | Risk of Bias plots (traffic-light/summary images) | Hosted `rob-api.R` URL. |

**Local development** needs none of these set explicitly — every `NEXT_PUBLIC_*_API_URL` falls back to `http://127.0.0.1:<port>` and `GEMINI_API_KEY`/`GEMINI_MODEL` are read from `.env.local` (copy `.env.example` to `.env.local` and fill in your own key). **Production** must set all 7 in Vercel — the app does not, and must not, depend on `.env.local` existing at all in that environment (it's gitignored and never deployed).

## 5. R backend deployment requirements — READ BEFORE DEPLOYING

There are **5 R/Plumber services**, all currently started as long-running local Windows processes by `scripts/backend-supervisor.js` on this development machine:

| Service | Script | R packages | Local port |
|---|---|---|---|
| Forest / Funnel / Sensitivity / GRADE-adjacent | `api.R` | `meta`, `base64enc` | 8000 |
| Trial Sequential Analysis | `tsa-api.R` | `RTSA`, `ggplot2`, `ggrepel`, `scales`, `base64enc` | 8001 |
| Network Meta-Analysis | `nma-api.R` | `netmeta`, `meta`, `ggplot2`, `scales`, `base64enc` | 8002 |
| Pairwise Meta-Regression | `metareg-api.R` | `metafor`, `base64enc` | 8003 |
| Risk of Bias plots (robvis) | `rob-api.R` | `robvis`, `ggplot2`, `base64enc`, `svglite` | 8004 |

**Classification: REQUIRES SEPARATE DEPLOYMENT.** None of these are Vercel-compatible, and this is not something that can be worked around by configuration — Vercel serverless functions do not support persistent, long-running processes, do not have R installed, and cannot keep a child process alive between requests the way `backend-supervisor.js` does locally. This app's statistical logic (in R, using `meta`/`netmeta`/`metafor`/`RTSA`) has **not** been rewritten in JavaScript to force Vercel compatibility, and should not be — that would risk changing scientifically validated calculations for the sake of infrastructure convenience.

**What you must do:** host these 5 R/Plumber scripts on a separate always-on server (any VPS or container host that can run R + Plumber and stay reachable over HTTPS works — this repository does not include or require a specific one). That host must:
- Have R installed with the packages listed above (see `install_packages.R` in the R backend folder).
- Run each script's Plumber router bound to a public interface (not `127.0.0.1`) and reachable over HTTPS.
- Allow CORS from your Vercel domain.
- Ideally run under its own process supervisor (the existing `backend-supervisor.js` is Windows/local-development-specific and is not meant to be deployed as-is; a production host should use its own equivalent, e.g. `systemd`, a container restart policy, or a process manager appropriate to that host).

Then point the 5 `NEXT_PUBLIC_*_API_URL` variables (§4) at that host in Vercel.

**Architecture diagram:**

```
Vercel
  |
  +-- Next.js frontend (all static/client tool pages)
  |
  +-- Next.js API routes (/api/rob/assess, /api/extraction/process-study)
  |         |
  |         +-- Gemini API (server-side only, GEMINI_API_KEY)
  |
  +-- Browser -> directly calls -> External R backend host (NOT Vercel)
                                     |
                                     +-- api.R (8000)
                                     +-- tsa-api.R (8001)
                                     +-- nma-api.R (8002)
                                     +-- metareg-api.R (8003)
                                     +-- rob-api.R (8004, plots only)
```

The browser calls the R backends **directly** (no Next.js proxy layer exists today - see `app/lib/apiClient.ts`'s own architecture comment for the reasoning), so the R host's URLs must be public and CORS-enabled for your Vercel domain, not just reachable from Vercel's servers.

## 6. Local development instructions

```
npm install
copy .env.example .env.local   # then fill in your own GEMINI_API_KEY
npm run dev:all                # starts Next.js AND the R backend supervisor together
```

Or run them separately: `npm run dev` (Next.js only) and `npm run backends` (R supervisor only, in another terminal). The R backend supervisor expects R and the required packages installed locally, with paths currently hard-coded in `scripts/backend-supervisor.js` for this development machine (`C:/Users/munee/OneDrive/Desktop/metaworld-r-backend`, `C:/Program Files/R/R-4.5.1/bin/Rscript.exe`) — adjust those constants if running on a different machine.

## 7. Production deployment instructions

Once GitHub + Vercel are connected (§2–3) and all 7 environment variables are set (§4) and the R backends are hosted separately and reachable (§5): push to `main` (or your configured production branch) and Vercel builds and deploys automatically. No manual upload step exists or is needed.

## 8. How future updates are deployed

```
edit code locally -> test with `npm run dev:all` -> git add -> git commit -> git push
                                                                        |
                                                                        v
                                                              GitHub receives the push
                                                                        |
                                                                        v
                                                        Vercel automatically builds + deploys
```

Every push to the production branch triggers a new deployment automatically; no step in this project requires manually re-uploading the site.

## 9. How to add a new tool

1. Create `app/tools/<tool-name>/page.tsx` (a `"use client"` page) following the existing convention: `Nav` + `Footer` + `FadeIn` wrappers, purple design tokens (`--bg-void`, `--purple-bright`, `--gradient-primary`, etc.), a `components/` subfolder for the tool's own pieces, and a `DOCS.md` describing its architecture/formulas/limitations.
2. If it needs a new R endpoint, add it to the appropriate existing R script (or a new one) and register it in `scripts/backend-supervisor.js`'s `SERVICES` array; add a new `NEXT_PUBLIC_*_API_URL` in `app/lib/apiConfig.ts` + `.env.example` + Vercel if it's a genuinely new backend.
3. If it needs Gemini, reuse `app/lib/ai/GeminiProvider.ts` (add a new method, don't duplicate the retry/classification logic) and add a new Next.js API route under `app/api/` following `app/api/extraction/process-study/route.ts`'s pattern (server-only, structured JSON errors, no filesystem writes).
4. Register it in `app/tools/page.tsx`'s `TOOLS` array (and `CATEGORIES` if it needs a new category).

## 10. How to update an existing tool

Edit the tool's own files under `app/tools/<tool-name>/`. Do not touch `app/lib/ai/`, `app/lib/apiConfig.ts`, `app/lib/apiClient.ts`, or `app/lib/exportUtils.ts` unless the change is genuinely shared infrastructure — several tools depend on those staying stable. Run `npx tsc --noEmit`, `npm run lint`, and `npm run build` before pushing.

## 11. How to rollback a deployment

In the Vercel dashboard, open the project's "Deployments" tab, find the last known-good deployment, and use its "..." menu → "Promote to Production". This does not require a Git revert — it re-points production traffic at a previously built deployment instantly. To also fix the source going forward, `git revert` the bad commit locally and push.

## 12. How to inspect Vercel logs

Vercel dashboard → your project → "Logs" tab (real-time) or a specific deployment's "Functions" tab for that deployment's serverless function invocations (`/api/rob/assess`, `/api/extraction/process-study`). Errors are logged server-side only via `console.error` in this codebase and never include the Gemini API key or full PDF contents — see `app/api/extraction/process-study/route.ts` and `app/lib/ai/GeminiProvider.ts` for the exact logging behavior.

## 13. How to rotate the Gemini API key

1. Generate a new key at [Google AI Studio](https://aistudio.google.com/apikey).
2. Update it in Vercel: Project Settings → Environment Variables → edit `GEMINI_API_KEY` → redeploy (Vercel does not hot-reload env vars into already-running functions; a redeploy is required).
3. Update your local `.env.local` the same way for local development.
4. Revoke/delete the old key in Google AI Studio once the new one is confirmed working.

## 14. Known limitations

- **The 5 R/Plumber backends require separate hosting** (§5) — this is the single largest piece of deployment work, not a Vercel configuration toggle.
- **No Next.js → R proxy layer exists** — the browser calls the R backend URLs directly, so those URLs (not secrets, but base URLs) are visible in the compiled JS bundle and must be CORS-enabled for your production domain.
- **Data Extraction's processing queue is browser-controlled, not a durable server-side job.** If the browser tab closes mid-batch, processing stops (a Vercel serverless function is not a persistent background worker) — already-completed studies are preserved in that browser's `localStorage` and resumable from a reopened tab in the *same* browser, but there is no cross-device or "resume after closing everything" capability today. A future upgrade path — **a database-backed extraction job queue** (e.g. a durable job table + a real background worker or scheduled function) — would be required for true background processing and cross-device resume; this was a deliberate scope decision for the current architecture, not an oversight, and is safe to add later without disrupting the current tool.
- **Large PDF / batch upload sizes are constrained by Vercel's platform-level request body limit**, which is smaller than what this app's own code currently permits (`MAX_FILE_BYTES` in the two Gemini API routes). Confirm your actual plan's limit and adjust those constants (and the user-facing messaging) before relying on large uploads in production.
- **`maxDuration = 300` (5 minutes)** is set on both Gemini API routes — this requires at least a Vercel Pro-tier plan; the Hobby/free tier caps function duration much lower, which would silently truncate a long extraction request rather than failing cleanly.
- A pre-existing, unrelated observation: `/tools/grade` calls `api.R`'s `/api/grade/evaluate` endpoint, but the currently-running `api.R` (the one `backend-supervisor.js` actually spawns) does not define that route — only a separate, apparently-unwired `grade_api.R`/`grade_engine.R` in the R backend folder does. This predates this session's work and was not modified; worth resolving before relying on GRADE in production.
