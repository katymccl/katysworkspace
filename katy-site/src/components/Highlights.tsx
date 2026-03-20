// =========================
// components/Highlights.tsx
// =========================
import type { JSX } from "react";
import { Code2, Database, Mountain } from "lucide-react";

const highlights = [
  {
    title: "Software Engineering",
    text: "Backend systems, APIs, full-stack product work, and thoughtful technical execution.",
    icon: Code2,
  },
  {
    title: "Cloud + Data",
    text: "Scalable services, platform systems, and developer-focused infrastructure.",
    icon: Database,
  },
  {
    title: "Mountain Minded",
    text: "Skier, builder, and someone who thrives in movement, flow, and real environments.",
    icon: Mountain,
  },
];

export default function Highlights(): JSX.Element {
  return (
    <section id="highlights" className="highlights-section">
      {highlights.map((item) => {
        const Icon = item.icon;
        return (
          <article key={item.title} className="feature-card glass-panel">
            <div className="feature-icon-wrap">
              <Icon className="feature-icon" />
            </div>
            <h2 className="feature-title">{item.title}</h2>
            <p className="feature-text">{item.text}</p>
          </article>
        );
      })}
    </section>
  );
}
