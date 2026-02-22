import { useCallback, useEffect, useState, type MouseEvent, type SyntheticEvent } from 'react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

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
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number } | null>(null);
  useBodyScrollLock(true);

  const updateDisplaySize = useCallback((width: number, height: number) => {
    const maxWidth = Math.min(window.innerWidth - 96, 980);
    const maxHeight = window.innerHeight - 148;
    const ratio = width / height;

    let displayWidth = maxWidth;
    let displayHeight = displayWidth / ratio;

    if (displayHeight > maxHeight) {
      displayHeight = maxHeight;
      displayWidth = displayHeight * ratio;
    }

    setDisplaySize({
      width: Math.round(displayWidth),
      height: Math.round(displayHeight)
    });
  }, []);

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

  useEffect(() => {
    if (!naturalSize) return;

    const handleResize = () => updateDisplaySize(naturalSize.width, naturalSize.height);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [naturalSize, updateDisplaySize]);

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

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    const width = image.naturalWidth;
    const height = image.naturalHeight;

    if (width <= 0 || height <= 0) return;

    setNaturalSize({ width, height });
    updateDisplaySize(width, height);
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
          <img
            src={imageUrl}
            alt={alt || 'Full size image'}
            className="lightbox-img"
            onLoad={handleImageLoad}
            style={displaySize ? { width: `${displaySize.width}px`, height: `${displaySize.height}px` } : undefined}
          />
        </div>
        <div className="modal-actions">
          <button className="primary" type="button" onClick={requestClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
