// Local editor/UI state types for the Risk of Bias tool page - kept
// separate from the framework/decision-engine types in app/lib/rob/types.ts,
// matching the existing meta-regression convention (lib/types.ts for
// editor state vs app/types/statistics.ts for backend response shapes).
import type { StudyResult } from "@/app/lib/rob/types";

export type UploadStatus =
  | "Waiting"
  | "Classifying"
  | "Checking compatibility"
  | "Extracting evidence"
  | "Assessing"
  | "Completed"
  | "Needs review"
  | "Rejected"
  | "Failed";

export interface UploadItem {
  key: string; // stable per-file key (crypto.randomUUID)
  file: File;
  studyId: string; // editable by the user before submission
  status: UploadStatus;
  result: StudyResult | null;
}

export function statusFromResult(result: StudyResult): UploadStatus {
  if (result.status === "completed") return "Completed";
  if (result.status === "needs_review") return "Needs review";
  if (result.status === "rejected") return "Rejected";
  return "Failed";
}
