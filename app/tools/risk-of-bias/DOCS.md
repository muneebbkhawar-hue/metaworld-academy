# Risk of Bias plots — developer notes

This documents the visualization layer only (`rob-api.R` + `PlotPanel.tsx`).
It does not cover AI evidence extraction or the decision engine — see
`app/api/rob/assess/route.ts` and `app/lib/rob/*.ts` for those, which this
work did not modify.

## Packages

- **robvis 0.3.1** — the authoritative plotting engine. `rob_traffic_light()`
  and `rob_summary()` are called directly; nothing about their internal
  logic is reimplemented.
- `ggplot2`, `base64enc`, `svglite` (vector SVG output), `plumber`,
  `jsonlite`.

## Input structure `rob-api.R` expects

`POST /api/rob/{traffic-light-plot,summary-plot}`

```json
{
  "framework": "RoB2" | "ROBINS-I" | "QUADAS-2",
  "studies": [
    { "study_id": "...", "domains": { "D1": "...", "D2": "...", ... }, "domains_overall": "..." }
  ],
  "mode": "domains" | "applicability"   // QUADAS-2 only; "applicability" is always rejected (see below)
}
```

Judgement values must be the framework's exact official vocabulary
(enforced by `validate_studies()` in `rob-api.R`):

| Framework  | Values |
|---|---|
| RoB2       | `Low risk of bias`, `Some concerns`, `High risk of bias` |
| ROBINS-I   | `Low`, `Moderate`, `Serious`, `Critical`, `No information` |
| QUADAS-2   | `Low`, `High`, `Unclear` |

Any other value, a missing domain, or a duplicate `study_id` returns
`{"status":"error","message":"..."}` — the plot is never generated from
unvalidated or coerced data.

## Response

`{"status":"success","files":{"png":"data:...","jpg":"data:...","pdf":"data:...","svg":"data:..."},"n_studies":N}`

Only formats that actually rendered are included — the frontend only shows
a download button for formats present in the response.

## Known robvis 0.3.1 limitations (verified by direct source inspection and by rendering + visually inspecting output — not assumed)

1. **`quiet = TRUE` discards the plot.** `rob_traffic_light()`/`rob_summary()`
   only `return()` their plot when `quiet != TRUE`; with `quiet = TRUE` the
   function computes the plot correctly but returns `NULL`, and `ggsave()`
   silently renders a blank image from that `NULL`. Fixed by calling with
   `quiet = FALSE` inside a null `pdf(file = NULL)` device (see
   `generate_robvis_plot()`) so the incidental `print()` side effect has
   somewhere harmless to go.
2. **QUADAS-2 legend mislabeling.** Both functions hardcode RoB 2's
   `"Some concerns"` wording for QUADAS-2's middle category instead of the
   official `"Unclear"`. Fixed post-hoc by replacing the plot's colour/
   shape/fill scale after robvis builds it (`fix_quadas2_labels()`) — this
   only changes the legend text, not any computed data or colour bucket.
3. **No QUADAS-2 applicability template.** Both functions hard-require the
   standard `Study + D1..D4 + Overall` (6-column) QUADAS-2 shape.
   Applicability has only 3 domains and no official "overall applicability"
   judgement, so there is no way to satisfy that shape without fabricating
   data — not permitted. `mode: "applicability"` requests are explicitly
   rejected with a clear message; applicability concerns remain visible in
   `ResultsTable.tsx`'s second table only.
4. **Study-label clipping.** robvis's fixed strip-label theme clips long
   (and, at small figure heights, even short) study names. Two mitigations,
   both empirically verified by rendering and visually inspecting output:
   - `traffic_light_dims()` allocates noticeably more height per study than
     a naive per-row estimate, scaled further by the longest label's length.
   - `truncate_study_name()` shortens any study ID over 20 characters (for
     the PLOT LABEL only — the full ID is untouched everywhere else) with
     a trailing "…", and disambiguates any resulting collisions with a
     numeric suffix. `truncated_labels: true` in the traffic-light response
     tells the frontend to note this under the image.
   - Wrapping long names onto multiple lines was tried first and rejected —
     it was verified, by rendering, to clip unpredictably regardless of
     width/height/margin/font-size adjustments.

## Weighting

No study ever carries a real meta-analytic weight in this tool (it is a
risk-of-bias assessment, not an effect-size synthesis). `rob_summary()` is
always called with `weighted = FALSE`; the `Weight` column in the data
frame sent to robvis exists only because the package's input contract
requires the column's presence, not because a weight was computed.
