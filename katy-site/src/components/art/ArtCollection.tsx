import { useState, type JSX } from "react";
import type { ArtCollection as ArtCollectionType, ArtPiece } from "../../data/artData";
import ArtModal from "./ArtModal";

interface ArtCollectionProps {
  collection: ArtCollectionType;
}

export default function ArtCollection({ collection }: ArtCollectionProps): JSX.Element {
  const [selected, setSelected] = useState<ArtPiece | null>(null);

  return (
    <section className="art-collection">
      <div className="art-collection-header">
        <h2 className="art-collection-title">{collection.title}</h2>
        <p className="art-collection-desc">{collection.description}</p>
      </div>

      <div className="art-gallery-scroll">
        {collection.pieces.map((piece) => (
          <button
            key={piece.id}
            className="art-thumb"
            onClick={() => setSelected(piece)}
            aria-label={`View ${piece.name}`}
          >
            <img src={piece.src} alt={piece.name} className="art-thumb-image" />
            <span className="art-thumb-overlay">
              <span className="art-thumb-name">{piece.name}</span>
            </span>
          </button>
        ))}
      </div>

      {selected && (
        <ArtModal piece={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}
