import { useState } from 'react';
import { ImageLightbox, type ImageLightboxData } from '../ImageLightbox';
import { MarkdownText } from '../MarkdownText';
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
  const entryDisplayName = (entry.displayName || '').trim();
  const hasCustomTitle = entryDisplayName.length > 0;
  const pollTitle = (poll.title || '').trim();
  if (poll.titleRequirement === 0) {
    return 'Entry';
  }
  if (poll.titleRequirement === 1 && hasCustomTitle && pollTitle.length > 0 && entryDisplayName === pollTitle) {
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
  const hasSubmittedVote = !!voteInfo;
  const submittedAtLabel = voteInfo?.submittedAt ? new Date(voteInfo.submittedAt).toLocaleString() : 'Pending';
  const ineligibleReason = poll.ineligibleToVoteReason;

  return (
    <section className="card" data-testid="voting-section">
      <div className="section-head">
        <h3>{isRankedMethod ? 'Vote: Step 1' : 'Vote'}</h3>
        <p className="muted">
          {isRankedMethod
            ? `Select up to ${poll.maxSelections} entries to rank in the next step`
            : `Select up to ${poll.maxSelections} entries`}
        </p>
      </div>
      {ineligibleReason && (
        <div className="banner error ineligible-notice" role="status" data-testid="vote-ineligible-banner">
          Not eligible to vote: {ineligibleReason}
        </div>
      )}
      {hasSubmittedVote && (
        <div className="banner vote-status-banner personal-card" role="status" aria-live="polite" data-testid="vote-status-banner">
          <div className="vote-status-head">
            <p className="vote-status-title">You have voted</p>
            <span className="pill winner">Saved</span>
          </div>
          <p className="vote-status-meta">Last submitted: {submittedAtLabel}</p>
          <p className="muted">You can still change your selection and submit again before voting closes</p>
        </div>
      )}
      <div className="vote-grid">
        {entries.map((e) => {
          const current = voteState[e.id] ?? { selected: false, rank: '' };
          const assetId = entryAssetId(e);
          const asset = assetCache[assetId];
          const originalUrl = e.originalAssetId ? assetCache[e.originalAssetId]?.url : undefined;
          const previewUrl = asset?.url;
          const fullImageUrl = previewUrl ? (originalUrl ?? previewUrl) : null;
          const isSelected = current.selected;
          const isUnavailable = e.isDisqualified || !!ineligibleReason;
          const tryToggle = (selected: boolean) => {
            if (ineligibleReason) return;
            if (!isSelected && selected && e.isDisqualified) {
              onDisqualifiedSelectAttempt(e);
              return;
            }
            onToggleSelection(e.id, selected);
          };
          return (
            <div
              key={e.id}
              className={`entry-card vote-card ${isSelected ? 'selected' : ''} ${isUnavailable ? 'unavailable' : ''}`}
              role={ineligibleReason ? undefined : 'button'}
              tabIndex={ineligibleReason ? undefined : 0}
              data-testid={`vote-entry-${e.id}`}
              onClick={ineligibleReason ? undefined : () => tryToggle(!isSelected)}
              onKeyDown={ineligibleReason ? undefined : (ev) => {
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
                    className={isUnavailable ? 'unavailable-checkbox' : undefined}
                    checked={isSelected}
                    disabled={isUnavailable}
                    aria-disabled={isUnavailable}
                    title={isUnavailable ? 'Unavailable' : undefined}
                    onClick={(ev) => ev.stopPropagation()}
                    onChange={(ev) => tryToggle(ev.target.checked)}
                    data-testid={`vote-checkbox-${e.id}`}
                  />
                  <span className="entry-title">{entryTitle(poll, e)}</span>
                </label>
              </div>
              {previewUrl && (
                <button
                  type="button"
                  className="entry-img-button"
                  title="View full image"
                  data-testid={`vote-entry-image-${e.id}`}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setLightboxImage({ imageUrl: fullImageUrl ?? previewUrl, originalUrl, alt: e.displayName });
                  }}
                >
                  <img src={previewUrl} alt={e.displayName} className="entry-img" />
                </button>
              )}
              {e.description && <MarkdownText content={e.description} className="muted entry-description" />}
              {e.isDisqualified && <p className="error">Disqualified: {e.disqualificationReason ?? 'No reason provided'}</p>}
            </div>
          );
        })}
      </div>
      <div className="actions">
        {isRankedMethod ? (
          <>
            <button className="primary" onClick={onProceedToRanking} disabled={voteSubmitting || !!ineligibleReason}>
              Continue to ranking
            </button>
            <button className="ghost" onClick={onClearSelection} disabled={voteSubmitting || !!ineligibleReason} data-testid="vote-clear-selection-button">Clear selection</button>
          </>
        ) : (
          <button className="primary" onClick={onSubmitVote} disabled={voteSubmitting || !!ineligibleReason} data-testid="vote-submit-button">
            {voteSubmitting ? 'Submitting…' : 'Submit vote'}
          </button>
        )}
      </div>
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
