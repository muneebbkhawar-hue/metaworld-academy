/** TEMPORARY figure-quality/scale test for Meta-Regression. Deleted after use. */
async function postJSON(url, body) {
  const start = Date.now();
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await res.text();
  const elapsed = Date.now() - start;
  try { return { data: JSON.parse(text), elapsed }; } catch { return { data: { status: "error", message: text.slice(0, 300) }, elapsed }; }
}
const METAREG = "http://127.0.0.1:8003/api/metareg";

async function main() {
  // 30+ studies, long treatment-adjacent study names, long moderator name, categorical with many levels
  const regions = ["Northern Europe", "Southern Europe", "East Asia and Pacific", "North America", "Latin America and the Caribbean"];
  const studies = [];
  for (let i = 1; i <= 32; i++) {
    const ev_e = 5 + (i % 15); const n_e = 60 + (i % 20) * 3;
    const ev_c = 8 + (i % 18); const n_c = 62 + (i % 20) * 3;
    studies.push({
      study: `Multinational Randomized Controlled Trial of Intervention Efficacy ${i} (20${10 + (i % 15)})`,
      event_e: ev_e, n_e, event_c: ev_c, n_c,
      "Participant Age at Baseline (years)": String(30 + (i * 7) % 45),
      "Geographic Region of Trial Conduct": regions[i % regions.length],
    });
  }
  const config = { studies, outcome_type: "dichotomous", effect_measure: "OR", model: "Random-effects", tau_method: "REML", ci_level: 95, knha: true };

  const r1 = await postJSON(`${METAREG}/analyze`, { ...config, moderators: [{ name: "Participant Age at Baseline (years)", type: "continuous", reference: null }] });
  console.log(`Continuous, 32 studies, long names: status=${r1.data.status}, elapsed=${r1.elapsed}ms, figure_bytes=${r1.data.figure_base64 ? r1.data.figure_base64.length : 0}`);

  const r2 = await postJSON(`${METAREG}/analyze`, { ...config, moderators: [{ name: "Geographic Region of Trial Conduct", type: "categorical", reference: "Southern Europe" }] });
  console.log(`Categorical (5 levels), 32 studies: status=${r2.data.status}, elapsed=${r2.elapsed}ms, coefficients=${r2.data.coefficients ? r2.data.coefficients.length : 0}, figure_bytes=${r2.data.figure_base64 ? r2.data.figure_base64.length : 0}`);
  if (r2.data.coefficients) console.log(r2.data.coefficients.map(c => c.term).join(" | "));

  // 3-study minimum case (short names, sparse)
  const tiny = [
    { study: "S1", event_e: 5, n_e: 40, event_c: 10, n_c: 42, Dose: "10" },
    { study: "S2", event_e: 8, n_e: 45, event_c: 14, n_c: 48, Dose: "20" },
    { study: "S3", event_e: 6, n_e: 38, event_c: 12, n_c: 40, Dose: "30" },
  ];
  const r3 = await postJSON(`${METAREG}/analyze`, { studies: tiny, outcome_type: "dichotomous", effect_measure: "OR", model: "Random-effects", tau_method: "REML", ci_level: 95, knha: true, moderators: [{ name: "Dose", type: "continuous", reference: null }] });
  console.log(`Minimum 3 studies: status=${r3.data.status}, warnings=${JSON.stringify(r3.data.warnings)}`);
}
main().catch(err => { console.error("FATAL:", err); process.exit(1); });
