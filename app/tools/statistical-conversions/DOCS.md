# Statistical Conversions — developer notes

**Purpose:** quick statistical conversions for systematic reviewers/meta-analysts, entirely client-side (`app/lib/statConversions/`). No backend, no AI, no R.

**Architecture:** calculation layer (`numeric.ts`, `conversions.ts`) is fully separated from UI (`page.tsx`, `components/`) and has its own unit tests (`conversions.test.ts`, 37 tests — run with `node --experimental-strip-types --test app/lib/statConversions/conversions.test.ts`).

## Formulas / methods

| Conversion | Method | Reference | Certainty |
|---|---|---|---|
| Median+IQR → Mean/SD | Wan et al. IQR estimator (C3) | Wan X, Wang W, Liu J, Tong T. *BMC Med Res Methodol.* 2014;14:135 | Estimated |
| Median+Range → Mean/SD | Wan et al. range estimator (C1) | same | Estimated |
| Five-number summary → Mean/SD | Wan et al. combined estimator (C2) | same | Estimated |
| Mean/SD → Median/IQR | Normal-distribution property (IQR ≈ 1.349×SD) | — (direct property, not a separate method) | Assumption-based |
| OR/RR/HR+CI → log/SE | Log-scale CI decomposition | Cochrane Handbook §6.3 | Exact |
| CI → SE, Estimate+SE → CI | Standard Wald-CI relationship | Cochrane Handbook §6.3 | Exact |
| SD+n ↔ SE | SE = SD/√n | Standard definition | Exact |

`qnorm()` (inverse normal CDF) is Acklam's rational approximation + one Halley refinement step — a numerical-analysis routine, not a separate statistical "method."

## Limitations

- Wan et al.'s estimators are most reliable for n ≥ 25 (surfaced as an in-UI warning for smaller n).
- The mean/SD → median/IQR conversion is explicitly normal-distribution-dependent and should not be trusted for visibly skewed data.

## Deployment

100% client-side; no Vercel-specific considerations.
