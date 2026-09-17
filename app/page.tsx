import Link from 'next/link';
import { BarChart3, BookOpen, UsersRound, BookOpenText, ArrowRight } from 'lucide-react';
import Nav from './components/Nav';
import Footer from './components/Footer';
import GradientBlob from './components/GradientBlob';
import StatCounter from './components/StatCounter';
import TrustMarquee from './components/TrustMarquee';
import FadeIn from './components/FadeIn';
import Testimonials, { type Testimonial } from './components/Testimonials';

// Real numbers only. Mentees-trained and publications-supported are
// sourced from existing site content (Mentorship page: "trained over 300
// students and junior researchers globally"; Publications page:
// "6 Publications"). The 15+ Countries figure was confirmed directly by
// the site owner. A satisfaction-rate stat was deliberately left out at
// the owner's explicit request, rather than showing a placeholder/guessed
// percentage.
const STATS = [
  { value: 15, suffix: "+", label: "Countries" },
  { value: 300, suffix: "+", label: "Mentees Trained" },
  { value: 6, suffix: "", label: "Publications Supported" },
];

const SERVICES = [
  {
    n: "01", tag: "Toolkit", icon: BarChart3, title: "Research Toolkit",
    desc: "Specialized tools covering every stage of systematic review and meta-analysis — forest plots, funnel plots, sensitivity analyses, trial sequential analysis, network meta-analysis, and meta-regression.",
    cta: "Explore Tools", href: "/tools",
  },
  {
    n: "02", tag: "Outcomes", icon: BookOpen, title: "Mentee Publications",
    desc: "Peer-reviewed papers by our mentees in international journals — proof that structured mentorship turns first-time reviewers into published authors.",
    cta: "View Publications", href: "/publications",
  },
  {
    n: "03", tag: "Program", icon: UsersRound, title: "Mentorship Program",
    desc: "End-to-end guidance from question formulation to publication. One-on-one sessions, manuscript review, and journal placement until your paper is accepted.",
    cta: "Learn About Mentorship", href: "/mentorship",
  },
  {
    n: "04", tag: "Library", icon: BookOpenText, title: "Blog & Practical Guides",
    desc: "In-depth methodological explainers written by mentors who run systematic reviews every day — PRISMA, GRADE, risk of bias, and meta-analysis in plain language.",
    cta: "Read Guides", href: "/blog",
  },
];

const PROCESS = [
  { n: "01", title: "Enroll & Define", desc: "Sharpen your research question, PICO, and eligibility criteria with a dedicated mentor." },
  { n: "02", title: "Get Mentored End-to-End", desc: "Coached screening, extraction, risk-of-bias, meta-analysis, and manuscript writing." },
  { n: "03", title: "Publish Internationally", desc: "Journal targeting, submission, and response-to-reviewers coaching until acceptance." },
];

const TESTIMONIALS: Testimonial[] = [
  { name: "Sarosh Fatima", location: "Pakistan", quote: "MetaWorld completely transformed how I approach research. I went from being totally lost to publishing in an indexed journal — all thanks to the structured mentorship and incredible tools." },
  { name: "Jungwook Heo", location: "South Korea", quote: "The systematic review toolkit saved me weeks of work. The guidance on PRISMA, risk of bias, and statistical synthesis was clearer here than anything I found in textbooks." },
  { name: "Ahmad Ali", location: "Pakistan", quote: "I had tried three times to get my meta-analysis published before joining MetaWorld. Within months of the mentorship, I had my first acceptance. Truly life-changing." },
  { name: "Sidra Khan", location: "Pakistan", quote: "Personalized feedback and step-by-step mentorship made the entire research process feel manageable. I now supervise junior researchers using what I learned here." },
  { name: "Naima Agha", location: "Pakistan", quote: "What sets MetaWorld apart is that the mentor actually reviews your work — not just sends links. That level of care is rare and invaluable for early-career researchers." },
  { name: "Samreen Sheikh", location: "Pakistan", quote: "From PICO formulation to final submission, every stage was covered. I published in a Q1 journal and I genuinely couldn't have done it without this program." },
  { name: "Lena Fischer", location: "Germany", quote: "As a non-native English speaker, I was worried about publishing internationally. MetaWorld gave me both the skills and the confidence to succeed." },
  { name: "Fatou Diallo", location: "Senegal", quote: "MetaWorld is the only place where I felt truly supported as an African researcher breaking into global academic publishing. The tools are world-class." },
  { name: "Carlos Mendez", location: "Mexico", quote: "The blog guides alone are worth it — but the mentorship takes it to another level. My supervisor was amazed at the quality of my systematic review." },
  { name: "Amira Hassan", location: "Egypt", quote: "I completed my meta-analysis in record time using the forest plot and heterogeneity tools. The academy made complex statistics feel approachable." },
];

