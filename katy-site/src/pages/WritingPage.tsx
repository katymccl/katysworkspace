import type { JSX } from "react";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import "../styles/writing.css";
import { writingFeatured, writingSections } from "../data/writingData";

export default function WritingPage(): JSX.Element {
  const sectionScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handleSectionScroll = (sectionId: string, direction: number) => {
    const container = sectionScrollRefs.current[sectionId];
    if (!container) return;

    container.scrollBy({
      left: container.clientWidth * 0.8 * direction,
      behavior: "smooth",
    });
  };

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
          <p className="writing-featured-label">{writingFeatured.subtitle}</p>
          <h2 className="writing-featured-title">{writingFeatured.title}</h2>
          <p className="writing-featured-description">{writingFeatured.description}</p>
          <span className="writing-featured-tag">{writingFeatured.tag}</span>
        </section>

        <div className="writing-sections-list">
          {writingSections.map((section) => (
            <article key={section.id} className="writing-section-card">
              <div className="writing-section-heading">
                <div>
                  <p className="writing-section-label">{section.label}</p>
                  <h3 className="writing-section-title">{section.label}</h3>
                </div>
                <p className="writing-section-description">{section.description}</p>
              </div>

              <div className="writing-section-controls">
                <button
                  type="button"
                  className="writing-section-button"
                  onClick={() => handleSectionScroll(section.id, -1)}
                  aria-label={`Scroll ${section.label} left`}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  className="writing-section-button"
                  onClick={() => handleSectionScroll(section.id, 1)}
                  aria-label={`Scroll ${section.label} right`}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="writing-section-scroll" ref={(el) => { sectionScrollRefs.current[section.id] = el; }}>
                {section.items.map((item, index) => (
                  <div key={`${section.id}-${index}`} className="writing-item-card">
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
