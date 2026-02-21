import { useMemo, useState } from 'react';
import { ImageLightbox, type ImageLightboxData } from '../ImageLightbox';
import type { AssetUploadResponse, PollEntryResponse, PollResponse, VotingBreakdownEntry } from '../../types';

export type AdminEntriesSectionProps = {
  poll: PollResponse;
  entries: PollEntryResponse[];
  entriesLoading: boolean;
  votingBreakdown: VotingBreakdownEntry[];
  votingBreakdownError: string | null;
  breakdownByEntryId: Map<string, VotingBreakdownEntry>;
  assetCache: Record<string, AssetUploadResponse>;
  entryAssetId: (entry: { publicAssetId?: string; originalAssetId?: string; teaserAssetId?: string }) => string;
  onAskDisqualify: (entryId: string) => void;
  onRequalify: (entryId: string) => void;
  onAskDelete: (entryId: string) => void;
};

function entryTitle(poll: PollResponse, entry: PollEntryResponse) {
  const hasCustomTitle = (entry.displayName || '').trim().length > 0;
  if (poll.titleRequirement === 0) return 'Entry';
  if (hasCustomTitle) return entry.displayName;
  return 'Untitled entry';
}

export function AdminEntriesSection(props: AdminEntriesSectionProps) {
  const {
    poll,
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
    <section className={`card admin-card${expanded ? '' : ' collapsed'}`}>
      <button
        type="button"
        className="section-head admin-toggle"
        aria-expanded={expanded}
        onClick={handleToggle}
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
            {leaderboard.map(({ entry: e, breakdown, score }, idx) => {
              const showByline = !!e.submittedByDisplayName;
              const assetId = entryAssetId(e);
              const asset = assetCache[assetId];
              const originalUrl = e.originalAssetId ? assetCache[e.originalAssetId]?.url : undefined;
              const previewUrl = asset?.url;
              const fullImageUrl = previewUrl ? (originalUrl ?? previewUrl) : null;
              const rankCounts = breakdown?.rankCounts ?? [];
              const firstChoice = rankCounts.find((r) => r.rank === 1)?.votes ?? 0;
              const approvals = breakdown?.approvals ?? 0;
              const createdAtText = new Date(e.createdAt).toLocaleString();
              const positionLabel = `#${idx + 1}`;
              const topScore = leaderboard[0]?.score ?? 0;
              const isProjectedWinner = showAdminBreakdown && topScore > 0 && score === topScore;
              return (
                <li key={e.id} className="entry-card">
                  <div className="entry-head">
                    <div className="entry-head-main">
                      <p className="entry-title">{entryTitle(poll, e)}</p>
                      {e.description && <p className="muted">{e.description}</p>}
                      {showByline && (
                        <p className="byline">
                          <span className="byline-label">By:</span>
                          <span className="byline-name">{e.submittedByDisplayName}</span>
                        </p>
                      )}
                      <p className="muted">Created {createdAtText}</p>
                    </div>
                    <div className="badges">
                      <span className="pill subtle">{positionLabel}</span>
                      {isProjectedWinner && <span className="pill winner">Projected winner</span>}
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
                  {e.isDisqualified && (
                    <div className="disqualification-details">
                      <p className="error">Disqualified: {e.disqualificationReason ?? 'No reason provided'}</p>
                      {(e.disqualifiedByDisplayName || e.disqualifiedAt) && (
                        <p className="muted">
                          <span className="byline">
                            <span className="byline-label">By:</span>
                            <span className="byline-name">{e.disqualifiedByDisplayName ?? 'unknown admin'}</span>
                          </span>
                          {e.disqualifiedAt ? ` on ${new Date(e.disqualifiedAt).toLocaleString()}` : ''}
                        </p>
                      )}
                    </div>
                  )}
                  {showAdminBreakdown && !votingBreakdownError && (
                    <div>
                      {breakdown ? (
                        <>
                          <div className="actions">
                            {poll.votingMethod === 2 ? (
                              <span className="pill subtle">{firstChoice} people ranked this #1</span>
                            ) : (
                              <span className="pill subtle">{approvals} people approved</span>
                            )}
                            <span className="pill compact subtle">Score: {score}</span>
                          </div>
                          {poll.votingMethod === 2 && rankCounts.length > 0 && (
                            <div className="muted" style={{ marginTop: 6, marginBottom: 12 }}>
                              <span style={{ fontWeight: 600, marginRight: 6 }}>How people ranked this:</span>
                              <ul style={{ display: 'inline', padding: 0, margin: 0, listStyle: 'none' }}>
                                {rankCounts.map((r) => (
                                  <li key={r.rank} style={{ display: 'inline', marginRight: 8 }}>
                                    <span className="pill subtle">#{r.rank}: {r.votes}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
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
                    <div className="actions">
                      {e.isDisqualified ? (
                        <button type="button" className="ghost" onClick={() => onRequalify(e.id)}>Requalify</button>
                      ) : (
                        <button type="button" className="ghost danger" onClick={() => onAskDisqualify(e.id)}>Disqualify</button>
                      )}
                      <button type="button" className="ghost danger" onClick={() => onAskDelete(e.id)}>Delete</button>
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
