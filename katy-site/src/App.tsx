// =========================
// App.tsx
// =========================
import type { JSX } from "react";
import { Routes, Route } from "react-router-dom";
import "./styles/globals.css";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Highlights from "./components/Highlights";
import PortfolioSection from "./components/PortfolioSection";
import ArtPage from "./pages/ArtPage";

function Home(): JSX.Element {
  return (
    <div className="app-shell">
      <div className="hero-image-overlay" />
      <div className="page-grid" aria-hidden="true" />
      <main className="site-frame">
        <Header />
        <Hero />
        <Highlights />
        <PortfolioSection />
      </main>
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/art" element={<ArtPage />} />
    </Routes>
  );
}
