import type { AssetUploadResponse, PollEntryResponse, PollResponse, VoteResponse } from '../../types';

export type VotingSectionProps = {
  poll: PollResponse;
  entries: PollEntryResponse[];
  voteState: Record<string, { selected: boolean; rank: string }>;
  voteSubmitting: boolean;
  voteInfo: VoteResponse | null;
  assetCache: Record<string, AssetUploadResponse>;
  isRankedMethod: boolean;
  entryAssetId: (entry: { publicAssetId?: string; originalAssetId?: string; teaserAssetId?: string }) => string;
  onToggleSelection: (entryId: string, selected: boolean) => void;
  onProceedToRanking: () => void;
  onSubmitVote: () => void;
  onClearSelection: () => void;
};

function entryTitle(poll: PollResponse, entry: PollEntryResponse) {
  const hasCustomTitle = (entry.displayName || '').trim().length > 0;
  if (poll.titleRequirement === 0) {
    if (poll.isAdmin && entry.submittedByDisplayName) return `From ${entry.submittedByDisplayName}`;
    return '';
  }
  if (hasCustomTitle) return entry.displayName;
  return entry.submittedByDisplayName ? `By ${entry.submittedByDisplayName}` : 'Untitled entry';
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
    onProceedToRanking,
    onSubmitVote,
    onClearSelection
  } = props;

  return (
    <section className="card">
      <div className="section-head">
        <h3>{isRankedMethod ? 'Vote — Step 1: select entries' : 'Vote'}</h3>
        <p className="muted">
          {isRankedMethod
            ? `Select up to ${poll.maxSelections} entries you want to see win. You’ll rank them next; unranked entries won’t count.`
            : `Select up to ${poll.maxSelections} entries.`}
        </p>
      </div>
      <div className="vote-grid">
        {entries.map((e) => {
          const current = voteState[e.id] ?? { selected: false, rank: '' };
          const assetId = entryAssetId(e);
          const asset = assetCache[assetId];
          const isSelected = current.selected;
          return (
            <div
              key={e.id}
              className={`entry-card vote-card ${isSelected ? 'selected' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => onToggleSelection(e.id, !isSelected)}
              onKeyDown={(ev) => {
                if (ev.key === ' ' || ev.key === 'Enter') {
                  ev.preventDefault();
                  onToggleSelection(e.id, !isSelected);
                }
              }}
            >
              <div className="vote-head">
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onClick={(ev) => ev.stopPropagation()}
                    onChange={(ev) => onToggleSelection(e.id, ev.target.checked)}
                  />
                  <span className="entry-title">{entryTitle(poll, e)}</span>
                </label>
                {e.submittedByDisplayName && poll.titleRequirement !== 0 && <span className="muted">By {e.submittedByDisplayName}</span>}
              </div>
              {asset?.url && <img src={asset.url} alt={e.displayName} className="entry-img" />}
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
    </section>
  );
}
