import "./styles/FoundingSection.css";
import { Button, Field, Input, Textarea } from "@fluentui/react-components";

export default function FoundingSection() {
  return (
    <section id="founding" className="founding-section">
      <div className="founding-section__inner">
        <div className="founding-section__primary-card">
          <div className="founding-section__eyebrow founding-section__eyebrow--light">
            Founding members
          </div>

          <h2 className="founding-section__title founding-section__title--light">
            Join Dear.
          </h2>

          <p className="founding-section__copy founding-section__copy--light">
            Dear is an invite-only service for the first 20 founding members.
            This will help Dear learn what support people want most, where agents help, and how to build trust and comfort with the product. Founding members will get early access to the product, have a direct line to share feedback and ideas, and be part of a small community shaping the future of digital care.
          </p>

          <form className="founding-section__form">
            <Field label="First name" className="founding-section__field founding-section__field--light">
              <Input appearance="filled-lighter" />
            </Field>

            <Field label="Email" className="founding-section__field founding-section__field--light">
              <Input appearance="filled-lighter" />
            </Field>

            <Field
              label="What kind of life admin or mental load would you want Dear to take off your plate?"
              className="founding-section__field founding-section__field--light founding-section__full-width"
            >
              <Textarea appearance="filled-lighter" resize="vertical" />
            </Field>

            <Button appearance="primary" className="founding-section__submit founding-section__full-width">
              Request early access
            </Button>
          </form>
        </div>

        <div className="founding-section__secondary-card">
          <div className="founding-section__eyebrow">Behind the scenes</div>
          <h3 className="founding-section__title founding-section__title--small">
           How it will Work
          </h3>

          <div className="founding-section__notes">
            <div>
              <div className="founding-section__note-title">Web app and companion mobile app</div>
              <p>
                Member intake questionnaire, messaging interface for check-ins and support,and a dashboard for check-ins and task suggestions.
              </p>
            </div>

            <div>
              <div className="founding-section__note-title">Agents</div>
              <p>
                Use LLM-based agents for planning, reminders, summarization, and vendor
                research, with clear approval checkpoints before any action is taken.
              </p>
            </div>

            <div>
              <div className="founding-section__note-title">Trust layer</div>
              <p>
                Emphasize preferences, standards, and privacy controls. Dear learns over time and is designed to feel like a helpful assistant, not a surveillance tool.    
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}