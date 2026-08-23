// Centralized backend base URLs.
//
// Every statistical tool page in this app is a "use client" component that
// calls the R/Plumber backends directly from the browser (there is no
// Next.js API proxy layer - see the architecture note in apiClient.ts for
// why this session did not introduce one). That means these values must be
// NEXT_PUBLIC_* env vars: Next.js only inlines NEXT_PUBLIC_-prefixed
// variables into the client bundle, and a browser-side fetch() cannot read
// a server-only env var at all.
//
// Local development keeps working with zero configuration - the defaults
// below are exactly the ports this project has always used (8000/8001/8002
// on 127.0.0.1). To point the built app at a different backend location
// (a staging server, a reverse-proxied production host, etc.), set the
// corresponding NEXT_PUBLIC_*_API_URL in `.env.local` (or the hosting
// platform's env var settings) - no tool page needs to change.
//
// See `.env.example` for the full list with documentation, and
// AGENTS.md / the session report for the deployment rationale.

export const META_API_URL =
  process.env.NEXT_PUBLIC_META_API_URL || "http://127.0.0.1:8000";

export const TSA_API_URL =
  process.env.NEXT_PUBLIC_TSA_API_URL || "http://127.0.0.1:8001";

export const NMA_API_URL =
  process.env.NEXT_PUBLIC_NMA_API_URL || "http://127.0.0.1:8002";

export const META_REGRESSION_API_URL =
  process.env.NEXT_PUBLIC_META_REGRESSION_API_URL || "http://127.0.0.1:8003";

// rob-api.R - AI-Assisted Risk of Bias Assessment plots (robvis traffic-light
// / summary plots only - the AI evidence extraction itself goes through the
// server-side /api/rob/assess Next.js route, not this R service).
export const ROB_API_URL =
  process.env.NEXT_PUBLIC_ROB_API_URL || "http://127.0.0.1:8004";

// km-digitizer-api.R - Kaplan-Meier Curve Digitizer's deterministic
// (Guyot et al. 2012 / IPDfromKM package) survival data reconstruction. No
// AI/LLM is used anywhere in this tool's pipeline.
export const KM_DIGITIZER_API_URL =
  process.env.NEXT_PUBLIC_KM_DIGITIZER_API_URL || "http://127.0.0.1:8005";
