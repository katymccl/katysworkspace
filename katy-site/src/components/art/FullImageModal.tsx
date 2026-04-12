import { useEffect, type JSX } from "react";
import { X } from "lucide-react";

interface FullImageModalProps {
  src: string;
  alt: string;
  onClose: () => void;
}

export default function FullImageModal({ src, alt, onClose }: FullImageModalProps): JSX.Element {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="full-image-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Full image view"
    >
      <div className="full-image-modal-container" onClick={(e) => e.stopPropagation()}>
        <button className="full-image-modal-close" onClick={onClose} aria-label="Close">
          <X size={24} />
        </button>

        <div className="full-image-modal-image-wrap">
          <img src={src} alt={alt} className="full-image-modal-image" />
        </div>
      </div>
    </div>
  );
}
