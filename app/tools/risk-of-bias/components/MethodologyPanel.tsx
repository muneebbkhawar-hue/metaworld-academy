// Methodology & sources panel - brief §32/§33: state which version/variant
// of each framework this tool follows, link to the official guidance so
// researchers can verify independently, and never claim unverified
// "Cochrane compliance." Also carries the data-retention statement (§29).
export default function MethodologyPanel() {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-5 text-sm">
      <div>
        <h3 className="text-[var(--text-primary)] font-semibold mb-1">Methodology &amp; sources</h3>
        <p className="text-[var(--text-secondary)] leading-relaxed">
          This tool implements the domain structure, signalling questions, and judgment terminology of three published
          risk-of-bias frameworks. It is <strong className="text-[var(--text-primary)]">not</strong> a certified or
          officially endorsed implementation of any of them - always verify a judgment that matters for publication
          against the primary source below.
        </p>
      </div>
      <ul className="space-y-2 text-[var(--text-secondary)]">
        <li>
          <span className="text-[var(--text-primary)] font-medium">RoB 2</span> — Sterne JAC, Savović J, Page MJ, et al.
          RoB 2: a revised tool for assessing risk of bias in randomised trials. <em>BMJ</em> 2019;366:l4898. Effect-of-
          assignment-to-intervention estimand.{" "}
          <a href="https://www.riskofbias.info/welcome/rob-2-0-tool" target="_blank" rel="noreferrer" className="text-[var(--purple-bright)] hover:underline">
            Official guidance ↗
          </a>
        </li>
        <li>
          <span className="text-[var(--text-primary)] font-medium">ROBINS-I</span> — Sterne JAC, Hernán MA, Reeves BC, et
          al. ROBINS-I: a tool for assessing risk of bias in non-randomised studies of interventions. <em>BMJ</em>{" "}
          2016;355:i4919.{" "}
          <a href="https://www.riskofbias.info/welcome/robins-i-tool" target="_blank" rel="noreferrer" className="text-[var(--purple-bright)] hover:underline">
            Official guidance ↗
          </a>
        </li>
        <li>
          <span className="text-[var(--text-primary)] font-medium">QUADAS-2</span> — Whiting PF, Rutjes AWS, Westwood
          ME, et al. QUADAS-2: A Revised Tool for the Quality Assessment of Diagnostic Accuracy Studies.{" "}
          <em>Ann Intern Med</em> 2011;155:529-536.{" "}
          <a href="https://www.bristol.ac.uk/population-health-sciences/projects/quadas/quadas-2/" target="_blank" rel="noreferrer" className="text-[var(--purple-bright)] hover:underline">
            Official guidance ↗
          </a>
        </li>
      </ul>
      <div className="pt-4 border-t border-[var(--border-subtle)] space-y-2 text-[var(--text-tertiary)]">
        <p>
          <span className="text-[var(--text-secondary)] font-medium">What we retain:</span> uploaded PDFs are processed
          in memory for the duration of your request and are not stored on our servers.
        </p>
        <p>
          <span className="text-[var(--text-secondary)] font-medium">AI-assisted, not automated:</span> Gemini extracts
          evidence and answers signalling questions; every domain and overall judgment shown is computed deterministically
          from those answers by this tool&apos;s own decision logic, not generated freely by the AI. This is an AI-assisted
          evidence-extraction and decision-support system, not a replacement for a trained risk-of-bias reviewer &mdash;
          the researcher remains responsible for the final judgment.
        </p>
      </div>
    </div>
  );
}
