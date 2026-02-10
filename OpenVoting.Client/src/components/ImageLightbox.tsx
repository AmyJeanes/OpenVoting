import { useCallback, useEffect, useState, type MouseEvent } from 'react';

export type ImageLightboxData = {
  imageUrl: string;
  originalUrl?: string;
  alt?: string;
};

export type ImageLightboxProps = ImageLightboxData & {
  onClose: () => void;
};

export function ImageLightbox({ imageUrl, alt, onClose }: ImageLightboxProps) {
  const [isClosing, setIsClosing] = useState(false);
  const requestClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
  }, [isClosing]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        requestClose();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [requestClose]);

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      requestClose();
    }
  };

  const handleAnimationEnd = (event: React.AnimationEvent<HTMLDivElement>) => {
    if (!isClosing) return;
    if (event.target !== event.currentTarget) return;
    onClose();
  };

  return (
    <div
      className={`modal-backdrop lightbox-backdrop${isClosing ? ' closing' : ''}`}
      role="dialog"
      aria-modal="true"
      onClick={handleBackdropClick}
      onAnimationEnd={handleAnimationEnd}
    >
      <div className={`modal-card lightbox-card${isClosing ? ' closing' : ''}`}>
        <div className="lightbox-body">
          <img src={imageUrl} alt={alt || 'Full size image'} className="lightbox-img" />
        </div>
        <div className="modal-actions">
          <button className="primary" type="button" onClick={requestClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
