// =========================
// components/Header.tsx
// =========================
import type { JSX } from "react";
import LinkedInIcon from "./icons/LinkedInIcon";
import MountainMark from "./icons/MountainMark";
import Instagram from "./icons/Instagram";
import instagramUrl from "./icons/instagram.svg";

const LINKEDIN_URL = "https://www.linkedin.com/in/kathrynmcclintic/";
const INSTAGRAM_URL = "https://www.instagram.com/freeskikaty";

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
        <a href={LINKEDIN_URL} target="_blank" rel="noreferrer" className="button" style={{ color: '#fff' }}>
          <LinkedInIcon />
          LinkedIn
        </a>
        <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="button button-instagram">
          <Instagram src={instagramUrl} />
          Instagram
        </a>
      </nav>
    </header>
  );
}