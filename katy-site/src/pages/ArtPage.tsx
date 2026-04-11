import type { JSX } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Brush } from "lucide-react";
import { artCollections } from "../data/artData";
import ArtCollection from "../components/art/ArtCollection";
import "../styles/art.css";

export default function ArtPage(): JSX.Element {
  return (
    <div className="art-page-shell">
      <div className="art-page-frame">
        <header className="art-page-header">
          <Link to="/" className="art-back-link">
            <ArrowLeft size={16} />
            Back
          </Link>

          <div className="art-page-title-block">
            <div className="art-page-icon-wrap">
              <Brush size={22} />
            </div>
            <div>
              <p className="eyebrow-text">Visual</p>
              <h1 className="art-page-title">Art Portfolio</h1>
            </div>
          </div>

          <p className="art-page-subtitle">
            Visual work, concepts, design explorations, and creative pieces across mediums.
          </p>
        </header>

        <div className="art-collections-list">
          {artCollections.map((collection) => (
            <ArtCollection key={collection.id} collection={collection} />
          ))}
        </div>
      </div>
    </div>
  );
}
