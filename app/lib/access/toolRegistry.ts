// Single source of truth for which routes are gated tools and what to call
// them - used by middleware (to decide what to gate), the request-access
// page (to show a human-readable name), and the admin panel (to label
// pending requests). Kept in sync with app/tools/page.tsx's TOOLS array by
// hand (both are small, human-curated lists - not worth generating one
// from the other for 13 entries).
export interface GatedTool {
  id: string; // matches the slug after /tools/ in the route, and tool_access.tool_id
  title: string;
}

export const GATED_TOOLS: GatedTool[] = [
  { id: "synthesis", title: "Forest Plot Generator" },
  { id: "bias", title: "Funnel Plot & Publication Bias" },
  { id: "grade", title: "GRADE Evidence Profile" },
  { id: "sensitivity", title: "Sensitivity Analysis" },
  { id: "tsa", title: "Trial Sequential Analysis" },
  { id: "network-meta-analysis", title: "Network Meta-Analysis" },
  { id: "meta-regression", title: "Pairwise Meta-Regression" },
  { id: "risk-of-bias", title: "AI-Assisted Risk of Bias Assessment" },
  { id: "statistical-conversions", title: "Statistical Conversions" },
  { id: "collage-maker", title: "Collage Maker" },
  { id: "file-converter", title: "PDF / Word / Image Utilities" },
  { id: "data-extraction", title: "Meta-Analysis Data Extraction" },
  { id: "km-digitizer", title: "Kaplan–Meier Curve Digitizer" },
];

export const GATED_TOOL_IDS = new Set(GATED_TOOLS.map((t) => t.id));

export function toolTitle(id: string): string {
  return GATED_TOOLS.find((t) => t.id === id)?.title ?? id;
}

// Both of you receive every access-request notification - checked
// server-side only (admin API routes, admin page), never sent to the
// client.
export const ADMIN_EMAILS = ["muneebb.khawar@gmail.com", "mirzahadeed64@gmail.com"];

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}
