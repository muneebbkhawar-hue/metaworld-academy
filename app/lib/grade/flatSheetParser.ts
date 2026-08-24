// Parses GRADE's flat, one-row-per-outcome summary sheet (NOT the wide
// per-study extraction format used by Forest/Funnel/Sensitivity/TSA - see
// types.ts for why GRADE's input contract is intentionally different).
//
// Expected columns (header row, order-independent - matched by name):
//   Outcome | Effect (95% CI) | Study Design | k (Studies) | n (Participants) |
//   I2 (%) | Risk of Bias | Publication Bias | Indirectness Override (optional)
//
// Reuses the same missing-token vocabulary (NA/NR/blank/etc., zero always
// valid) as the wide-format parser via missingData.ts, so "missing data"
// means the same thing across every multi-outcome tool in this app.
import { isMissingToken, parseRequiredNumericField } from "../multiOutcome/missingData.ts";
import {
  type GradeOutcomeInput,
  type GradeParseResult,
  type IndirectnessOverride,
  type PublicationBiasRating,
  type RiskOfBiasRating,
  type StudyDesign,
  PUBLICATION_BIAS_OPTIONS,
  RISK_OF_BIAS_OPTIONS,
} from "./types.ts";

const HEADER_ALIASES: Record<string, string> = {
  outcome: "outcome",
  "outcome name": "outcome",
  effect: "effect",
  "effect (95% ci)": "effect",
  "effect estimate": "effect",
  "effect estimate (95% ci)": "effect",
  "study design": "design",
  design: "design",
  k: "k",
  "k (studies)": "k",
  "number of studies (k)": "k",
  "number of studies": "k",
  studies: "k",
  n: "n",
  "n (participants)": "n",
  "total sample size (n)": "n",
  "sample size": "n",
  participants: "n",
  i2: "i2",
  "i2 (%)": "i2",
  "i²": "i2",
  "i² (%)": "i2",
  "heterogeneity (i2 %)": "i2",
  "risk of bias": "rob",
  rob: "rob",
  "publication bias": "pubbias",
  "indirectness override": "indirectness",
  indirectness: "indirectness",
};

function normHeader(h: unknown): string {
  return String(h ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function matchEnum<T extends string>(raw: string, options: readonly T[]): T | null {
  const norm = raw.trim().toLowerCase();
  return options.find((o) => o.toLowerCase() === norm) ?? null;
}

export function parseGradeFlatSheet(rows: unknown[][]): GradeParseResult {
  if (rows.length < 2) {
    return { rows: [], excluded: [], fatalErrors: ["The sheet needs a header row and at least one data row."] };
  }
  const [headerRow, ...dataRows] = rows;
  const colIndex: Record<string, number> = {};
  (headerRow as unknown[]).forEach((h, i) => {
    const key = HEADER_ALIASES[normHeader(h)];
    if (key && !(key in colIndex)) colIndex[key] = i;
  });

  const required = ["outcome", "effect", "design", "k", "n", "i2", "rob", "pubbias"];
  const missingCols = required.filter((c) => !(c in colIndex));
  if (missingCols.length > 0) {
    return {
      rows: [],
      excluded: [],
      fatalErrors: [
        `Could not find required column(s): ${missingCols.join(", ")}. Expected headers: Outcome, Effect (95% CI), Study Design, k (Studies), n (Participants), I2 (%), Risk of Bias, Publication Bias.`,
      ],
    };
  }

  const outRows: GradeOutcomeInput[] = [];
  const excluded: GradeParseResult["excluded"] = [];

  for (const row of dataRows) {
    const cell = (key: string) => row[colIndex[key]];
    const outcomeName = String(cell("outcome") ?? "").trim();
    if (!outcomeName) continue; // fully blank trailing row - not an error

    const reasons: string[] = [];

    const effect = String(cell("effect") ?? "").trim();
    if (isMissingToken(effect) || !effect) reasons.push("effect estimate (95% CI)");

    const designRaw = String(cell("design") ?? "").trim();
    const design = matchEnum<StudyDesign>(designRaw, ["RCT", "Observational"]);
    if (!design) reasons.push(`study design (got "${designRaw || "blank"}" - expected RCT or Observational)`);

    const kField = parseRequiredNumericField(cell("k"));
    if (kField.missing || kField.invalid) reasons.push("k (number of studies)");

    const nField = parseRequiredNumericField(cell("n"));
    if (nField.missing || nField.invalid) reasons.push("n (participants)");

    const i2Field = parseRequiredNumericField(cell("i2"));
    if (i2Field.missing || i2Field.invalid) reasons.push("I2 (%)");

    const robRaw = String(cell("rob") ?? "").trim();
    const rob = matchEnum<RiskOfBiasRating>(robRaw, RISK_OF_BIAS_OPTIONS);
    if (!rob) reasons.push(`risk of bias (got "${robRaw || "blank"}" - expected Not serious / Serious / Very serious)`);

    const pubRaw = String(cell("pubbias") ?? "").trim();
    const pubBias = matchEnum<PublicationBiasRating>(pubRaw, PUBLICATION_BIAS_OPTIONS);
    if (!pubBias) reasons.push(`publication bias (got "${pubRaw || "blank"}" - expected Undetected / Suspected / Serious / Very serious)`);

    let indirectnessOverride: IndirectnessOverride = "";
    if ("indirectness" in colIndex) {
      const indRaw = String(cell("indirectness") ?? "").trim();
      if (indRaw && !isMissingToken(indRaw)) {
        const matched = matchEnum<Exclude<IndirectnessOverride, "">>(indRaw, ["Not serious", "Serious", "Very serious"]);
        indirectnessOverride = matched ?? "";
      }
    }

    if (reasons.length > 0) {
      excluded.push({ outcome: outcomeName, reason: `Missing/invalid: ${reasons.join(", ")}` });
      continue;
    }

    outRows.push({
      outcome: outcomeName,
      effect,
      design: design!,
      k: kField.value,
      n: nField.value,
      i2: i2Field.value,
      riskOfBias: rob!,
      indirectnessOverride,
      publicationBias: pubBias!,
    });
  }

  return { rows: outRows, excluded, fatalErrors: [] };
}
