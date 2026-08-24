/** Sanitizes an outcome name for safe use in a downloaded filename (e.g. "Mortality (30-day)" -> "Mortality_30-day"). */
export function sanitizeFilenamePart(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "outcome";
}
