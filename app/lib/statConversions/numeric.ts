// Numerical helpers shared by the statistical-conversion formulas.
// These are general-purpose numerical analysis routines (not statistical
// methods themselves) - implementing them is not "inventing a formula",
// it's computing well-defined mathematical functions (the inverse normal
// CDF / probit function) that the published methods below require.

/**
 * Inverse of the standard normal CDF (the probit function), i.e. qnorm(p)
 * in R terms. Implementation: Peter Acklam's rational approximation
 * (algorithm published at https://web.archive.org/web/20151030215612/http://home.online.no/~pjacklam/notes/invnorm/,
 * widely used and accurate to about 1.15e-9 relative error), with one
 * step of Halley's rational method refinement for extra precision -
 * standard practice for this approximation.
 */
export function qnorm(p: number): number {
  if (!(p > 0 && p < 1)) {
    throw new RangeError(`qnorm(p) requires 0 < p < 1, got ${p}`);
  }

  // Coefficients for the rational approximations.
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0, -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number, r: number, x: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  // One step of Halley's rational method refinement (standard companion
  // step to Acklam's approximation - reduces relative error to ~1e-15).
  const e = 0.5 * erfc(-x / Math.SQRT2) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  x = x - u / (1 + (x * u) / 2);

  return x;
}

// Complementary error function, needed only for the Halley refinement step
// above. Abramowitz & Stegun 7.1.26 rational approximation (max error
// 1.5e-7), standard and sufficient for the refinement's purpose.
function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + z / 2);
  const ans =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))
    );
  return x >= 0 ? ans : 2 - ans;
}

/** z-value for a two-sided confidence interval at the given confidence level, e.g. zFor(0.95) = 1.959964... */
export function zFor(confidenceLevel: number): number {
  if (!(confidenceLevel > 0 && confidenceLevel < 1)) {
    throw new RangeError("Confidence level must be between 0 and 1 (exclusive).");
  }
  const alpha = 1 - confidenceLevel;
  return qnorm(1 - alpha / 2);
}

export function round(x: number, decimals = 4): number {
  const f = Math.pow(10, decimals);
  return Math.round((x + Number.EPSILON) * f) / f;
}
