import "./styles/PillarsSection.css";

export default function PillarsSection({ pillars }) {
  return (
    <section id="why-dear" className="pillars-section">
      <div className="pillars-section__inner">
        <div className="pillars-section__eyebrow">Core pillars</div>
        <h2 className="pillars-section__title">
          Support that feels sophisticated, warm, and genuinely useful.
        </h2>

        <div className="pillars-section__grid">
          {pillars.map((pillar) => (
            <div key={pillar.title} className="pillars-section__card">
              <div className="pillars-section__card-title">{pillar.title}</div>
              <p>{pillar.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}