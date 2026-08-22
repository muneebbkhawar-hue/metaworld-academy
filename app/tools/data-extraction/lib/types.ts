// Local editor/UI state types for the Data Extraction tool page - kept
// separate from the domain types in app/lib/extraction/types.ts, matching
// the existing risk-of-bias/meta-regression convention.
import type { ExtractionStatus, StudyProcessResult } from "@/app/lib/extraction/types";

export interface UploadItem {
  key: string; // stable per-file key (crypto.randomUUID)
  file: File;
  studyId: string; // editable by the user before submission
  fileHash: string; // for duplicate detection
  status: ExtractionStatus;
  result: StudyProcessResult | null;
  error: string | null;
  attempts: number; // number of times this study has been sent to /api/extraction/process-study
}

export type OutcomeTypeHint = "Dichotomous" | "Continuous" | "Generic Inverse Variance" | "Mixed" | "Let AI detect";

export interface ProjectConfig {
  projectName: string;
  experimentalGroup: string;
  controlGroup: string;
  reviewId: string;
  outcomeType: OutcomeTypeHint;
}

// Shape mirrored to localStorage so completed studies survive a page
// refresh (uploaded File objects are not serializable, so only the
// COMPLETED/NEEDS_REVIEW results persist - pending/failed studies must be
// re-uploaded after a refresh; see DOCS.md's "resumability" section for
// why this - not a fake full-job-persistence claim - is the honest model
// given this app has no server-side storage anywhere).
export interface PersistedJob {
  jobId: string;
  project: ProjectConfig;
  savedAt: string;
  results: { studyId: string; filename: string; result: StudyProcessResult; attempts: number }[];
}

export async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
