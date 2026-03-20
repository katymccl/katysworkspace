import { motion } from "framer-motion";
import type { JSX } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Brush,
  ChevronRight,
  Code2,
  Database,
  Mountain,
  PenSquare,
} from "lucide-react";

type Highlight = {
  icon: LucideIcon;
  title: string;
  text: string;
};

type PortfolioCard = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  eyebrow: string;
};

const LINKEDIN_URL = "https://www.linkedin.com/in/kathrynmcclintic/";
const EMAIL = "kathrynrmcclintic@gmail.com";

const PROFILE_IMG = "/profile.jpg";
const SKI_IMG_1 = "/ski1.jpg";
const SKI_IMG_2 = "/ski2.jpg";
const HERO_BG = "/hero-ski.jpg";

const highlights: Highlight[] = [
  {
    icon: Code2,
    title: "Software Engineering",
    text: "Backend systems, APIs, full-stack product work, and thoughtful technical execution.",
  },
  {
    icon: Database,
    title: "Cloud + Data",
    text: "Scalable services, platform systems, and developer-focused infrastructure.",
  },
  {
    icon: Mountain,
    title: "Mountain Minded",
    text: "Skier, builder, and someone who thrives in movement, flow, and real environments.",
  },
];

const tags: string[] = [
  "Microsoft",
  "Azure Quantum",
  "Distributed Systems",
  "React",
  "TypeScript",
  ".NET",
  "AI Products",
];

const portfolioCards: PortfolioCard[] = [
  {
    title: "Art Portfolio",
    description: "Visual work, concepts, design explorations, and creative pieces across mediums.",
    href: "/art",
    icon: Brush,
    eyebrow: "Visual",
  },
  {
    title: "Skiing Portfolio",
    description: "Competition, mountain life, ski imagery, adventures, and performance highlights.",
    href: "/skiing",
    icon: Mountain,
    eyebrow: "Mountain",
  },
  {
    title: "Coding Portfolio",
    description: "Software projects, technical case studies, product work, and engineering depth.",
    href: "/coding",
    icon: Code2,
    eyebrow: "Technical",
  },
  {
    title: "Writing Portfolio",
    description: "Essays, reflections, articles, and long-form writing with voice and perspective.",
    href: "/writing",
    icon: PenSquare,
    eyebrow: "Editorial",
  },
];

function LinkedInIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M4.98 3.5C4.98 4.88 3.86 6 2.48 6 1.1 6 0 4.88 0 3.5S1.1 1 2.48 1c1.38 0 2.5 1.12 2.5 2.5zM.5 8h4v14h-4V8zm7.5 0h3.8v1.9h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V22h-4v-6.6c0-1.58-.03-3.6-2.2-3.6-2.2 0-2.53 1.72-2.53 3.5V22h-4V8z" />
    </svg>
  );
}

function MountainMark(): JSX.Element {
  return (
    <svg
      viewBox="0 0 220 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-7 w-auto text-white/70"
      aria-hidden="true"
    >
      <path
        d="M8 28H46L58 18L70 25L86 14L99 23L112 9L124 20L137 15L150 25H212"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SnowLayer({ delay = 0 }: { delay?: number }): JSX.Element {
  const flakes = [
    "left-[8%] top-[10%]",
    "left-[18%] top-[0%]",
    "left-[28%] top-[14%]",
    "left-[38%] top-[4%]",
    "left-[52%] top-[12%]",
    "left-[64%] top-[2%]",
    "left-[76%] top-[16%]",
    "left-[88%] top-[8%]",
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {flakes.map((pos, index) => (
        <motion.span
          key={`${pos}-${index}-${delay}`}
          className={`absolute ${pos} block h-1 w-1 rounded-full bg-white/50`}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: [0, 180, 360, 540], x: [0, 8, -6, 4], opacity: [0, 0.7, 0.55, 0] }}
          transition={{
            duration: 10 + index * 0.8,
            repeat: Infinity,
            ease: "linear",
            delay: delay + index * 0.6,
          }}
        />
      ))}
    </div>
  );
}

function HighlightCard({ icon: Icon, title, text, delay }: Highlight & { delay: number }): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur"
    >
      <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-white/5 p-3">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="mb-2 text-xl font-semibold tracking-tight">{title}</h2>
      <p className="text-sm leading-7 text-white/70">{text}</p>
    </motion.div>
  );
}

function PortfolioSection(): JSX.Element {
  return (
    <section id="portfolios" className="mt-14">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 text-xs uppercase tracking-[0.32em] text-white/45">Portfolio sections</div>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Explore my portfolios</h2>
          <p className="max-w-2xl text-sm leading-7 text-white/58 md:hidden">
            Each section opens into a dedicated page as the site grows.
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {portfolioCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.a
              key={card.title}
              href={card.href}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.15 + index * 0.08 }}
              className="group rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.08]"
            >
              <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                  <div className="mb-3 text-xs uppercase tracking-[0.28em] text-white/45">{card.eyebrow}</div>
                  <h3 className="text-2xl font-semibold tracking-tight">{card.title}</h3>
                </div>
                <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-3 text-white/80 transition group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="max-w-md text-sm leading-7 text-white/65">{card.description}</p>
              <div className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-white/75 transition group-hover:text-white">
                Open portfolio
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </div>
            </motion.a>
          );
        })}
      </div>
    </section>
  );
}

