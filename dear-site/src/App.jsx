import "./index.css";
import "./App.css";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import Header from "./components/Header";
import Hero from "./components/Hero";
import PillarsSection from "./components/PillarsSection";
import HowItWorksSection from "./components/HowItWorksSection";
import FoundingSection from "./components/FoundingSection";
import { pillars, steps, useCases } from "./data/siteContent";

export default function App() {
  return (
    <FluentProvider theme={webLightTheme}>
      <div className="app-shell">
        <div className="app-shell__glow" />
        <Header />
        <Hero />
        <PillarsSection pillars={pillars} />
        <HowItWorksSection steps={steps} useCases={useCases} />
        <FoundingSection />
      </div>
    </FluentProvider>
  );
}