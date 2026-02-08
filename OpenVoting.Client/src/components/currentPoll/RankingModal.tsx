import type React from 'react';
import type { AssetUploadResponse, PollEntryResponse, PollResponse } from '../../types';

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
  entryAssetId: (entry: { publicAssetId?: string; originalAssetId?: string; teaserAssetId?: string }) => string;
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

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onBackToSelection()}>
      <div className="modal-card wide">
        <p className="eyebrow">Vote — Step 2</p>
        <h3>Order your selections</h3>
        <p className="muted">
          Drag to reorder. Your #1 is your first choice; if it drops out, your vote moves to your next ranked pick.
        </p>
        {rankedEntries.length === 0 && <p className="muted">No selections yet.</p>}
        {rankedEntries.length > 0 && (
          <ul className="rank-list">
            {rankedEntries.map((e, idx) => (
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
                  <span className="drag-handle" aria-hidden="true">↕</span>
                  <div className="rank-actions">
                    <button
                      className="ghost"
                      onClick={() => onMoveRank(e.id, -1)}
                      aria-label={`Move ${e.displayName} up`}
                      disabled={idx === 0}
                    >
                      ↑
                    </button>
                    <button
                      className="ghost"
                      onClick={() => onMoveRank(e.id, 1)}
                      aria-label={`Move ${e.displayName} down`}
                      disabled={idx === rankedEntries.length - 1}
                    >
                      ↓
                    </button>
                  </div>
                </div>
                <div className="rank-body">
                  <div className="rank-title">#{idx + 1} · {e.displayName}</div>
                  {e.submittedByDisplayName && <p className="muted">By {e.submittedByDisplayName}</p>}
                </div>
                {(() => {
                  const assetId = entryAssetId(e);
                  const asset = assetId ? assetCache[assetId] : undefined;
                  return asset?.url ? (
                    <img
                      src={asset.url}
                      alt={e.displayName}
                      className="rank-img"
                    />
                  ) : null;
                })()}
              </li>
            ))}
          </ul>
        )}
        <div className="modal-actions">
          <button className="ghost" onClick={onBackToSelection} disabled={voteSubmitting}>Back to selection</button>
          <button className="primary" onClick={onSubmitRanks} disabled={voteSubmitting || (poll.requireRanking && !hasRankChanges)}>
            {voteSubmitting ? 'Submitting…' : hasExistingVote ? 'Update vote' : 'Submit vote'}
          </button>
        </div>
      </div>
    </div>
  );
}
