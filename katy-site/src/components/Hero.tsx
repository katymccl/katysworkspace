// =========================
// components/Hero.tsx
// =========================
import type { JSX } from "react";

const LINKEDIN_URL = "https://www.linkedin.com/in/kathrynmcclintic/";
const EMAIL = "kathrynrmcclintic@gmail.com";

const PROFILE_IMG = "/profile.jpg";
const SKI_IMG_1 = "/ski1.jpg";
const SKI_IMG_2 = "/ski2.jpg";

const tags = [
    "Microsoft",
    "Azure Quantum",
    "Distributed Systems",
    "React",
    "TypeScript",
    ".NET",
    "AI Products",
];

export default function Hero(): JSX.Element {
    return (
        <section className="hero-section">
            <div className="hero-copy">
                <h1 className="hero-title">I build software, chase mountains, and ship real things.</h1>
                <div className="hero-text-panel">
                    <p className="hero-description">
                        Backend systems, distributed architecture, and product-minded engineering — with a life rooted in skiing, movement, and exploration.
                    </p>
                </div>

                <div className="button-row">
                    <a href={LINKEDIN_URL} target="_blank" rel="noreferrer" className="button button-primary">
                        Connect
                    </a>
                    <a href={`mailto:${EMAIL}`} className="button button-secondary">
                        Email Me
                    </a>
                </div>

                <div className="tag-row" aria-label="Experience tags">
                    {tags.map((tag) => (
                        <span key={tag} className="pill-tag">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>

            <div className="hero-gallery">
                <img src={PROFILE_IMG} alt="Katy portrait" className="gallery-image gallery-image--portrait" />
                <img src={SKI_IMG_1} alt="Katy skiing" className="gallery-image gallery-image--ski" />
                <img src={SKI_IMG_2} alt="Katy ski photo" className="gallery-image gallery-image--wide" />
            </div>
        </section>
    );
}