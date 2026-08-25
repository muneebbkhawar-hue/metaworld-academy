// Centralized tool registry - the single source of truth for every tool
// shown on the Tools dashboard. This does NOT change any tool's route,
// statistical logic, or backend - it only extracts what used to be an
// inline array inside app/tools/page.tsx into a shared, richer-typed
// module, so other surfaces (search, a future "featured tools" widget,
// etc.) can reuse the same data instead of duplicating it.
//
// TO ADD A NEW TOOL LATER: create its route under app/tools/<slug>/, then
// add one entry to TOOLS below with a category from CATEGORIES. The Tools
// dashboard (app/tools/page.tsx) renders entirely from this list - no other
// file needs to change.
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3, Filter, ShieldCheck, RotateCcw, Activity, ScatterChart, Network,
  FileSearch, Calculator, LayoutGrid, Files, Database, LineChart, Stethoscope,
} from 'lucide-react';

export type CategoryKey =
  | "data-extraction"
  | "meta-analysis"
  | "network-meta-analysis"
  | "bias-evidence"
  | "statistical-analysis"
  | "utilities";

export interface CategoryMeta {
  key: CategoryKey;
  label: string;
  /** One-line description shown under the category heading on the Tools dashboard. */
  description: string;
}

// Order here is the display order on the Tools dashboard - follows the
// actual research workflow (obtain data -> synthesize -> assess bias ->
// broaden/convert -> export), not an alphabetical or arbitrary list.
export const CATEGORIES: CategoryMeta[] = [
  { key: "data-extraction", label: "Data & Extraction", description: "Turn source documents and figures into structured, analyzable data." },
  { key: "meta-analysis", label: "Meta-Analysis", description: "Core tools for pairwise evidence synthesis, robustness checks, and sequential monitoring." },
  { key: "network-meta-analysis", label: "Network Meta-Analysis", description: "Compare multiple interventions simultaneously within one evidence network." },
  { key: "bias-evidence", label: "Bias & Evidence Assessment", description: "Assess study-level risk of bias and the overall certainty of a body of evidence." },
  { key: "statistical-analysis", label: "Statistical Analysis", description: "Standalone statistical conversions and calculations used throughout a review." },
  { key: "utilities", label: "Utilities", description: "General-purpose research utilities that support manuscript and figure preparation." },
];

export type BackendType = "r" | "ai" | "client-only";

export interface Tool {
  id: string;
  n: string; // display index, kept from the original card design
  name: string;
  route: string;
  category: CategoryKey;
  description: string;
  icon: LucideIcon;
  tags: string[];
  backend: BackendType;
}

