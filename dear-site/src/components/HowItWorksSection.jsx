// src/components/HowItWorksSection.jsx
import "./styles/HowItWorks.css";

export default function HowItWorksSection({ steps, useCases }) {
  return (
    <section id="how-it-works" className="how-it-works">
      <div className="how-it-works__inner">
        <div className="how-it-works__left">
          <div className="how-it-works__eyebrow">How it works</div>
          <h2 className="how-it-works__title">
            A product model that blends intelligent agents with human-trust standards.
          </h2>
          <p className="how-it-works__copy">
            The first version does not need to automate everything. It only needs to
            make people feel meaningfully lighter, more held, and more organized.
          </p>

          <ul className="how-it-works__list">
            {useCases.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="how-it-works__steps">
          {steps.map((item) => (
            <div key={item.step} className="how-it-works__step-card">
              <div className="how-it-works__step-number">{item.step}</div>
              <div className="how-it-works__step-title">{item.title}</div>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
