// Internal project state for the Kaplan-Meier Curve Digitizer. Everything
// here is kept in this shape (not scattered across many independent
// useState calls) specifically so the whole project can be exported/
// re-imported as one JSON file (see item 16 of the brief: reproducibility/
// audit trail) - the exported file IS this type, serialized.

export interface PixelPoint {
  x: number;
  y: number;
}

/** A single manually-calibrated axis reference: one pixel location <-> one known data value. */
export interface CalibrationRef {
  pixel: PixelPoint;
  value: number;
}

export interface AxisCalibration {
  refs: CalibrationRef[]; // exactly 2 once calibrated
}

/** A digitized curve point, already converted from pixel space to data space via the current calibration. */
export interface CurvePoint {
  id: string;
  time: number;
  survival: number; // always stored as a 0-1 proportion internally, regardless of the source figure's Y-axis labeling
  pixel: PixelPoint; // kept so points stay correctly placed if calibration is later edited/redone
}

export interface CensoringMark {
  id: string;
  time: number;
  survival: number;
  pixel: PixelPoint;
}

export interface Group {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  points: CurvePoint[];
  censoring: CensoringMark[];
}

export interface NumbersAtRiskRow {
  time: number;
  valuesByGroupId: Record<string, number | null>;
}

export interface ReconstructionWarning {
  groupName: string;
  message: string;
}

export interface ReconstructedGroupResult {
  name: string;
  status: "success" | "error";
  message?: string;
  mode?: "reconstructed" | "curve_only";
  ipd?: { id: number; time: number; event: number }[];
  km_summary?: {
    n: number;
    events: number;
    censored: number;
    median_survival_time?: number;
    median_estimable: boolean;
  } | null;
  warnings?: string[];
}

export interface ReconstructionResult {
  status: "success" | "error";
  message?: string;
  method?: string;
  groups: ReconstructedGroupResult[];
  validationPlotBase64?: string;
  reconstructedAt: string;
}

export type WizardStep =
  | "upload"
  | "calibrate-x"
  | "calibrate-y"
  | "groups"
  | "digitize"
  | "censoring"
  | "nrisk"
  | "reconstruct"
  | "export";

export type YAxisScale = "proportion" | "percentage"; // 0-1 vs 0-100

export interface SourceFileMeta {
  name: string;
  type: string;
  sizeBytes: number;
  pdfPageNumber?: number;
  pdfPageCount?: number;
  uploadedAt: string;
}

export interface ProjectState {
  sourceFile: SourceFileMeta | null;
  imageDataUrl: string | null; // the rendered figure (PDF page or the image itself), client-side only, never uploaded to any server
  imageWidth: number;
  imageHeight: number;
  yAxisScale: YAxisScale;
  xCalibration: AxisCalibration;
  yCalibration: AxisCalibration;
  groups: Group[];
  activeGroupId: string | null;
  numbersAtRisk: NumbersAtRiskRow[];
  numbersAtRiskEnabled: boolean;
  reconstruction: ReconstructionResult | null;
  reconstructionAccepted: boolean;
  createdAt: string;
  updatedAt: string;
}

export const GROUP_COLORS = ["#7c3aed", "#0ea5e9", "#f97316", "#16a34a", "#e11d48", "#ca8a04", "#0891b2", "#a855f7"];

export function newId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function emptyProject(): ProjectState {
  const now = new Date().toISOString();
  return {
    sourceFile: null,
    imageDataUrl: null,
    imageWidth: 0,
    imageHeight: 0,
    yAxisScale: "proportion",
    xCalibration: { refs: [] },
    yCalibration: { refs: [] },
    groups: [],
    activeGroupId: null,
    numbersAtRisk: [],
    numbersAtRiskEnabled: false,
    reconstruction: null,
    reconstructionAccepted: false,
    createdAt: now,
    updatedAt: now,
  };
}
