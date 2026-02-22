import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AuthPrompt } from './AuthPrompt';
import type { AssetUploadResponse, PollDetailResponse, PollWinnerResponse, SessionState } from '../types';
import { formatWindow, pollStatusLabel, votingMethodLabel } from '../utils/format';

export type PollDetailPageProps = {
  sessionState: SessionState;
  fetchDetail: (id: string) => Promise<PollDetailResponse>;
  assetCache: Record<string, AssetUploadResponse>;
};

export function PollDetailPage({ sessionState, fetchDetail, assetCache }: PollDetailPageProps) {
  const { pollId } = useParams();
  const [detail, setDetail] = useState<PollDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pollId) return;
    let active = true;
    setLoading(true);
    setError(null);
    fetchDetail(pollId)
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load poll');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchDetail, pollId]);

  if (sessionState !== 'authenticated') {
    return <AuthPrompt />;
  }

  if (!pollId) {
    return (
      <section className="card">
        <p className="error">No poll id provided</p>
          <Link className="ghost" to="/polls/history">Back to history</Link>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="card">
        <p className="muted">Loading poll…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card">
        <p className="error">{error}</p>
          <Link className="ghost" to="/polls/history">Back to history</Link>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="card">
        <p className="muted">No poll found</p>
          <Link className="ghost" to="/polls/history">Back to history</Link>
      </section>
    );
  }

  const isTie = detail.winners.length > 1 && detail.winners.every((w) => w.votes === detail.winners[0].votes);

  const winnerTitle = (winner: PollWinnerResponse) => {
    const hasCustomTitle = (winner.displayName || '').trim().length > 0;
    if (hasCustomTitle) return winner.displayName;
    return detail.titleRequirement === 0 ? 'Entry' : 'Untitled entry';
  };

  const entryTitle = (entry: PollDetailResponse['entries'][number]) => {
    const hasCustomTitle = (entry.displayName || '').trim().length > 0;
    if (detail.titleRequirement === 0) {
      if (entry.submittedByDisplayName) return 'Entry';
      return '';
    }
    if (hasCustomTitle) return entry.displayName;
    return 'Untitled entry';
  };

  return (
    <div className="stack">
      <section className="card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Poll details</p>
            <h2>{detail.title}</h2>
            {detail.description && <p className="muted">{detail.description}</p>}
          </div>
          <div className="actions">
            <span className="pill subtle">{votingMethodLabel(detail.votingMethod)}</span>
            <span className="pill">{pollStatusLabel(detail.status)}</span>
          </div>
        </div>
        <div className="details-grid">
          <div>
            <p className="muted">Submissions</p>
            <p className="metric">{formatWindow(detail.submissionOpensAt, detail.submissionClosesAt)}</p>
          </div>
          <div>
            <p className="muted">Voting</p>
            <p className="metric">{formatWindow(detail.votingOpensAt, detail.votingClosesAt)}</p>
          </div>
          <div>
            <p className="muted">Selections</p>
            <p className="metric">Up to {detail.maxSelections}</p>
          </div>
          <div>
            <p className="muted">Visibility</p>
            <p className="metric">{detail.hideEntriesUntilVoting ? 'Hidden until voting' : 'Entries visible'}</p>
          </div>
        </div>
        {detail.winners.length > 0 && (
          <div className="winners">
            {isTie && (
              <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="pill subtle">Tie</span>
                <span>{detail.winners.length} winners tied for first place</span>
              </div>
            )}
            {detail.winners.map((w) => {
              const titleText = winnerTitle(w);
              const subtitleName = w.submittedByDisplayName;
              return (
                <div key={w.entryId} className="winner-chip">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="pill subtle">#1</span>
                    {isTie && <span className="pill subtle">Tie</span>}
                    <strong>{titleText}</strong>
                    <span className="muted"> · {w.votes} vote{w.votes === 1 ? '' : 's'}</span>
                  </div>
                  {subtitleName && (
                    <div className="byline">
                      <span className="byline-label">By:</span>
                      <span className="byline-name">{subtitleName}</span>
                    </div>
                  )}
                  {w.assetId && assetCache[w.assetId]?.url && (
                    <img src={assetCache[w.assetId]!.url} alt={titleText} className="winner-img" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Entries</p>
            <h3>Full breakdown</h3>
          </div>
            <Link className="ghost" to="/polls/history">Back to history</Link>
        </div>
        {detail.entries.length === 0 && <p className="muted">No entries recorded</p>}
        {detail.entries.length > 0 && (
          <ul className="entries entry-grid">
            {detail.entries.map((e) => {
              const assetId = e.publicAssetId ?? e.originalAssetId ?? '';
              const asset = assetCache[assetId];
              const positionLabel = isTie && e.isWinner ? '#1' : (typeof e.position === 'number' ? `#${e.position}` : null);
              const titleText = entryTitle(e);
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
                    </div>
                    <div className="badges">
                      {positionLabel && <span className="pill subtle">{positionLabel}</span>}
                      {isTie && e.isWinner && <span className="pill subtle">Tie</span>}
                      {e.isWinner && <span className="pill">Winner</span>}
                    </div>
                  </div>
                  {asset?.url && <img src={asset.url} alt={e.displayName} className="entry-img" />}
                  <p className="muted">{e.description}</p>
                  <div className="actions entry-breakdown-summary">
                    <span className="pill subtle">{detail.votingMethod === 2 ? `${e.rankCounts.find((r) => r.rank === 1)?.votes ?? 0} first-choice` : `${e.approvalVotes} approvals`}</span>
                  </div>
                  {detail.votingMethod === 2 && e.rankCounts.length > 0 && (
                    <div className="muted">
                      {e.rankCounts.map((r) => (
                        <span key={r.rank} className="pill subtle">Rank {r.rank}: {r.votes}</span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
