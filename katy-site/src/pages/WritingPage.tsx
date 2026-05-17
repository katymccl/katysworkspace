import type { JSX } from "react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, X } from "lucide-react";
import "../styles/writing.css";
import { writingSections } from "../data/writingData";

type OverlayState = {
  itemIndex: number;
} | null;

export default function WritingPage(): JSX.Element {
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const poemsCarouselRef = useRef<HTMLDivElement | null>(null);
  const [overlayItem, setOverlayItem] = useState<OverlayState>(null);
  const [overlaySection, setOverlaySection] = useState<string | null>(null);

  const haikuSection = writingSections.find((section) => section.id === "haiku");
  const poemsSection = writingSections.find((section) => section.id === "poems");
  if (!haikuSection || !poemsSection) {
    return (
      <div className="writing-page-shell">
        <div className="writing-page-frame">
          <p>Writing sections are unavailable.</p>
        </div>
      </div>
    );
  }

  const handleCarouselScroll = (direction: number, ref: React.RefObject<HTMLDivElement>) => {
    const carousel = ref.current;
    if (!carousel) return;

    const cards = Array.from(carousel.querySelectorAll<HTMLButtonElement>(".writing-carousel-card"));
    if (!cards.length) return;

    const center = carousel.scrollLeft + carousel.clientWidth / 2;
    let closestIndex = 0;
    let closestDistance = Infinity;

    cards.forEach((card, index) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(cardCenter - center);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    const targetIndex = Math.max(0, Math.min(cards.length - 1, closestIndex + direction));
    cards[targetIndex]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  const openOverlay = (itemIndex: number, sectionId: string) => {
    setOverlayItem({ itemIndex });
    setOverlaySection(sectionId);
  };
  const closeOverlay = () => {
    setOverlayItem(null);
    setOverlaySection(null);
  };

  const currentSection = overlaySection === "haiku" ? haikuSection : overlaySection === "poems" ? poemsSection : null;
  const currentItem = overlayItem && currentSection ? currentSection.items[overlayItem.itemIndex] : null;

  return (
    <div className="writing-page-shell">
      <div className="writing-page-frame">
        <header className="writing-page-header">
          <Link to="/" className="art-back-link">
            <ArrowLeft size={16} />
            Back
          </Link>

          <div className="writing-page-title-block">
            <div className="writing-page-icon-wrap">✦</div>
            <div>
              <p className="eyebrow-text">Writing</p>
              <h1 className="writing-page-title">Poetry & prose</h1>
            </div>
          </div>

          <p className="writing-page-subtitle">
            A collection of haikus, poems, and reflections on life, creativity, and the moments that matter.
          </p>
        </header>

        <section className="writing-section-card">
          <div className="writing-section-heading">
            <div>
              <p className="writing-section-label">{haikuSection.label}</p>
              <h3 className="writing-section-title">{haikuSection.label}</h3>
            </div>
            <p className="writing-section-description">{haikuSection.description}</p>
          </div>

          <div className="writing-section-controls">
            <button
              type="button"
              className="writing-section-button"
              onClick={() => handleCarouselScroll(-1, carouselRef)}
              aria-label="Scroll haiku carousel left"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="writing-section-button"
              onClick={() => handleCarouselScroll(1, carouselRef)}
              aria-label="Scroll haiku carousel right"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div
            className="writing-section-carousel"
            ref={carouselRef}
            tabIndex={0}
            onWheel={(event) => {
              const carousel = carouselRef.current;
              if (!carousel) return;
              if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
                event.preventDefault();
                carousel.scrollLeft += event.deltaY;
              }
            }}
          >
            {haikuSection.items.map((item, index) => (
              <button
                key={index}
                type="button"
                className="writing-carousel-card"
                onClick={() => openOverlay(index, "haiku")}
              >
                <span className="writing-item-tag">{item.tag}</span>
                <h4 className="writing-item-title">{item.title}</h4>
                <p className="writing-item-summary">{item.summary}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="writing-section-card">
          <div className="writing-section-heading">
            <div>
              <p className="writing-section-label">{poemsSection.label}</p>
              <h3 className="writing-section-title">{poemsSection.label}</h3>
            </div>
            <p className="writing-section-description">{poemsSection.description}</p>
          </div>

          <div className="writing-section-controls">
            <button
              type="button"
              className="writing-section-button"
              onClick={() => handleCarouselScroll(-1, poemsCarouselRef)}
              aria-label="Scroll poems carousel left"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="writing-section-button"
              onClick={() => handleCarouselScroll(1, poemsCarouselRef)}
              aria-label="Scroll poems carousel right"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div
            className="writing-section-carousel"
            ref={poemsCarouselRef}
            tabIndex={0}
            onWheel={(event) => {
              const carousel = poemsCarouselRef.current;
              if (!carousel) return;
              if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
                event.preventDefault();
                carousel.scrollLeft += event.deltaY;
              }
            }}
          >
            {poemsSection.items.map((item, index) => (
              <button
                key={index}
                type="button"
                className="writing-carousel-card"
                onClick={() => openOverlay(index, "poems")}
              >
                <span className="writing-item-tag">{item.tag}</span>
                <h4 className="writing-item-title">{item.title}</h4>
                <p className="writing-item-summary">{item.summary}</p>
              </button>
            ))}
          </div>
        </section>
      </div>

      {currentItem && currentSection ? (
        <div className="writing-overlay-backdrop" role="dialog" aria-modal="true" onClick={closeOverlay}>
          <div className="writing-overlay-panel" onClick={(e) => e.stopPropagation()}>
            <button className="writing-overlay-close" onClick={closeOverlay} aria-label="Close overlay">
              <X size={20} />
            </button>
            <p className="writing-overlay-section">{currentSection.label}</p>
            <h2 className="writing-overlay-title">{currentItem.title}</h2>
            <p className="writing-overlay-tag">{currentItem.tag}</p>
            <div className="writing-overlay-body">
              {currentItem.summary.split("\n").map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