export const TOOLS: Tool[] = [
  {
    id: "forest-plot", n: "01", name: "Forest Plot Generator", route: "/tools/synthesis", category: "meta-analysis", icon: BarChart3,
    description: "Cochrane-aligned forest plots for dichotomous, continuous, and generic inverse-variance outcomes, with multi-outcome batch analysis from one extraction sheet.",
    tags: ["R", "Meta-analysis"], backend: "r",
  },
  {
    id: "funnel-plot", n: "02", name: "Funnel Plot & Publication Bias", route: "/tools/bias", category: "meta-analysis", icon: Filter,
    description: "Contour-enhanced funnel plots with Egger's regression test for small-study effects, supporting the same multi-outcome batch workflow.",
    tags: ["R", "Meta-analysis"], backend: "r",
  },
  {
    id: "sensitivity", n: "03", name: "Sensitivity Analysis (Leave-One-Out)", route: "/tools/sensitivity", category: "meta-analysis", icon: RotateCcw,
    description: "Leave-one-out influence diagnostics to test how robust a pooled estimate is to any single study.",
    tags: ["R", "Meta-analysis"], backend: "r",
  },
  {
    id: "tsa", n: "04", name: "Trial Sequential Analysis", route: "/tools/tsa", category: "meta-analysis", icon: Activity,
    description: "Cumulative Z-curve with sequential monitoring boundaries and required information size, via the R RTSA package.",
    tags: ["R", "Meta-analysis"], backend: "r",
  },
  {
    id: "meta-regression", n: "05", name: "Pairwise Meta-Regression", route: "/tools/meta-regression", category: "meta-analysis", icon: ScatterChart,
    description: "Explicitly select a study-level moderator and run univariable or multivariable meta-regression, powered by R metafor.",
    tags: ["R", "Meta-analysis"], backend: "r",
  },
  {
    id: "diagnostic-accuracy", n: "06", name: "Diagnostic Test Accuracy Meta-Analysis", route: "/tools/diagnostic-accuracy", category: "meta-analysis", icon: Stethoscope,
    description: "Perform bivariate and HSROC-based meta-analysis of diagnostic test accuracy studies using TP, FP, FN, and TN data.",
    tags: ["R", "Diagnostic Accuracy"], backend: "r",
  },
  {
    id: "nma", n: "07", name: "Network Meta-Analysis", route: "/tools/network-meta-analysis", category: "network-meta-analysis", icon: Network,
    description: "Frequentist NMA with network geometry, league table, treatment ranking, diagnostics, and a CINeMA-assisted certainty workflow.",
    tags: ["R", "NMA"], backend: "r",
  },
  {
    id: "risk-of-bias", n: "08", name: "AI-Assisted Risk of Bias Assessment", route: "/tools/risk-of-bias", category: "bias-evidence", icon: FileSearch,
    description: "Upload study PDFs for AI-assisted, evidence-grounded RoB 2 / ROBINS-I / QUADAS-2 judgments, reviewed and editable before publication-style plots are produced.",
    tags: ["AI", "Gemini", "Risk of Bias"], backend: "ai",
  },
  {
    id: "grade", n: "09", name: "GRADE Evidence Profile", route: "/tools/grade", category: "bias-evidence", icon: ShieldCheck,
    description: "Build Cochrane-style GRADE evidence profiles and Summary-of-Findings tables, single-outcome or as a multi-outcome batch.",
    tags: ["R", "Evidence Certainty"], backend: "r",
  },
  {
    id: "statistical-conversions", n: "10", name: "Statistical Conversions", route: "/tools/statistical-conversions", category: "statistical-analysis", icon: Calculator,
    description: "Convert between median/IQR/range and mean/SD, CI and SE, and ratio effect measures - every result labeled exact, estimated, or assumption-based.",
    tags: ["Statistical"], backend: "client-only",
  },
  {
    id: "data-extraction", n: "11", name: "Meta-Analysis Data Extraction", route: "/tools/data-extraction", category: "data-extraction", icon: Database,
    description: "AI-assisted, evidence-grounded extraction of study characteristics, baseline variables, and clinical outcomes from included-study PDFs into a review-ready extraction sheet.",
    tags: ["AI", "Gemini", "Extraction"], backend: "ai",
  },
  {
    id: "km-digitizer", n: "12", name: "Kaplan–Meier Curve Digitizer", route: "/tools/km-digitizer", category: "data-extraction", icon: LineChart,
    description: "Digitize published survival curves and reconstruct individual patient data (Guyot et al. 2012 method) for downstream meta-analysis - fully deterministic, no AI.",
    tags: ["R", "Extraction"], backend: "r",
  },
  {
    id: "collage-maker", n: "13", name: "Collage Maker", route: "/tools/collage-maker", category: "utilities", icon: LayoutGrid,
    description: "Arrange multiple figures into a publication-ready collage with panel labels and captions, entirely in your browser.",
    tags: ["Utility"], backend: "client-only",
  },
  {
    id: "file-converter", n: "14", name: "PDF / Word / Image Utilities", route: "/tools/file-converter", category: "utilities", icon: Files,
    description: "Convert between JPG/PNG, render PDF pages as images, and convert between PDF, Word, and Markdown for manuscript preparation.",
    tags: ["Utility"], backend: "client-only",
  },
];

export function toolsByCategory(key: CategoryKey): Tool[] {
  return TOOLS.filter(t => t.category === key);
}