export default function KatyLinkedInLandingPage(): JSX.Element {
  return (
    <div className="min-h-screen overflow-hidden bg-[#09070d] text-white">
<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.08),transparent_26%),radial-gradient(circle_at_78%_12%,rgba(168,85,247,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.10),transparent_34%)]" />

      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(6,8,12,0.45), rgba(6,8,12,0.65), rgba(10,10,14,0.85)), url(${HERO_BG})`,
          backgroundSize: "cover",
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* Bottom purple gradient (below hero only) */}
<div className="pointer-events-none absolute inset-x-0 top-[58vh] h-[52vh] bg-gradient-to-b from-transparent via-[rgba(88,28,135,0.18)] to-[rgba(20,14,28,0.92)]" />

      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] opacity-[0.05]" />

      <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center opacity-30">
        <svg
          viewBox="0 0 1200 180"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full max-w-6xl"
          aria-hidden="true"
        >
          <path
            d="M0 150C72 150 101 110 154 110C209 110 230 146 283 146C333 146 372 70 427 70C483 70 499 132 560 132C614 132 662 30 724 30C783 30 804 115 863 115C925 115 967 82 1012 82C1063 82 1108 128 1200 128"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M0 162C80 162 110 132 162 132C220 132 232 162 290 162C343 162 391 92 441 92C500 92 514 150 570 150C628 150 675 52 734 52C796 52 811 132 878 132C936 132 975 96 1027 96C1082 96 1121 142 1200 142"
            stroke="rgba(168,85,247,0.22)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <SnowLayer />
      <SnowLayer delay={2.8} />

      <main className="relative mx-auto max-w-6xl px-6 py-6 md:px-10 lg:px-12">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 flex flex-col gap-4 rounded-3xl border border-white/10 bg-black/25 px-5 py-4 backdrop-blur-md md:flex-row md:items-center md:justify-between"
        >
          <div className="flex items-center gap-4">
            <MountainMark />
            <div>
              <div className="text-sm uppercase tracking-[0.3em] text-white/55">Katy McClintic · Seattle Based</div>
              <div className="mt-1 text-sm text-white/70">Software Engineer · Builder · Creative Technologist</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 md:justify-end">
            <a href="#highlights" className="text-sm text-white/70 transition hover:text-white">
              About
            </a>
            <a href="#portfolios" className="text-sm text-white/70 transition hover:text-white">
              Portfolios
            </a>
            <a
              href={LINKEDIN_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-[#0A66C2]/25 bg-white px-4 py-2 text-sm font-semibold text-neutral-950 shadow-[0_0_0_rgba(10,102,194,0)] transition hover:scale-[1.02] hover:bg-[#0A66C2] hover:text-white hover:shadow-[0_0_28px_rgba(10,102,194,0.42)]"
            >
              <LinkedInIcon />
              LinkedIn
            </a>
          </div>
        </motion.header>

        <section className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <h1 className="max-w-4xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
              I build software, chase mountains, and ship real things.
            </h1>

            <p className="max-w-xl text-base leading-7 text-white/70">
              Backend systems, distributed architecture, and product-minded engineering — with a life rooted in skiing, movement, and exploration.
            </p>

            <div className="flex flex-wrap gap-4">
              <a
                href={LINKEDIN_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 font-semibold text-black transition hover:scale-[1.02] hover:bg-[#0A66C2] hover:text-white hover:shadow-[0_0_32px_rgba(10,102,194,0.45)]"
              >
                Connect
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href={`mailto:${EMAIL}`}
                className="rounded-2xl border border-white/20 bg-white/5 px-6 py-3 backdrop-blur-sm transition hover:bg-white/10"
              >
                Email Me
              </a>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="grid grid-cols-2 gap-4"
          >
            <img
              src={PROFILE_IMG}
              alt="Katy portrait"
              className="h-72 w-full rounded-[2rem] border border-white/10 bg-white/5 object-cover object-top shadow-2xl"
            />
            <img
              src={SKI_IMG_1}
              alt="Katy skiing"
              className="h-72 w-full rounded-[2rem] border border-white/10 bg-white/5 object-cover object-center shadow-2xl"
            />
            <img
              src={SKI_IMG_2}
              alt="Katy ski photo"
              className="col-span-2 h-52 w-full rounded-[2rem] border border-white/10 bg-white/5 object-cover object-[center_42%] shadow-2xl"
            />
          </motion.div>
        </section>

        <section id="highlights" className="mt-14 grid gap-6 md:grid-cols-3">
          {highlights.map((item, index) => (
            <HighlightCard
              key={item.title}
              icon={item.icon}
              title={item.title}
              text={item.text}
              delay={0.1 + index * 0.1}
            />
          ))}
        </section>

        <PortfolioSection />
      </main>
    </div>
  );
}
