import { useEffect, useCallback, useState, type JSX } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { SubCollection, ArtPiece } from "../../data/artData";

interface ArtModalProps {
  piece: ArtPiece;
  subCollection: SubCollection;
  onClose: () => void;
}

export default function ArtModal({ piece, subCollection, onClose }: ArtModalProps): JSX.Element {
  const [currentIndex, setCurrentIndex] = useState(subCollection.pieces.findIndex((p) => p.id === piece.id));
  const currentPiece = subCollection.pieces[currentIndex];

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") handlePrevious();
      if (e.key === "ArrowRight") handleNext();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [handleKey]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % subCollection.pieces.length);
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + subCollection.pieces.length) % subCollection.pieces.length);
  };

  return (
    <div
      className="art-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={currentPiece.name}
    >
      <div className="art-modal-container" onClick={(e) => e.stopPropagation()}>
        <button className="art-modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        <div className="art-modal-carousel">
          <div className="art-modal-image-wrap">
            <img src={currentPiece.src} alt={currentPiece.name} className="art-modal-image" />
          </div>

          {subCollection.pieces.length > 1 && (
            <>
              <button
                className="art-modal-nav-btn art-modal-nav-prev"
                onClick={handlePrevious}
                aria-label="Previous piece"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                className="art-modal-nav-btn art-modal-nav-next"
                onClick={handleNext}
                aria-label="Next piece"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}
        </div>

        <div className="art-modal-info">
          <h3 className="art-modal-title">{currentPiece.name}</h3>
          <p className="art-modal-description">{currentPiece.description}</p>
          {subCollection.pieces.length > 1 && (
            <p className="art-modal-counter">
              {currentIndex + 1} / {subCollection.pieces.length}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
