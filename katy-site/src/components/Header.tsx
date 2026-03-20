// =========================
// components/Header.tsx
// =========================
import type { JSX } from "react";
import LinkedInIcon from "./icons/LinkedInIcon";
import MountainMark from "./icons/MountainMark";

const LINKEDIN_URL = "https://www.linkedin.com/in/kathrynmcclintic/";

export default function Header(): JSX.Element {
  return (
    <header className="site-header glass-panel">
      <div className="brand-lockup">
        <MountainMark />
        <div>
          <p className="eyebrow-text">Katy McClintic · Seattle Based</p>
          <p className="brand-subtitle">Software Engineer · Builder · Creative Technologist</p>
        </div>
      </div>

      <nav className="site-nav" aria-label="Primary">
        <a href="#highlights" className="nav-link">
          About
        </a>
        <a href="#portfolios" className="nav-link">
          Portfolios
        </a>
        <a href={LINKEDIN_URL} target="_blank" rel="noreferrer" className="button button-linkedin">
          <LinkedInIcon />
          LinkedIn
        </a>
      </nav>
    </header>
  );
}