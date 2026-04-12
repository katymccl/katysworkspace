import { type JSX } from "react";
import { Link } from "react-router-dom";
import type { ArtCollection as ArtCollectionType } from "../../data/artData";

interface ArtCollectionProps {
  collection: ArtCollectionType;
}

export default function ArtCollection({ collection }: ArtCollectionProps): JSX.Element {
  return (
    <section className="art-collection">
      <div className="art-collection-header">
        <h2 className="art-collection-title">{collection.title}</h2>
        <p className="art-collection-desc">{collection.description}</p>
      </div>

      <div className="art-gallery-scroll">
        {collection.subCollections.map((subCollection) => (
          <Link
            key={subCollection.id}
            to={`/art/${collection.id}/${subCollection.id}`}
            className="art-thumb"
            aria-label={`View ${subCollection.title}`}
          >
            <img src={subCollection.thumbnail} alt={subCollection.title} className="art-thumb-image" />
            <span className="art-thumb-overlay">
              <span className="art-thumb-name">{subCollection.title}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
