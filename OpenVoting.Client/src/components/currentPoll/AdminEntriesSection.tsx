import { useMemo, useState } from 'react';
import { ImageLightbox, type ImageLightboxData } from '../ImageLightbox';
import { MarkdownText } from '../MarkdownText';
import type { AssetUploadResponse, PollEntryResponse, PollResponse, PollWinnerResponse, VotingBreakdownEntry } from '../../types';

export type AdminEntriesSectionProps = {
  poll: PollResponse;
  winners: PollWinnerResponse[];
  irvVotesByEntryId: Map<string, number>;
  entries: PollEntryResponse[];
  entriesLoading: boolean;
  votingBreakdown: VotingBreakdownEntry[];
  votingBreakdownError: string | null;
  breakdownByEntryId: Map<string, VotingBreakdownEntry>;
  assetCache: Record<string, AssetUploadResponse>;
  entryAssetId: (entry: { publicAssetId?: string; originalAssetId?: string }) => string;
  onAskDisqualify: (entryId: string) => void;
  onRequalify: (entryId: string) => void;
  onAskDelete: (entryId: string) => void;
};

function entryTitle(poll: PollResponse, entry: PollEntryResponse) {
  const entryDisplayName = (entry.displayName || '').trim();
  const hasCustomTitle = entryDisplayName.length > 0;
  const pollTitle = (poll.title || '').trim();
  if (poll.titleRequirement === 0) return 'Entry';
  if (poll.titleRequirement === 1 && hasCustomTitle && pollTitle.length > 0 && entryDisplayName === pollTitle) return 'Entry';
  if (hasCustomTitle) return entry.displayName;
  return 'Untitled entry';
}

const RANK_COLORS = [
  'var(--rank-1, #3b82f6)',
  'var(--rank-2, #60a5fa)',
  'var(--rank-3, #93c5fd)',
  'var(--rank-4, #bfdbfe)',
  'var(--rank-5, #dbeafe)',
];

