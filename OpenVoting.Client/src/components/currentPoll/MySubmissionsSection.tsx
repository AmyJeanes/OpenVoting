import { useState } from 'react';
import { ImageLightbox, type ImageLightboxData } from '../ImageLightbox';
import { MarkdownText } from '../MarkdownText';
import type { AssetUploadResponse, PollEntryResponse, PollResponse } from '../../types';

export type MySubmissionsSectionProps = {
  poll: PollResponse;
  entries: PollEntryResponse[];
  assetCache: Record<string, AssetUploadResponse>;
  entryAssetId: (entry: { publicAssetId?: string; originalAssetId?: string }) => string;
  onAskDelete: (entryId: string) => void;
};

function entryTitle(poll: PollResponse, entry: PollEntryResponse) {
  const hasCustomTitle = (entry.displayName || '').trim().length > 0;
  if (poll.titleRequirement === 0) return 'Entry';
  if (poll.titleRequirement === 1 && (entry.displayName || '').trim() === (poll.title || '').trim()) return 'Entry';
  if (hasCustomTitle) return entry.displayName;
  return 'Untitled entry';
}

export function MySubmissionsSection({ poll, entries, assetCache, entryAssetId, onAskDelete }: MySubmissionsSectionProps) {
  const [lightboxImage, setLightboxImage] = useState<ImageLightboxData | null>(null);
  return (
    <section className="card personal-card" data-testid="my-submissions-section">
      <div className="section-head">
        <h3>Your submissions</h3>
        <p className="muted">Only visible to you</p>
      </div>
      <ul className="entries entry-grid">
        {entries.map((e) => {
          const assetId = e.originalAssetId || entryAssetId(e);
          const asset = assetCache[assetId];
          const originalUrl = e.originalAssetId ? assetCache[e.originalAssetId]?.url : undefined;
          const previewUrl = asset?.url;
          const fullImageUrl = previewUrl ? (originalUrl ?? previewUrl) : null;
          const titleText = entryTitle(poll, e);
          return (
            <li key={e.id} className={`entry-card with-bottom-actions ${e.isDisqualified ? 'unavailable' : ''}`} data-testid={`my-submission-${e.id}`}>
              <div className="entry-head">
                <div className="entry-meta">
                  <p className="entry-title">{titleText}</p>
                </div>
              </div>
              {previewUrl && (
                <button
                  type="button"
                  className="entry-img-button"
                  title="View full image"
                  onClick={() => setLightboxImage({ imageUrl: fullImageUrl ?? previewUrl, originalUrl, alt: e.displayName })}
                >
                  <img src={previewUrl} alt={e.displayName || 'Entry image'} className="entry-img" />
                </button>
              )}
              {e.description && <MarkdownText content={e.description} className="muted entry-description" />}
              {e.isDisqualified && <p className="error">Disqualified: {e.disqualificationReason ?? 'No reason provided'}</p>}
              <div className="actions my-entry-actions">
                <button type="button" className="ghost danger" onClick={() => onAskDelete(e.id)} data-testid={`my-submission-delete-${e.id}`}>Delete</button>
              </div>
            </li>
          );
        })}
      </ul>
      {lightboxImage && (
        <ImageLightbox
          imageUrl={lightboxImage.imageUrl}
          originalUrl={lightboxImage.originalUrl}
          alt={lightboxImage.alt}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </section>
  );
}
