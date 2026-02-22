import { useState } from 'react';
import type React from 'react';
import { ImageLightbox, type ImageLightboxData } from '../ImageLightbox';
import type { AssetUploadResponse, PollEntryResponse, PollResponse } from '../../types';

function rankingEntryTitle(poll: PollResponse, entry: PollEntryResponse) {
  const hasCustomTitle = (entry.displayName || '').trim().length > 0;
  if (hasCustomTitle) return entry.displayName;
  return poll.titleRequirement === 0 ? 'Entry' : 'Untitled entry';
}

export type RankingModalProps = {
  open: boolean;
  poll: PollResponse;
  rankedEntries: PollEntryResponse[];
  draggingId: string | null;
  dragOverId: string | null;
  dragOverAfter: boolean;
  hasRankChanges: boolean;
  voteSubmitting: boolean;
  hasExistingVote: boolean;
  assetCache: Record<string, AssetUploadResponse>;
  entryAssetId: (entry: { publicAssetId?: string; originalAssetId?: string }) => string;
  onBackToSelection: () => void;
  onSubmitRanks: () => void;
  onMoveRank: (entryId: string, direction: -1 | 1) => void;
  onDragStart: (entryId: string) => void;
  onDragOverItem: (ev: React.DragEvent<HTMLLIElement>, entryId: string) => void;
  onDropOnItem: (entryId: string) => void;
  onDragEnd: () => void;
  setItemRef: (entryId: string, node: HTMLLIElement | null) => void;
};

export function RankingModal(props: RankingModalProps) {
  const {
    open,
    poll,
    rankedEntries,
    draggingId,
    dragOverId,
    dragOverAfter,
    hasRankChanges,
    voteSubmitting,
    hasExistingVote,
    assetCache,
    entryAssetId,
    onBackToSelection,
    onSubmitRanks,
    onMoveRank,
    onDragStart,
    onDragOverItem,
    onDropOnItem,
    onDragEnd,
    setItemRef
  } = props;
  const [lightboxImage, setLightboxImage] = useState<ImageLightboxData | null>(null);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onBackToSelection()}>
      <div className="modal-card wide ranking-modal-card">
        <div className="ranking-modal-head">
          <p className="eyebrow">Vote: Step 2</p>
          <h3>Order your selections</h3>
          <p className="muted">
            Drag to reorder. Your #1 is your first choice; if it drops out, your vote moves to your next ranked pick
          </p>
        </div>
        <div className="ranking-modal-scroll">
          {rankedEntries.length === 0 && <p className="muted">No selections yet</p>}
          {rankedEntries.length > 0 && (
            <ul className="rank-list">
              {rankedEntries.map((e, idx) => {
                const titleText = rankingEntryTitle(poll, e);
                const assetId = entryAssetId(e);
                const asset = assetId ? assetCache[assetId] : undefined;
                const originalUrl = e.originalAssetId ? assetCache[e.originalAssetId]?.url : undefined;
                const previewUrl = asset?.url;
                const fullImageUrl = previewUrl ? (originalUrl ?? previewUrl) : null;

                return (
                  <li
                    key={e.id}
                    className={`rank-item${draggingId === e.id ? ' dragging' : ''}${dragOverId === e.id ? ' drop-target' : ''}${dragOverId === e.id && dragOverAfter ? ' drop-after' : ''}`}
                    ref={(node) => setItemRef(e.id, node)}
                    draggable
                    onDragStart={() => onDragStart(e.id)}
                    onDragOver={(ev) => onDragOverItem(ev, e.id)}
                    onDrop={() => onDropOnItem(e.id)}
                    onDragEnd={onDragEnd}
                  >
                    <div className="rank-controls">
                      <span className="rank-number">#{idx + 1}</span>
                      <div className="rank-actions">
                        <button
                          className="ghost"
                          onClick={() => onMoveRank(e.id, -1)}
                          aria-label={`Move ${titleText} up`}
                          disabled={idx === 0}
                        >
                          ↑
                        </button>
                        <button
                          className="ghost"
                          onClick={() => onMoveRank(e.id, 1)}
                          aria-label={`Move ${titleText} down`}
                          disabled={idx === rankedEntries.length - 1}
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                    <div className="rank-body">
                      <div className="rank-title">{titleText}</div>
                      {e.description && <p className="muted rank-description">{e.description}</p>}
                    </div>
                    {previewUrl && (
                      <button
                        type="button"
                        className="rank-img-button"
                        title="View full image"
                        onMouseDown={(ev) => ev.stopPropagation()}
                        onDragStart={(ev) => ev.preventDefault()}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setLightboxImage({ imageUrl: fullImageUrl ?? previewUrl, originalUrl, alt: titleText });
                        }}
                      >
                        <img
                          src={previewUrl}
                          alt={titleText}
                          className="rank-img"
                          draggable={false}
                        />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="modal-actions">
          <button className="ghost" onClick={onBackToSelection} disabled={voteSubmitting}>Back to selection</button>
          <button className="primary" onClick={onSubmitRanks} disabled={voteSubmitting || (poll.requireRanking && !hasRankChanges)}>
            {voteSubmitting ? 'Submitting…' : hasExistingVote ? 'Update vote' : 'Submit vote'}
          </button>
        </div>
        {lightboxImage && (
          <ImageLightbox
            imageUrl={lightboxImage.imageUrl}
            originalUrl={lightboxImage.originalUrl}
            alt={lightboxImage.alt}
            onClose={() => setLightboxImage(null)}
          />
        )}
      </div>
    </div>
  );
}