// Abstract evidence-synthesis network motif - forest-plot / NMA-inspired
// nodes and edges, hand-authored inline SVG rather than a raster asset or
// stock imagery. Purple gradient fill (the academy's brand blend), purely
// decorative so aria-hidden. `dense` adds extra nodes/edges for a busier
// background figure - used behind the testimonials section.
function NetworkArt({ dense = false, className = "" }: { dense?: boolean; className?: string }) {
  const nodes = dense
    ? [
        { x: 60, y: 90 }, { x: 220, y: 40 }, { x: 380, y: 110 }, { x: 300, y: 220 },
        { x: 120, y: 220 }, { x: 440, y: 210 }, { x: 200, y: 150 }, { x: 20, y: 30 },
        { x: 470, y: 40 }, { x: 470, y: 150 },
      ]
    : [
        { x: 60, y: 90 }, { x: 220, y: 40 }, { x: 380, y: 110 }, { x: 300, y: 220 },
        { x: 120, y: 220 }, { x: 440, y: 210 }, { x: 200, y: 150 },
      ];
  const edges: [number, number][] = dense
    ? [[0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [2, 5], [0, 7], [1, 8], [5, 9]]
    : [[0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [2, 5]];
  const gradId = dense ? "nodeGradDense" : "nodeGrad";
  return (
    <svg viewBox="0 0 500 280" className={`w-full h-auto ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#C084FC" />
          <stop offset="100%" stopColor="#6D28D9" />
        </linearGradient>
      </defs>
      {edges.map(([a, b], i) => (
        <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke="#8B5CF6" strokeOpacity="0.35" strokeWidth="1.5" />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={i === 6 ? 14 : 8} fill={`url(#${gradId})`} fillOpacity="0.85" />
      ))}
      {!dense && (
        /* forest-plot style estimate + CI line, echoing the site's actual statistical tools */
        <g transform="translate(20, 250)">
          <line x1="0" y1="0" x2="460" y2="0" stroke="#7A6F8C" strokeOpacity="0.3" strokeWidth="1" />
          <line x1="140" y1="0" x2="320" y2="0" stroke="#A78BFA" strokeWidth="2" />
          <rect x="220" y="-6" width="12" height="12" fill="#C084FC" transform="rotate(45 226 0)" />
        </g>
      )}
    </svg>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--black)] text-white font-sans">
      <Nav />

      {/* ---- Hero ---- */}
      <section className="relative overflow-hidden section !pt-16 md:!pt-20">
        <GradientBlob className="w-[36rem] h-[36rem] -top-40 -left-40" variant="primary" />
        <GradientBlob className="w-[30rem] h-[30rem] top-20 -right-32" variant="secondary" />

        <div className="relative container-grid items-center">
          <div className="col-span-12 md:col-span-7">
            <FadeIn>
              <p className="label-text mb-8 text-[var(--accent)]">
                MetaWorld Research Academy — Est. 2024
              </p>
              <h1 className="display-heading mb-8">
                Rigorous training.
                <br />
                <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
                  Real publications.
                </span>
                <br />
                Independent researchers.
              </h1>
              <p className="body-copy mb-10">
                We mentor systematic reviewers and meta-analysts from a vague question to a peer-reviewed paper.
              </p>
              <Link
                href="/tools"
                className="inline-flex items-center gap-2 px-8 py-4 text-white font-medium shadow-xl shadow-purple-950/40 hover:shadow-purple-900/50 hover:-translate-y-0.5 transition-all"
                style={{ backgroundImage: "var(--gradient-primary)" }}
              >
                Explore Research Tools <ArrowRight size={18} />
              </Link>
            </FadeIn>
          </div>

          <div className="col-span-12 md:col-span-5 mt-16 md:mt-0">
            <FadeIn delay={0.15}>
              <NetworkArt className="max-w-xl mx-auto" />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ---- Stats ---- */}
      <section className="border-y border-[var(--grey-2)] bg-[var(--off-black)]">
        <div className="container-grid py-14">
          <div className="col-span-12 grid grid-cols-2 md:grid-cols-3 gap-10">
            {STATS.map(s => (
              <StatCounter key={s.label} value={s.value} suffix={s.suffix} label={s.label} />
            ))}
          </div>
        </div>
      </section>

      {/* ---- Trust marquee ---- */}
      <TrustMarquee />

      {/* ---- Services ---- */}
      <section className="section">
        <div className="container-grid">
          <div className="col-span-12">
            <FadeIn>
              <p className="label-text mb-4 text-[var(--accent)]">✦ Our Services</p>
              <h2 className="section-heading max-w-2xl mb-16">Everything you need to publish high-quality research.</h2>
            </FadeIn>
          </div>
          <div className="col-span-12 grid md:grid-cols-2 gap-6">
            {SERVICES.map((s, i) => (
              <FadeIn key={s.n} delay={i * 0.08}>
                <Link
                  href={s.href}
                  className="group block h-full border border-[var(--grey-2)] bg-[var(--off-black)] p-8 hover:border-[var(--purple-glow)] hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-6">
                    <span className="label-text">{s.n}</span>
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white"
                      style={{ backgroundImage: "var(--gradient-primary)" }}
                    >
                      <s.icon size={20} />
                    </div>
                  </div>
                  <span className="label-text text-[var(--accent)]">{s.tag}</span>
                  <h3 className="text-xl font-semibold text-white mt-2 mb-3 tracking-tight">{s.title}</h3>
                  <p className="body-copy !text-sm mb-6">{s.desc}</p>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] group-hover:gap-2.5 transition-all">
                    {s.cta} <ArrowRight size={15} />
                  </span>
                </Link>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Process ---- */}
      <section className="section border-t border-[var(--grey-2)]">
        <div className="container-grid">
          <div className="col-span-12">
            <FadeIn>
              <p className="label-text mb-4 text-center text-[var(--accent)]">✦ The Process</p>
              <h2 className="section-heading text-center mb-4">A guided path from question to publication.</h2>
              <p className="body-copy text-center mx-auto mb-16">
                Three structured stages. One mentor. As many sessions as your project needs.
              </p>
            </FadeIn>
          </div>

          <div className="col-span-12 grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-8 left-[16.5%] right-[16.5%] h-px" style={{ background: "linear-gradient(90deg, transparent, var(--purple-primary), transparent)" }} aria-hidden="true" />
            {PROCESS.map((p, i) => (
              <FadeIn key={p.n} delay={i * 0.12}>
                <div className="relative text-center">
                  <div
                    className="relative z-10 w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-white font-semibold text-xl mb-6 shadow-lg shadow-purple-950/40"
                    style={{ backgroundImage: "var(--gradient-primary)" }}
                  >
                    {p.n}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-3 tracking-tight">{p.title}</h3>
                  <p className="body-copy !text-sm mx-auto">{p.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Testimonials ---- */}
      <section className="relative section border-y border-[var(--grey-2)] bg-[var(--off-black)] overflow-hidden">
        <GradientBlob className="w-[28rem] h-[28rem] top-0 left-1/2 -translate-x-1/2" variant="primary" />
        <NetworkArt dense className="pointer-events-none absolute -bottom-10 -right-10 w-[26rem] opacity-[0.12]" />
        <div className="relative container-grid">
          <div className="col-span-12">
            <FadeIn>
              <p className="label-text mb-4 text-center text-[var(--accent)]">✦ Testimonials</p>
              <h2 className="section-heading text-center mb-16">Researchers around the world, mentored to publication.</h2>
            </FadeIn>
            <FadeIn delay={0.1}>
              <Testimonials items={TESTIMONIALS} />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ---- Contact ---- */}
      <section className="section">
        <div className="container-grid">
          <div
            className="col-span-12 relative overflow-hidden border border-[var(--grey-2)] p-12 md:p-16 text-center"
            style={{ background: "linear-gradient(160deg, var(--off-black) 0%, #0d0716 100%)" }}
          >
            <GradientBlob className="w-96 h-96 -bottom-32 -right-32" variant="secondary" />
            <div className="relative">
              <FadeIn>
                <p className="label-text mb-4 text-[var(--accent)]">✦ Get in Touch</p>
                <h2 className="section-heading mb-4">Contact MetaWorld Research Academy</h2>
                <p className="body-copy mx-auto mb-10">
                  Reach out to discuss mentorship, collaborations, or topic suggestions.
                </p>
                <a
                  href="mailto:metaworldresearchacademy@gmail.com"
                  className="inline-flex items-center gap-2 px-8 py-4 text-white font-medium shadow-xl shadow-purple-950/40 hover:-translate-y-0.5 transition-all"
                  style={{ backgroundImage: "var(--gradient-primary)" }}
                >
                  Email Us <ArrowRight size={18} />
                </a>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
