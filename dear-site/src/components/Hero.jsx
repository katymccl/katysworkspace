import "./styles/Hero.css";
import { Button } from "@fluentui/react-components";

const highlights = [
  ["Proactive", "Anticipates needs before users ask"],
  ["Trusted", "Context-aware support with human standards"],
  ["Discreet", "Built around privacy and calm execution"],
];

const feelLike = [
  "It checks in before the school form is overdue.",
  "It already knows which dog groomer meets your standards.",
  "It helps you keep promises to your life without carrying every detail alone.",
];

export default function Hero() {
  return (
    <main className="hero">
      <section className="hero__content">
        <div className="hero__eyebrow">The digital care service for adults</div>

        <h1 className="hero__title">
          The service that handles the tasks
          <span>and the mental load behind them.</span>
        </h1>

        <p className="hero__copy">
          Dear is calm, elegant life support for people carrying too much in their
          heads. It combines proactive guidance, trusted execution, and privacy-first
          design so users feel looked after—not managed.
        </p>

        <div className="hero__actions">
          <Button appearance="primary" className="hero__primary" as="a" href="#founding">
            Apply for founding membership
          </Button>
          <Button appearance="secondary" className="hero__secondary" as="a" href="#why-dear">
            Explore the concept
          </Button>
        </div>

        <div className="hero__highlights">
          {highlights.map(([title, body]) => (
            <div key={title} className="hero__highlight-card">
              <div className="hero__card-title">{title}</div>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <aside className="hero__aside">
        <div className="hero__panel">
          <div className="hero__panel-top">
            <div>
              <div className="hero__panel-label">A calmer operating system</div>
              <div className="hero__panel-title">Hey Dear - let's get started</div>
            </div>
            <div className="hero__chip">Soft power</div>
          </div>

          <div className="hero__feel-list">
            {feelLike.map((line) => (
              <div key={line} className="hero__mini-card">
                <p>{line}</p>
              </div>
            ))}
          </div>

          <div className="hero__positioning">
            <div className="hero__positioning-label">Like your mom, without the judgment</div>
            <p>Not another productivity tool. A digital care layer for modern adult life.</p>
          </div>
        </div>
      </aside>
    </main>
  );
}