function RankDistributionBar({ rankCounts, totalVoters }: { rankCounts: { rank: number; votes: number }[]; totalVoters: number }) {
  if (rankCounts.length === 0 || totalVoters === 0) return null;
  const sorted = [...rankCounts].sort((a, b) => a.rank - b.rank);
  const totalRanked = sorted.reduce((sum, r) => sum + r.votes, 0);
  return (
    <div className="rank-distribution">
      <div className="rank-bar" title={sorted.map((r) => `#${r.rank}: ${r.votes}`).join(', ')}>
        {sorted.map((r) => {
          const pct = (r.votes / totalRanked) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={r.rank}
              className="rank-bar-segment"
              style={{
                width: `${pct}%`,
                backgroundColor: RANK_COLORS[r.rank - 1] ?? RANK_COLORS[RANK_COLORS.length - 1],
              }}
            />
          );
        })}
      </div>
      <div className="rank-legend">
        {sorted.map((r) => (
          <span key={r.rank} className="rank-legend-item">
            <span className="rank-legend-dot" style={{ backgroundColor: RANK_COLORS[r.rank - 1] ?? RANK_COLORS[RANK_COLORS.length - 1] }} />
            #{r.rank}: {r.votes}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AdminEntriesSection(props: AdminEntriesSectionProps) {
  const {
    poll,
    winners,
    irvVotesByEntryId,
    entries,
    entriesLoading,
    votingBreakdown,
    votingBreakdownError,
    breakdownByEntryId,
    assetCache,
    entryAssetId,
    onAskDisqualify,
    onRequalify,
    onAskDelete
  } = props;

  const showAdminBreakdown = poll.isAdmin && poll.status === 2;
  const [expanded, setExpanded] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<ImageLightboxData | null>(null);
  const handleToggle = () => setExpanded((v) => !v);

  const winnersById = useMemo(() => {
    const map = new Map<string, PollWinnerResponse>();
    for (const w of winners) map.set(w.entryId, w);
    return map;
  }, [winners]);

  const leaderboard = useMemo(() => {
    const withScores = entries.map((entry) => {
      const breakdown = breakdownByEntryId.get(entry.id);
      const score = poll.votingMethod === 2
        ? breakdown?.rankCounts.find((r) => r.rank === 1)?.votes ?? 0
        : breakdown?.approvals ?? 0;
      return { entry, breakdown, score };
    });

    return withScores.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(a.entry.createdAt).getTime() - new Date(b.entry.createdAt).getTime();
    });
  }, [breakdownByEntryId, entries, poll.votingMethod]);

  return (
    <section className={`card admin-card${expanded ? '' : ' collapsed'}`} data-testid="admin-entries-section">
      <button
        type="button"
        className="section-head admin-toggle"
        aria-expanded={expanded}
        onClick={handleToggle}
        data-testid="admin-entries-toggle"
      >
        <div>
          <p className="eyebrow">Entries</p>
          <h3>Admin view</h3>
        </div>
        <div className="actions">
          <span className="pill admin">Admin</span>
        </div>
      </button>
      <div className="admin-collapse">
        {entriesLoading && <p className="muted">Loading entries…</p>}
        {!entriesLoading && entries.length === 0 && <p className="muted">No entries are visible yet</p>}
        {showAdminBreakdown && !entriesLoading && entries.length > 0 && votingBreakdown.length === 0 && !votingBreakdownError && (
          <p className="muted">No votes recorded yet</p>
        )}
        {!entriesLoading && entries.length > 0 && (
          <ul className="entries entry-grid">
            {leaderboard.map(({ entry: e, breakdown }, idx) => {
              const showByline = !!e.submittedByDisplayName;
              const assetId = entryAssetId(e);
              const asset = assetCache[assetId];
              const originalUrl = e.originalAssetId ? assetCache[e.originalAssetId]?.url : undefined;
              const previewUrl = asset?.url;
              const fullImageUrl = previewUrl ? (originalUrl ?? previewUrl) : null;
              const rankCounts = breakdown?.rankCounts ?? [];
              const approvals = breakdown?.approvals ?? 0;
              const createdAtText = new Date(e.createdAt).toLocaleString();
              const positionLabel = `#${idx + 1}`;
              const winnerData = winnersById.get(e.id);
              const isIrvWinner = poll.votingMethod === 2 && !!winnerData;
              return (
                <li key={e.id} className={`entry-card with-bottom-actions ${e.isDisqualified ? 'unavailable' : ''}`} data-testid={`admin-entry-${e.id}`}>
                  <div className="entry-head">
                    <div className="entry-head-main">
                      <p className="entry-title">{entryTitle(poll, e)}</p>
                    </div>
                    <div className="badges admin-entry-badges">
                      <span className="pill subtle">{positionLabel}</span>
                      {isIrvWinner && <span className="pill winner">Projected winner</span>}
                    </div>
                  </div>
                  <div className="admin-entry-details">
                    {showByline && (
                      <p className="byline">
                        <span className="byline-label">By:</span>
                        <span className="byline-name">{e.submittedByDisplayName}</span>
                      </p>
                    )}
                    <p className="muted">Created {createdAtText}</p>
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
                  {e.description && <MarkdownText content={e.description} className="muted entry-description admin-entry-description" />}
                  {e.isDisqualified && (
                    <div className="disqualification-details">
                      <p className="error">Disqualified: {e.disqualificationReason ?? 'No reason provided'}</p>
                      {(e.disqualifiedByDisplayName || e.disqualifiedAt) && (
                        <p className="disqualification-meta">
                          Disqualified by {e.disqualifiedByDisplayName ?? 'unknown admin'}
                          {e.disqualifiedAt ? ` on ${new Date(e.disqualifiedAt).toLocaleString()}` : ''}
                        </p>
                      )}
                    </div>
                  )}
                  {showAdminBreakdown && !votingBreakdownError && (
                    <div className="admin-entry-breakdown">
                      {breakdown ? (
                        <>
                          <div className="actions">
                            {poll.votingMethod === 2 ? (
                              <span className="pill subtle">Projected votes: {irvVotesByEntryId.get(e.id) ?? '–'}</span>
                            ) : (
                              <span className="pill subtle">{approvals} people approved</span>
                            )}
                          </div>
                          {poll.votingMethod === 2 && rankCounts.length > 0 && (
                            <RankDistributionBar rankCounts={rankCounts} totalVoters={poll.totalVotes} />
                          )}
                          {poll.votingMethod === 2 && rankCounts.length === 0 && (
                            <p className="muted">No ranks submitted yet</p>
                          )}
                          {poll.votingMethod !== 2 && approvals === 0 && (
                            <p className="muted">No approvals yet</p>
                          )}
                        </>
                      ) : (
                        <p className="muted">No votes yet</p>
                      )}
                    </div>
                  )}

                  {poll.isAdmin && (
                    <div className="actions admin-entry-actions">
                      {e.isDisqualified ? (
                        <button type="button" className="ghost requalify" onClick={() => onRequalify(e.id)} data-testid={`admin-entry-requalify-${e.id}`}>Requalify</button>
                      ) : (
                        <button type="button" className="ghost danger" onClick={() => onAskDisqualify(e.id)} data-testid={`admin-entry-disqualify-${e.id}`}>Disqualify</button>
                      )}
                      <button type="button" className="ghost danger" onClick={() => onAskDelete(e.id)} data-testid={`admin-entry-delete-${e.id}`}>Delete</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
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
