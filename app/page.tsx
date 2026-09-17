import Link from 'next/link';
import { BarChart3, BookOpen, UsersRound, BookOpenText, ArrowRight } from 'lucide-react';
import Nav from './components/Nav';
import Footer from './components/Footer';
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

// Abstract evidence-synthesis network motif for the hero - forest-plot /
// NMA-inspired nodes and edges, hand-authored inline SVG rather than a
// raster asset or stock imagery. Line-art only (white/grey hairlines, no
// gradient fill) to match the Swiss-modernist "near-zero decorative
// colour" direction - purely decorative, so aria-hidden.
function HeroNetworkArt() {
  const nodes = [
    { x: 60, y: 90 }, { x: 220, y: 40 }, { x: 380, y: 110 }, { x: 300, y: 220 },
    { x: 120, y: 220 }, { x: 440, y: 210 }, { x: 200, y: 150 },
  ];
  const edges: [number, number][] = [[0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [2, 5]];
  return (
    <svg viewBox="0 0 500 280" className="w-full h-auto max-w-xl mx-auto" aria-hidden="true">
      {edges.map(([a, b], i) => (
        <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke="#3A3A3A" strokeWidth="1.5" />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={i === 6 ? 14 : 8} fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
      ))}
      {/* forest-plot style estimate + CI line, echoing the site's actual statistical tools */}
      <g transform="translate(20, 250)">
        <line x1="0" y1="0" x2="460" y2="0" stroke="#3A3A3A" strokeWidth="1" />
        <line x1="140" y1="0" x2="320" y2="0" stroke="#9A9A9A" strokeWidth="2" />
        <rect x="220" y="-6" width="12" height="12" fill="#FFFFFF" transform="rotate(45 226 0)" />
      </g>
    </svg>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--black)] text-white font-sans">
      <Nav />

      {/* ---- Hero ---- */}
      <section className="section !pt-16 md:!pt-20">
        <div className="container-grid items-center">
          <div className="col-span-12 md:col-span-7">
            <FadeIn>
              <p className="label-text mb-8">
                MetaWorld Research Academy — Est. 2024
              </p>
              <h1 className="display-heading mb-8">
                Rigorous training.
                <br />
                Real publications.
                <br />
                Independent researchers.
              </h1>
              <p className="body-copy mb-10">
                We mentor systematic reviewers and meta-analysts from a vague question to a peer-reviewed paper.
              </p>
              <Link
                href="/tools"
                className="inline-flex items-center gap-2 px-8 py-4 border border-[var(--grey-2)] text-white label-text !text-xs hover:border-white transition-colors"
              >
                Explore Research Tools <ArrowRight size={16} />
              </Link>
            </FadeIn>
          </div>

          <div className="col-span-12 md:col-span-5 mt-16 md:mt-0">
            <FadeIn delay={0.15}>
              <HeroNetworkArt />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ---- Stats ---- */}
      <section className="border-y border-[var(--grey-2)]">
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
              <p className="label-text mb-4">Our Services</p>
              <h2 className="section-heading max-w-2xl mb-16">Everything you need to publish high-quality research.</h2>
            </FadeIn>
          </div>
          <div className="col-span-12 grid md:grid-cols-2 gap-px bg-[var(--grey-2)] border border-[var(--grey-2)]">
            {SERVICES.map((s, i) => (
              <FadeIn key={s.n} delay={i * 0.08} className="bg-[var(--black)]">
                <Link
                  href={s.href}
                  className="group block h-full p-8 hover:bg-[var(--off-black)] transition-colors"
                >
                  <div className="flex items-center justify-between mb-6">
                    <span className="label-text">{s.n}</span>
                    <s.icon size={22} className="text-[var(--grey-1)] group-hover:text-white transition-colors" />
                  </div>
                  <span className="label-text">{s.tag}</span>
                  <h3 className="text-xl font-semibold text-white mt-2 mb-3 tracking-tight">{s.title}</h3>
                  <p className="body-copy !text-sm mb-6">{s.desc}</p>
                  <span className="inline-flex items-center gap-1.5 text-sm text-white group-hover:gap-2.5 transition-all">
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
              <p className="label-text mb-4 text-center">The Process</p>
              <h2 className="section-heading text-center mb-4">A guided path from question to publication.</h2>
              <p className="body-copy text-center mx-auto mb-16">
                Three structured stages. One mentor. As many sessions as your project needs.
              </p>
            </FadeIn>
          </div>

          <div className="col-span-12 grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-8 left-[16.5%] right-[16.5%] h-px bg-[var(--grey-2)]" aria-hidden="true" />
            {PROCESS.map((p, i) => (
              <FadeIn key={p.n} delay={i * 0.12}>
                <div className="relative text-center">
                  <div className="relative z-10 w-16 h-16 mx-auto rounded-full border border-[var(--grey-2)] bg-[var(--black)] flex items-center justify-center text-white font-semibold text-xl mb-6">
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
      <section className="section border-y border-[var(--grey-2)]">
        <div className="container-grid">
          <div className="col-span-12">
            <FadeIn>
              <p className="label-text mb-4 text-center">Testimonials</p>
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
          <div className="col-span-12 border border-[var(--grey-2)] p-12 md:p-16 text-center">
            <FadeIn>
              <p className="label-text mb-4">Get in Touch</p>
              <h2 className="section-heading mb-4">Contact MetaWorld Research Academy</h2>
              <p className="body-copy mx-auto mb-10">
                Reach out to discuss mentorship, collaborations, or topic suggestions.
              </p>
              <a
                href="mailto:metaworldresearchacademy@gmail.com"
                className="inline-flex items-center gap-2 px-8 py-4 border border-[var(--grey-2)] text-white label-text !text-xs hover:border-white transition-colors"
              >
                Email Us <ArrowRight size={16} />
              </a>
            </FadeIn>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
