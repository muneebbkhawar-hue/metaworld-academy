// Missing-data detection, shared by every multi-outcome tool. Deliberately
// conservative: only recognizes explicit missing-data tokens as missing,
// and NEVER treats a genuine zero as missing - a study with 0 events (or a
// mean/SD of 0) is a legitimate, real result and must not be discarded.
const MISSING_TOKENS = new Set([
  "", "na", "n/a", "nr", "n.r.", "not available", "not reported", "not given",
  "missing", "-", "--", "—", "–", "unk", "unknown", "n.a.", "tbd",
]);

export function isMissingToken(raw: unknown): boolean {
  if (raw === null || raw === undefined) return true;
  const s = String(raw).trim().toLowerCase();
  return MISSING_TOKENS.has(s);
}

export interface FieldParseResult {
  value: number | null;
  missing: boolean;
  /** Only set when the cell was present and non-blank but not a valid number (e.g. stray text) - distinct from a genuinely missing/NR cell. */
  invalid: boolean;
}

/** Parses one extraction-sheet cell into a required numeric field. Zero is always a valid value - only explicit missing-data tokens (NA/NR/blank/etc.) or genuinely non-numeric text are flagged. */
export function parseRequiredNumericField(raw: unknown): FieldParseResult {
  if (isMissingToken(raw)) return { value: null, missing: true, invalid: false };
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (Number.isNaN(n)) return { value: null, missing: false, invalid: true };
  return { value: n, missing: false, invalid: false };
}
