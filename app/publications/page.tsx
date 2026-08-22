"use client";

import { useState } from 'react';
import Link from 'next/link';

export default function Publications() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filter, setFilter] = useState('All');

  const toggleAbstract = (id: number) => {
    if (expandedId === id) setExpandedId(null);
    else setExpandedId(id);
  };

  const publications = [
    {
      id: 1,
      type: "Meta-Analysis",
      category: "CARDIOLOGY",
      year: "2026",
      pmid: "42591852",
      link: "https://pubmed.ncbi.nlm.nih.gov/42591852/",
      title: "Bioresorbable-polymer sirolimus-eluting stents versus durable-polymer everolimus-eluting stents in percutaneous coronary intervention: A systematic review and meta-analysis of randomized controlled trials with GRADE assessment",
      summary: "Evaluates 19 RCTs involving 18,501 patients comparing BP-SES versus DP-EES.",
      authors: "Deepanshu Agrawat, Aarushi Gupta, Munir Rajpura, Sanaa Sadikhussain Diwan, Mokshit Mehul Shah, Asma Mukhtar, Umais Naveed Warraich, Areesha Talib Lashari, Muhammad Usama Tariq, Dania Khan, Mirza Muhammad Hadeed Khawar, Muneeb Khawar",
      abstract: "Background: Ultrathin bioresorbable-polymer sirolimus-eluting stents (BP-SES), including bioresorbable scaffolds (BRS), were developed to mitigate adverse events associated with durable-polymer everolimus-eluting stents (DP-EES). This study aims to compare the efficacy and safety of BP-SES versus DP-EES in patients undergoing percutaneous coronary intervention for de novo coronary artery lesions. Methods: We searched PubMed, Embase, ScienceDirect and ClinicalTrials.gov from inception to May 2026 for randomised controlled trials (RCTs) comparing BP-SES or BRS with DP-EES. Random-effects models were used to pool risk ratios (RRs) or mean differences with 95% confidence intervals (CIs). Results: Nineteen RCTs involving 18,501 patients were included. No significant differences were observed between BP-SES and DP-EES for target lesion failure (RR 1.15, 95% CI 0.74-1.79; I2 = 94%), target vessel failure (RR 0.93, 95% CI 0.84-1.03; I2 = 10%), cardiac death (RR 0.96, 95% CI 0.78-1.18), target vessel myocardial infarction (RR 0.89, 95% CI 0.77-1.03), clinically indicated target lesion revascularisation (RR 0.99, 95% CI 0.80-1.22). Binary restenosis was significantly higher in the BP-SES arm overall (RR 2.46, 95% CI 1.41-4.29; p = 0.001). Conclusions: Metallic BP-SES and DP-EES showed similar rates for most clinical endpoints. However, extreme heterogeneity and accrual of only 5.7% of the required information size render the evidence for target lesion failure inconclusive. Higher binary restenosis increased target lesion revascularisation with fully BRS indicate that these platforms are not interchangeable with contemporary metallic stents. Further large, long-term trials are required."
    },
    {
      id: 2,
      type: "Meta-Analysis",
      category: "CARDIOLOGY",
      year: "2026",
      pmid: "42502145",
      link: "https://pubmed.ncbi.nlm.nih.gov/42502145/",
      title: "Long-term valve durability and clinical outcomes after transcatheter versus surgical aortic valve replacement in low-risk patients: a systematic review and meta-analysis of randomized trials",
      summary: "Evaluates long-term data from 3,014 patients across 4 trials comparing TAVR versus SAVR.",
      authors: "Lakshiya Ramamoorthy, Faris Otmani, Aarushi Gupta, Lilly Rebecca George, Purvi Kaur Khanuja, Hauwa Sani Galadima, Deng Siang Lee, Serene Skef, Basel Al Khatib, Mahathi Reddy B, Eleonora Vapheas, Muneeb Khawar, Mirza Muhammad Hadeed Khawar",
      abstract: "Transcatheter aortic valve replacement (TAVR) has extended its use to low-surgical-risk populations, yet long-term comparative data against surgical aortic valve replacement (SAVR) are still limited, particularly concerning durability and the need for reintervention. We conducted a search of PubMed/MEDLINE, Embase, CENTRAL, and ClinicalTrials.gov through March 2026 for randomized trials comparing TAVR with SAVR in patients with low surgical risk and severe aortic stenosis, specifically those with at least three years of follow-up. Outcomes were pooled as risk ratios (RR) using Mantel-Haenszel random-effects models, and durability and mortality outcomes were analyzed as time-to-event hazard ratios (HR) to accommodate different follow-up durations. Prespecified subgroup analyses by valve platform were performed. Four trials involving 3,014 patients (follow-up ranging from 3 to 10 years) were included. Cardiovascular mortality (HR 1.11, 95% CI 0.86-1.42; P = 0.43) and all-cause stroke (HR 1.09, 95% CI 0.73-1.64; P = 0.67) did not differ significantly between TAVR and SAVR. Aortic valve reintervention was higher with TAVR in risk-ratio analysis (RR 1.58, 95% CI 1.16-2.16) but did not reach statistical significance in the prespecified time-to-event analysis (HR 1.29, 95% CI 0.81-2.05). The excess reintervention risk was confined to the self-expanding valve platform. Permanent pacemaker implantation was significantly more frequent after TAVR (RR 2.08, 95% CI 1.48-2.93; P < 0.0001), with a significant interaction by valve platform (self-expanding RR 2.57 vs balloon-expandable RR 1.40; P = 0.02 for interaction). Bioprosthetic valve failure showed a nonsignificant trend favoring TAVR (HR 0.80, 95% CI 0.54-1.17). The only available 10-year randomized data (NOTION trial) showed significantly less severe structural valve deterioration with TAVR than with SAVR. The results suggest that TAVR and SAVR are equivalent in terms of cardiovascular mortality and stroke outcomes. However, pacemaker implantation rates were higher with TAVR and were strongly dependent on the valve platform used. The observed excess in reinterventions was confined to self-expanding valves and did not show robust support in the time-to-event analysis. The unique 10-year data from the self-expanding platform indicate less severe structural valve deterioration compared to SAVR, suggesting that durability should not be generalized across different device families. These findings advocate for individualized, platform-aware decision-making in clinical practice."
    },
    {
      id: 3,
      type: "Meta-Analysis",
      category: "CARDIOLOGY",
      year: "2026",
      pmid: "42449086",
      link: "https://pubmed.ncbi.nlm.nih.gov/42449086/",
      title: "Distal versus proximal transradial access and radial artery occlusion: a meta-analysis and trial sequential analysis",
      summary: "Analysis of 20 randomized trials (8,718 patients) comparing DRA versus TRA.",
      authors: "Sarjana Singh, Kunal Gahlot, Olivia Benny, Karan Garg, Santiago Nieto Cuervo, Lakshitha Haymanth Kumar Sangeetha, Dua Rizwan Qureshi, Safaa Abdelsalam, Asim Eisa, Rose-Anne Ayisa, Shaheen Sharfudeen, Joshua Zumba, Muneeb Khawar",
      abstract: "Distal radial access (DRA) has been proposed as a physiologically superior alternative to conventional proximal transradial access (TRA) for coronary angiography and percutaneous coronary intervention, with the potential to preserve radial artery patency. This systematic review and meta-analysis evaluated the comparative safety and efficacy of DRA versus TRA. PubMed/MEDLINE, Embase, Cochrane CENTRAL, and Web of Science were searched from inception to January 2026. Randomized controlled trials comparing DRA (anatomical snuffbox or dorsal distal radial puncture) with proximal TRA in adults undergoing diagnostic or interventional cardiac catheterization were included. Two reviewers independently performed study selection, data extraction, and risk-of-bias assessment using the Cochrane RoB 2 tool. Random-effects meta-analysis using the restricted maximum likelihood (REML) estimator with Knapp-Hartung adjustment was performed to pool odds ratios (ORs) and mean differences (MDs) with 95% confidence intervals (CIs) and 95% prediction intervals. Pre-specified subgroup analyses, meta-regression, trial sequential analysis (TSA), and GRADE certainty assessment were conducted. Twenty randomized trials enrolling 8,718 patients (3,966 randomized to DRA and 4,752 to TRA) were included. DRA significantly reduced radial artery occlusion (RAO) compared with TRA (OR 0.26, 95% CI 0.18-0.36; prediction interval 0.12-0.56; I² = 21.3%; NNT = 27). DRA also significantly reduced bleeding (OR 0.53, 95% CI 0.35-0.80; prediction interval 0.12-2.26; I² = 67.9%) and hematoma formation (OR 0.42, 95% CI 0.30-0.58). Access-site crossover was significantly higher with DRA (OR 2.28, 95% CI 1.27-4.08), and procedural success was lower (OR 0.53). There were no statistically significant differences between DRA and TRA in time to hemostasis, access time, total procedural time, fluoroscopy time, radial artery spasm, or number of puncture attempts. Subgroup analyses demonstrated consistent benefit of DRA on RAO across clinical settings, imaging guidance, sheath sizes, trial sizes, and follow-up durations. Trial sequential analysis confirmed that the evidence for RAO reduction is conclusive, while the evidence for bleeding has approached the required information size. In this updated meta-analysis of 20 randomized trials, distal radial access significantly reduced radial artery occlusion and bleeding compared with conventional proximal transradial access. These benefits were achieved at the cost of greater technical demand, as evidenced by higher crossover rates and lower procedural success with DRA. Distal radial access should be preferred when preservation of the radial artery is a clinical priority."
    },
    {
      id: 4,
      type: "Meta-Analysis",
      category: "CARDIOLOGY",
      year: "2026",
      pmid: "42437194",
      link: "https://pubmed.ncbi.nlm.nih.gov/42437194/",
      title: "Angiography-derived physiology versus pressure wire-based fractional flow reserve for coronary revascularization guidance: A systematic review and meta-analysis",
      summary: "Compares wire-free ADP platforms against FFR across 6,165 patients.",
      authors: "Mokshit Mehul Shah, Sarosh Fatima, Mariam Khachatryan, Igwilo Chukwudumebi Angela, Umair Arshad, Jahnoy St Jacques, Naima Agha, Hamza Hashmi, Bigenimana Adimirabilis Malombe, Zeeshan Ayaz, Mirza Muhammad Hadeed Khawar, Muneeb Khawar",
      abstract: "Background: Pressure-wire-based fractional flow reserve (FFR) is the gold standard for physiological assessment of intermediate coronary stenoses but remains underutilized owing to procedural complexity, cost, and the need for hyperemic agents. Angiography-derived physiology (ADP) platforms offer a wire-free, adenosine-free alternative. This systematic review and meta-analysis compared the clinical outcomes of ADP-guided versus FFR-guided revascularization in patients with coronary artery disease. Methods: Comprehensive searches were performed in PubMed, Embase, ScienceDirect, and Cochrane CENTRAL from inception to April 2026. Dichotomous outcomes were pooled as risk ratios (RRs) with 95% confidence intervals using random-effects models and robustness was checked with trial sequential analysis (TSA). Results: Three multicenter randomized controlled trials involving 6165 patients were included. There was no significant difference in the primary composite endpoint (RR: 1.14, 95% CI: 0.85-1.54; p = 0.37; I 2 = 57%), all-cause mortality (RR: 1.08, 95% CI: 0.75-1.56; p = .68), cardiac death (RR: 0.89, 95% CI: 0.53-1.49; p = .66), and any myocardial infarction (RR: 1.14, 95% CI: 0.66-1.98; p = .64) between ADP-guided and pressure-wire-based FFR-guided strategies. Clinically indicated revascularization was significantly higher with ADP (RR: 1.12, 95% CI: 1.05-1.20; p = .005; I 2 = 0%). Trial sequential analysis confirmed that the accumulated evidence was sufficient to conclude no clinically meaningful difference in composite outcome. Conclusion: ADP-guided revascularization achieves broadly comparable clinical outcomes to pressure-wire-based FFR. Although ADP offers procedural advantages, certain platforms were associated with modestly higher revascularization rates. These findings support ADP as a practical alternative to conventional FFR in selected patients."
    },
    {
      id: 5,
      type: "Network Meta-Analysis",
      category: "CARDIOLOGY",
      year: "2026",
      pmid: "42249500",
      link: "https://pubmed.ncbi.nlm.nih.gov/42249500/",
      title: "Comparative efficacy and safety of transcatheter edge-to-edge repair versus tricuspid valve replacement versus optimal medical therapy in moderate-to-severe tricuspid regurgitation: a network meta-analysis of randomized controlled trials",
      summary: "Network meta-analysis of 1,050 patients evaluating TEER and TTVR versus OMT.",
      authors: "Ihsan Noushad Karuppan Veettil, Anuhya Jamandlamudi, Nebeela Abdul Khader, Tea Shehu, Doris Lacej, Shivangi Jha, Obawole Mayowa, Joshua Zumba, Temirlan Ismailov, Zhanel Almaganbetova, Bertha Gabriela, Lina Hajjar, Sifat Ullah Safi, Muneeb Khawar",
      abstract: "Background: Severe tricuspid regurgitation (TR) is associated with substantial morbidity and increased mortality. Transcatheter edge-to-edge repair (TEER) and transcatheter tricuspid valve replacement (TTVR) have emerged as less-invasive options for patients remaining symptomatic despite optimal medical therapy (OMT). We conducted a network meta-analysis of randomized controlled trials (RCTs) to evaluate the efficacy and safety of TEER and TTVR versus OMT. Methods: Three RCTs were included after systematic search of PubMed, Embase, and ScienceDirect (inception to December 2025). A frequentist network meta-analysis (random-effects) was performed in R. A Bayesian NMA with vague priors was conducted in parallel to obtain posterior rank probabilities and SUCRA values. Relative effects were translated into absolute risk differences and number-needed-to-treat (NNT) / number-needed-to-harm (NNH) using pooled OMT baseline event rates, with 95% CIs via parametric bootstrap. Results: The network comprised 1,050 patients (star-shaped, OMT common comparator; no direct TEER-TTVR comparison). Neither TEER (RR 0.99, 95% CI 0.56-1.76) nor TTVR (RR 0.85, 95% CI 0.51-1.41) significantly reduced all-cause mortality. Both interventions improved NYHA class ≥ 1 class (TEER RR 1.46, 95% CI 1.30-1.64, NNT 8; TTVR RR 3.28, 95% CI 2.41-4.47, NNT 2), KCCQ-OS (TEER MD + 11.00, 95% CI 7.46-14.54; TTVR MD + 17.80, 95% CI 12.78-22.82; both exceeding the 5-point MCID with ≥ 95% confidence), and 6MWD (TEER MD + 17.53 m; TTVR MD + 30.90 m; neither clearly exceeding the 30-m MCID). Both increased major bleeding (TEER NNH 29; TTVR NNH 21) and new pacemaker implantation (TEER NNH 91; TTVR NNH 10). Bayesian posterior probability that TTVR was best was 100% for NYHA improvement, 99% for KCCQ-OS, and 82% for 6MWD, but only 1% for avoidance of pacemaker implantation. Conclusion: In patients with symptomatic moderate-to-severe TR, both TEER and TTVR plus OMT provide consistent and clinically meaningful improvements in functional status and quality of life. Longer-term trials with direct head-to-head comparisons are warranted."
    },
    {
      id: 6,
      type: "Meta-Analysis",
      category: "CARDIOLOGY",
      year: "2025",
      pmid: "42152843",
      link: "https://pubmed.ncbi.nlm.nih.gov/42152843/",
      title: "Outcomes of transcatheter vs. surgical aortic valve replacement in bicuspid aortic valve stenosis: A systematic review and meta-analysis",
      summary: "Pooled data from 148,771 patients comparing TAVR versus SAVR in severe bicuspid aortic valve stenosis.",
      authors: "Ashesh Das, Aarushi Gupta, Lakshiya Ramamoorthy, Neo Zhong Yi Benjamin, Deepanshu Agrawat, Moitreyo Pandit, M Muneeb Khawar, Chika Chilaka, Delphine Nyirahabimana, Biruk Goraga, Muhammad Abdur Rehman, Meenakshi Reddy Yathindra, Muneeb Khawar",
      abstract: "This meta-analysis compared peri-procedural and short-term outcomes of transcatheter aortic valve replacement (TAVR) versus surgical aortic valve replacement (SAVR) in severe bicuspid aortic valve (BAV) stenosis, addressing TAVR's debated efficacy in this context. A systematic search of PubMed, ScienceDirect, and Embase up to January 2025. Pooled odds ratios (ORs) with 95% confidence intervals (CIs) were calculated using a random-effects model. Heterogeneity was assessed with the I2 statistic, with p < 0.05 as significant. 9 observational studies and 1 randomized controlled trial with 148,771 patients (TAVR: 16,584; SAVR: 132,187) were included. TAVR showed lower odds of acute kidney injury (OR = 0.58, 95% CI: 0.35-0.97; p = 0.04), major bleeding (OR = 0.29, 95% CI: 0.12-0.69; p = 0.005), and pulmonary complications (OR = 0.44, 95% CI: 0.34-0.57; p < 0.00001) versus SAVR. However, TAVR increased risks of paravalvular leak (OR = 2.15, 95% CI: 1.20-3.88; p = 0.01) and permanent pacemaker implantation (OR = 2.08, 95% CI: 1.39-3.10; p = 0.0004). No significant differences were noted in in-hospital mortality (OR = 1.04, 95% CI: 0.56-1.94; p = 0.89), stroke (OR = 1.05, 95% CI: 0.86-1.28; p = 0.65), or vascular complications (OR = 0.67, 95% CI: 0.18-2.52; p = 0.55). TAVR reduces risks of acute kidney injury, major bleeding, and pulmonary complications in BAV stenosis but raises paravalvular leak and pacemaker implantation risks compared to SAVR. Mortality and stroke rates are similar. TAVR may suit selected patients, but long-term data is needed."
    }
  ];

  const filteredPubs = filter === 'All' ? publications : publications.filter(p => p.type === filter);

  return (
    <div className="min-h-screen bg-[#0b0c10] text-slate-200 font-sans pb-24">
      {/* Navbar */}
      <nav className="border-b border-indigo-900/30 bg-[#0f111a]/90 backdrop-blur px-8 py-4 flex justify-between items-center sticky top-0 z-50">
        <div>
          <Link href="/" className="text-xl font-bold text-white tracking-wide hover:opacity-80 transition">
            MetaWorld <span className="text-indigo-400 font-normal">Research Academy</span>
          </Link>
        </div>
        <div className="flex gap-6 text-sm font-medium">
          <Link href="/" className="hover:text-indigo-400 transition text-slate-400">Home</Link>
          <Link href="/tools" className="hover:text-indigo-400 transition text-slate-400">Tools</Link>
          <Link href="/mentorship" className="hover:text-indigo-400 transition text-slate-400">Mentorship</Link>
          <Link href="/publications" className="text-indigo-400 transition">Publications</Link>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <p className="text-indigo-400 text-sm font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
            ✦ Mentee Publications
          </p>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-tight tracking-tight mb-6">
            Six peer-reviewed papers.<br />
            <span className="text-indigo-900/60 mix-blend-lighten text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600">One mission:</span> independent research.
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mb-8">
            A growing gallery of peer-reviewed systematic reviews, meta-analyses, and methodological papers co-developed inside the academy.
          </p>
          
          <div className="flex gap-6 text-sm text-slate-300 font-medium">
            <span><strong className="text-white">6</strong> Publications</span>
            <span>•</span>
            <span><strong className="text-white">1</strong> Specialty</span>
            <span>•</span>
            <span>Mentees Across <strong className="text-white">4</strong> Continents</span>
          </div>
        </div>

        {/* Filters (Cohort Study removed) */}
        <div className="flex gap-3 mb-10 overflow-x-auto pb-2">
          {['All', 'Meta-Analysis', 'Network Meta-Analysis'].map(type => (
            <button 
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                filter === type 
                ? 'bg-indigo-900/50 text-indigo-200 border-indigo-500/50' 
                : 'bg-transparent text-slate-400 border-slate-800 hover:border-slate-600 hover:text-slate-200'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Grid Layout */}
        <div className="grid md:grid-cols-2 gap-6">
          {filteredPubs.map(pub => (
            <div key={pub.id} className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 flex flex-col hover:border-indigo-500/30 transition-all duration-300">
              
              {/* Card Header */}
              <div className="flex justify-between items-start mb-6">
                <div className="w-10 h-10 rounded-full bg-indigo-900/30 flex items-center justify-center text-indigo-400 border border-indigo-800/30">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                </div>
                <span className="bg-indigo-900/40 text-indigo-300 text-xs px-3 py-1 rounded-full font-semibold tracking-wide border border-indigo-700/50 uppercase">
                  {pub.type}
                </span>
              </div>

              {/* Meta info */}
              <div className="text-xs text-slate-500 font-semibold tracking-widest uppercase mb-3 flex gap-3">
                <span>{pub.category}</span>
                <span>•</span>
                <span>{pub.year}</span>
                <span>•</span>
                <span>PMID {pub.pmid}</span>
              </div>

              {/* Title & Summary */}
              <h2 className="text-xl font-bold text-white mb-3 leading-snug">
                {pub.title}
              </h2>
              <p className="text-slate-400 text-sm mb-6 flex-grow">
                {pub.summary}
              </p>

              {/* Authors */}
              <div className="text-sm text-slate-500 mb-6 border-t border-slate-800/80 pt-4">
                Authors: <span className="text-slate-300">{pub.authors}</span>
              </div>

              {/* Full Abstract Dropdown */}
              {expandedId === pub.id && (
                <div className="mb-6 p-4 bg-[#0b0c10] border border-slate-800 rounded-lg text-sm text-slate-300 leading-relaxed max-h-96 overflow-y-auto">
                  <strong className="text-white block mb-2">Abstract:</strong>
                  {pub.abstract}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between items-center mt-auto">
                <button 
                  onClick={() => toggleAbstract(pub.id)}
                  className="text-indigo-400 hover:text-indigo-300 font-medium text-sm transition-colors flex items-center gap-1"
                >
                  {expandedId === pub.id ? 'Hide abstract ↑' : 'Read abstract ↓'}
                </button>
                <a 
                  href={pub.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-white hover:text-indigo-300 font-medium text-sm transition-colors flex items-center gap-1"
                >
                  View on PubMed ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}