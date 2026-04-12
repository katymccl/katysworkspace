import { useState, useCallback, useEffect, type JSX } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { artCollections } from "../data/artData";
import FullImageModal from "../components/art/FullImageModal";

export default function SubCollectionDetailPage(): JSX.Element {
  const { collectionId, subCollectionId } = useParams<{ collectionId: string; subCollectionId: string }>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showFullImage, setShowFullImage] = useState(false);

  const collection = artCollections.find((c) => c.id === collectionId);
  const subCollection = collection?.subCollections.find((s) => s.id === subCollectionId);

  if (!collection || !subCollection) {
    return (
      <div className="art-page-shell">
        <div className="art-page-frame">
          <Link to="/art" className="art-back-link">
            <ChevronLeft size={18} />
            Back to Collections
          </Link>
          <p>Sub-collection not found.</p>
        </div>
      </div>
    );
  }

  const currentPiece = subCollection.pieces[currentIndex];

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % subCollection.pieces.length);
  }, [subCollection.pieces.length]);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + subCollection.pieces.length) % subCollection.pieces.length);
  }, [subCollection.pieces.length]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrevious();
    },
    [handleNext, handlePrevious]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="art-page-shell">
      <div className="art-page-frame">
        <Link to="/art" className="art-back-link">
          <ChevronLeft size={18} />
          Back to Collections
        </Link>

        <div className="subcollection-header">
          <h1 className="subcollection-title">{subCollection.title}</h1>
          <p className="subcollection-desc">{subCollection.description}</p>
        </div>

        <div className="subcollection-display">
          <div className="subcollection-carousel-image-wrap">
            <img src={currentPiece.src} alt={currentPiece.name} className="subcollection-carousel-image" />
            <div className="subcollection-carousel-overlay">
              <h3 className="subcollection-carousel-title">{currentPiece.name}</h3>
              <p className="subcollection-carousel-desc">{currentPiece.description}</p>
              <button 
                className="subcollection-details-btn"
                onClick={() => setShowFullImage(true)}
                aria-label="View details"
              >
                View Details
              </button>
            </div>
          </div>

          <div className="subcollection-carousel-counter">
            {currentIndex + 1} / {subCollection.pieces.length}
          </div>

          {subCollection.pieces.length > 1 && (
            <div className="subcollection-thumbnails">
              {subCollection.pieces.map((piece, index) => (
                <button
                  key={piece.id}
                  className={`subcollection-thumbnail ${index === currentIndex ? "active" : ""}`}
                  onClick={() => setCurrentIndex(index)}
                  aria-label={`View ${piece.name}`}
                >
                  <img src={piece.src} alt={piece.name} />
                </button>
              ))}
            </div>
          )}
        </div>

        {showFullImage && (
          <FullImageModal
            src={currentPiece.src}
            alt={currentPiece.name}
            onClose={() => setShowFullImage(false)}
          />
        )}
      </div>
    </div>
  );
}
