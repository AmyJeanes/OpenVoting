import { useState } from 'react';
import { ImageLightbox, type ImageLightboxData } from '../ImageLightbox';
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
  if (hasCustomTitle) return entry.displayName;
  return 'Untitled entry';
}

export function MySubmissionsSection({ poll, entries, assetCache, entryAssetId, onAskDelete }: MySubmissionsSectionProps) {
  const [lightboxImage, setLightboxImage] = useState<ImageLightboxData | null>(null);
  return (
    <section className="card">
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
            <li key={e.id} className="entry-card">
              <div className="entry-head">
                <div>
                  <p className="entry-title">{titleText}</p>
                  {e.submittedByDisplayName && (
                    <p className="byline">
                      <span className="byline-label">By:</span>
                      <span className="byline-name">{e.submittedByDisplayName}</span>
                    </p>
                  )}
                  {e.description && <p className="muted">{e.description}</p>}
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
              {e.isDisqualified && <p className="error">Disqualified: {e.disqualificationReason ?? 'No reason provided'}</p>}
              <div className="actions my-entry-actions">
                <button type="button" className="ghost danger" onClick={() => onAskDelete(e.id)}>Delete</button>
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
