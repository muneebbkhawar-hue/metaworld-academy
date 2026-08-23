// Thin client for km-digitizer-api.R's /reconstruct endpoint, following the
// same apiClient.post() pattern every other tool page already uses. Sends
// ONLY the small structured digitization data (points, numbers-at-risk,
// group names) - never the uploaded image/PDF itself, per the brief's
// performance requirement to avoid sending the source figure to the server.
import { apiClient, ApiRequestError, BACKEND_UNAVAILABLE_MESSAGE } from "@/app/lib/apiClient";
import type { Group, NumbersAtRiskRow, ReconstructionResult, YAxisScale } from "./types";

interface ReconstructRequestGroup {
  name: string;
  points: { time: number; survival: number }[];
  nrisk_times?: number[];
  nrisk_values?: number[];
  total_n?: number;
}

interface ReconstructResponseRaw {
  status: "success" | "error";
  message?: string;
  method?: string;
  groups: {
    name: string;
    status: "success" | "error";
    message?: string;
    mode?: "reconstructed" | "curve_only";
    ipd?: { id: number; time: number; event: number }[];
    km_summary?: ReconstructionResult["groups"][number]["km_summary"];
    warnings?: string[];
  }[];
  validation_plot_base64?: string;
}

export function buildReconstructionPayload(groups: Group[], nrisk: NumbersAtRiskRow[], scale: YAxisScale) {
  const reqGroups: ReconstructRequestGroup[] = groups.map((g) => {
    const times = nrisk.map((r) => r.time);
    const values = nrisk.map((r) => r.valuesByGroupId[g.id]).filter((v): v is number => v !== null && v !== undefined);
    const hasFullNrisk = values.length === nrisk.length && nrisk.length >= 2;
    const base: ReconstructRequestGroup = {
      name: g.name,
      points: g.points.map((p) => ({ time: p.time, survival: p.survival })),
    };
    if (hasFullNrisk) {
      base.nrisk_times = times;
      base.nrisk_values = values;
      base.total_n = values[0];
    }
    return base;
  });
  return { groups: reqGroups, scale };
}

export async function reconstructSurvivalData(
  groups: Group[],
  nrisk: NumbersAtRiskRow[],
  scale: YAxisScale
): Promise<ReconstructionResult> {
  const payload = buildReconstructionPayload(groups, nrisk, scale);
  try {
    const raw = await apiClient.kmDigitizer.post<ReconstructResponseRaw>("/reconstruct", payload, { timeoutMs: 60000 });
    if (raw.status === "error") {
      return { status: "error", message: raw.message || "Reconstruction failed.", groups: [], reconstructedAt: new Date().toISOString() };
    }
    return {
      status: "success",
      method: raw.method,
      groups: raw.groups.map((g) => ({
        name: g.name,
        status: g.status,
        message: g.message,
        mode: g.mode,
        ipd: g.ipd,
        km_summary: g.km_summary ?? null,
        warnings: g.warnings ?? [],
      })),
      validationPlotBase64: raw.validation_plot_base64,
      reconstructedAt: new Date().toISOString(),
    };
  } catch (err) {
    const message = err instanceof ApiRequestError ? err.message : BACKEND_UNAVAILABLE_MESSAGE;
    return { status: "error", message, groups: [], reconstructedAt: new Date().toISOString() };
  }
}
