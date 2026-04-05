import "./styles/Header.css";
import { Button } from "@fluentui/react-components";
import logo from '../assets/logo.png';

export default function Header() {
  return (
    <header className="header">
      <div className="header__brand">
        <img src={logo} alt="Dear" />
      </div>

      <nav className="header__nav">
        <a href="#how-it-works">How it works</a>
        <a href="#why-dear">Why Dear</a>
        <a href="#founding">Founding members</a>
      </nav>

      <Button
        appearance="secondary"
        className="header__button"
        as="a"
        href="#founding"
      >
        Join waitlist
      </Button>
    </header>
  );
}