import { useState } from 'react';
import { ImageLightbox, type ImageLightboxData } from '../ImageLightbox';
import type { AssetUploadResponse, PollEntryResponse, PollResponse, VoteResponse } from '../../types';

export type VotingSectionProps = {
  poll: PollResponse;
  entries: PollEntryResponse[];
  voteState: Record<string, { selected: boolean; rank: string }>;
  voteSubmitting: boolean;
  voteInfo: VoteResponse | null;
  assetCache: Record<string, AssetUploadResponse>;
  isRankedMethod: boolean;
  entryAssetId: (entry: { publicAssetId?: string; originalAssetId?: string }) => string;
  onToggleSelection: (entryId: string, selected: boolean) => void;
  onDisqualifiedSelectAttempt: (entry: PollEntryResponse) => void;
  onProceedToRanking: () => void;
  onSubmitVote: () => void;
  onClearSelection: () => void;
};

function entryTitle(poll: PollResponse, entry: PollEntryResponse) {
  const hasCustomTitle = (entry.displayName || '').trim().length > 0;
  if (poll.titleRequirement === 0) {
    return 'Entry';
  }
  if (hasCustomTitle) return entry.displayName;
  return 'Untitled entry';
}

export function VotingSection(props: VotingSectionProps) {
  const {
    poll,
    entries,
    voteState,
    voteSubmitting,
    voteInfo,
    assetCache,
    isRankedMethod,
    entryAssetId,
    onToggleSelection,
    onDisqualifiedSelectAttempt,
    onProceedToRanking,
    onSubmitVote,
    onClearSelection
  } = props;
  const [lightboxImage, setLightboxImage] = useState<ImageLightboxData | null>(null);

  return (
    <section className="card">
      <div className="section-head">
        <h3>{isRankedMethod ? 'Vote: Step 1' : 'Vote'}</h3>
        <p className="muted">
          {isRankedMethod
            ? `Select up to ${poll.maxSelections} entries you want to see win. You’ll rank them next; unranked entries won’t count`
            : `Select up to ${poll.maxSelections} entries`}
        </p>
      </div>
      <div className="vote-grid">
        {entries.map((e) => {
          const current = voteState[e.id] ?? { selected: false, rank: '' };
          const assetId = entryAssetId(e);
          const asset = assetCache[assetId];
          const originalUrl = e.originalAssetId ? assetCache[e.originalAssetId]?.url : undefined;
          const previewUrl = asset?.url;
          const fullImageUrl = previewUrl ? (originalUrl ?? previewUrl) : null;
          const isSelected = current.selected;
          const isUnavailable = e.isDisqualified;
          const tryToggle = (selected: boolean) => {
            if (!isSelected && selected && isUnavailable) {
              onDisqualifiedSelectAttempt(e);
              return;
            }
            onToggleSelection(e.id, selected);
          };
          return (
            <div
              key={e.id}
              className={`entry-card vote-card ${isSelected ? 'selected' : ''} ${isUnavailable ? 'unavailable' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => tryToggle(!isSelected)}
              onKeyDown={(ev) => {
                if (ev.key === ' ' || ev.key === 'Enter') {
                  ev.preventDefault();
                  tryToggle(!isSelected);
                }
              }}
            >
              <div className="vote-head">
                <label className="check-row" onClick={(ev) => {
                  if (!isUnavailable) {
                    ev.stopPropagation();
                  }
                }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isUnavailable}
                    aria-disabled={isUnavailable}
                    title={isUnavailable ? 'Unavailable' : undefined}
                    onClick={(ev) => ev.stopPropagation()}
                    onChange={(ev) => tryToggle(ev.target.checked)}
                  />
                  <span className="entry-title">{entryTitle(poll, e)}</span>
                </label>
              </div>
              {previewUrl && (
                <button
                  type="button"
                  className="entry-img-button"
                  title="View full image"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setLightboxImage({ imageUrl: fullImageUrl ?? previewUrl, originalUrl, alt: e.displayName });
                  }}
                >
                  <img src={previewUrl} alt={e.displayName} className="entry-img" />
                </button>
              )}
              {e.description && <p className="muted">{e.description}</p>}
              {e.isDisqualified && <p className="error">Disqualified: {e.disqualificationReason ?? 'No reason provided'}</p>}
            </div>
          );
        })}
      </div>
      <div className="actions">
        {isRankedMethod ? (
          <>
            <button className="primary" onClick={onProceedToRanking} disabled={voteSubmitting}>
              Continue to ranking
            </button>
            <button className="ghost" onClick={onClearSelection} disabled={voteSubmitting}>Clear selection</button>
          </>
        ) : (
          <button className="primary" onClick={onSubmitVote} disabled={voteSubmitting}>
            {voteSubmitting ? 'Submitting…' : 'Submit vote'}
          </button>
        )}
      </div>
      {voteInfo && (
        <p className="muted">Last submitted: {voteInfo.submittedAt ? new Date(voteInfo.submittedAt).toLocaleString() : 'Pending'}</p>
      )}
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
