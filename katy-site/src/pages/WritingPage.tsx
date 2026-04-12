import type { JSX } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import "../styles/writing.css";

const featured = {
  title: "A Winter in Quiet Motion",
  subtitle: "Featured essay",
  description:
    "A lyrical exploration of nature, memory, and the small details that shape a season. This piece bridges personal narrative with vivid scene-setting and reflective observation.",
  tag: "Essay",
};

const sections = [
  {
    id: "longform",
    label: "Long-form essays",
    description: "Deep dives into emotion, place, and curiosity; essays that linger and invite you to sit with a moment.",
    items: [
      {
        title: "On Winter Light",
        summary: "A reflective piece about how light changes the landscape of memory in cold months.",
        tag: "Personal Essay",
      },
      {
        title: "The Quiet of the Mountain Road",
        summary: "A narrative that follows the rhythm of travel, doubt, and the decision to keep moving.",
        tag: "Travel Essay",
      },
      {
        title: "Architecture of a Pause",
        summary: "An exploration of stillness, creativity, and the spaces we build to think better.",
        tag: "Creative Nonfiction",
      },
    ],
  },
  {
    id: "editorial",
    label: "Editorial narratives",
    description: "Shorter work with clear argument and distinctive voice, written for readers who want to feel provoked and inspired.",
    items: [
      {
        title: "The Case for Quiet Mornings",
        summary: "Why slowing down at the start of the day amplifies productivity and creative energy.",
        tag: "Opinion",
      },
      {
        title: "Storytelling in Design",
        summary: "A look at how narrative anchors product work and makes abstract ideas more human.",
        tag: "Editorial",
      },
      {
        title: "The Body of an Image",
        summary: "A short piece on visual thinking, metaphor, and the craft of describing what you see.",
        tag: "Culture",
      },
    ],
  },
  {
    id: "copy",
    label: "Copy & concept",
    description: "Voice-driven writing for brand, campaign, and conceptual storytelling with a strong editorial bent.",
    items: [
      {
        title: "Headline systems for curiosity",
        summary: "Concept work that balances boldness and clarity for editorial campaigns.",
        tag: "Copy",
      },
      {
        title: "Microcopy that guides",
        summary: "Short, purposeful language designed to move people through experience.",
        tag: "UX Writing",
      },
      {
        title: "Narrative frameworks",
        summary: "Ideas for structuring creative work so it feels coherent, memorable, and human.",
        tag: "Concept",
      },
    ],
  },
  {
    id: "haiku",
    label: "Haikus",
    description: "Moments distilled into seventeen syllables—images and emotions in miniature.",
    items: [
      {
        title: "winter morning",
        summary: "snow settles softly\nthe mountain holds its silence\nlight breaks through the pines",
        tag: "Haiku",
      },
      {
        title: "in passing",
        summary: "your words linger\nlike steam from morning coffee—\ngone, but felt still",
        tag: "Haiku",
      },
      {
        title: "threshold",
        summary: "at the edge of dusk\nbetween two breaths of darkness\na moment remains",
        tag: "Haiku",
      },
      {
        title: "small things",
        summary: "rain on the window\npetals caught in the gutter\nbeauty in decay",
        tag: "Haiku",
      },
      {
        title: "motion",
        summary: "the river flows on\nindifferent to my choice\nto stand or follow",
        tag: "Haiku",
      },
    ],
  },
];

export default function WritingPage(): JSX.Element {
  return (
    <div className="writing-page-shell">
      <div className="writing-page-frame">
        <header className="writing-page-header">
          <Link to="/" className="art-back-link">
            <ArrowLeft size={16} />
            Back
          </Link>

          <div className="writing-page-title-block">
            <div className="writing-page-icon-wrap">
              <FileText size={22} />
            </div>
            <div>
              <p className="eyebrow-text">Editorial</p>
              <h1 className="writing-page-title">Writing Portfolio</h1>
            </div>
          </div>

          <p className="writing-page-subtitle">
            Essays, ideas, editorial work, and narrative concepts crafted to shape feeling and focus.
          </p>
        </header>

        <section className="writing-featured-card">
          <div className="writing-featured-badge">Featured</div>
          <p className="writing-featured-label">{featured.subtitle}</p>
          <h2 className="writing-featured-title">{featured.title}</h2>
          <p className="writing-featured-description">{featured.description}</p>
          <span className="writing-featured-tag">{featured.tag}</span>
        </section>

        <div className="writing-sections-list">
          {sections.map((section) => (
            <article key={section.id} className="writing-section-card">
              <div className="writing-section-heading">
                <div>
                  <p className="writing-section-label">{section.label}</p>
                  <h3 className="writing-section-title">{section.label}</h3>
                </div>
                <p className="writing-section-description">{section.description}</p>
              </div>

              <div className="writing-section-scroll">
                {section.items.map((item) => (
                  <div key={item.title} className="writing-item-card">
                    <span className="writing-item-tag">{item.tag}</span>
                    <h4 className="writing-item-title">{item.title}</h4>
                    <p className="writing-item-summary">{item.summary}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
