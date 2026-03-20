// =========================
// components/PortfolioSection.tsx
// =========================
import type { JSX } from "react";
import { Brush, ChevronRight, Code2, Mountain, PenSquare } from "lucide-react";

const cards = [
  {
    title: "Art Portfolio",
    description: "Visual work, concepts, design explorations, and creative pieces across mediums.",
    eyebrow: "Visual",
    href: "/art",
    icon: Brush,
  },
  {
    title: "Skiing Portfolio",
    description: "Competition, mountain life, ski imagery, adventures, and performance highlights.",
    eyebrow: "Mountain",
    href: "/skiing",
    icon: Mountain,
  },
  {
    title: "Coding Portfolio",
    description: "Software projects, technical case studies, product work, and engineering depth.",
    eyebrow: "Technical",
    href: "/coding",
    icon: Code2,
  },
  {
    title: "Writing Portfolio",
    description: "Essays, reflections, articles, and long-form writing with voice and perspective.",
    eyebrow: "Editorial",
    href: "/writing",
    icon: PenSquare,
  },
];

export default function PortfolioSection(): JSX.Element {
  return (
    <section id="portfolios" className="portfolio-section">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow-text">Portfolio sections</p>
          <h2 className="section-title">Explore my portfolios</h2>
        </div>
        <p className="section-note">Portfolios coming soon!</p>
      </div>

      <div className="portfolio-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <a key={card.title} href={card.href} className="portfolio-card">
              <div className="portfolio-card-header">
                <div>
                  <p className="portfolio-eyebrow">{card.eyebrow}</p>
                  <h3 className="portfolio-title">{card.title}</h3>
                </div>
                <span className="portfolio-icon-wrap">
                  <Icon className="portfolio-icon" />
                </span>
              </div>

  <p className="portfolio-description">{card.description}</p>

              <span className="portfolio-link-row">
                Open portfolio
                <ChevronRight className="portfolio-chevron" />
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
}

