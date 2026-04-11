import { useEffect, useCallback, type JSX } from "react";
import { X } from "lucide-react";
import type { ArtPiece } from "../../data/artData";

interface ArtModalProps {
  piece: ArtPiece;
  onClose: () => void;
}

export default function ArtModal({ piece, onClose }: ArtModalProps): JSX.Element {
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
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

  return (
    <div
      className="art-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={piece.name}
    >
      <div className="art-modal-container" onClick={(e) => e.stopPropagation()}>
        <button className="art-modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        <div className="art-modal-image-wrap">
          <img src={piece.src} alt={piece.name} className="art-modal-image" />
        </div>

        <div className="art-modal-info">
          <h3 className="art-modal-title">{piece.name}</h3>
          <p className="art-modal-description">{piece.description}</p>
        </div>
      </div>
    </div>
  );
}
