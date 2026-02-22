import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { AuthPrompt } from './AuthPrompt';
import { VotingMethodInfo } from './VotingMethodInfo';
import { useToast } from './useToast';
import type { AssetUploadResponse, PollHistoryResponse, SessionState } from '../types';
import { votingMethodLabel } from '../utils/format';

export type HistoryProps = {
  sessionState: SessionState;
  history: PollHistoryResponse[];
  historyError: string | null;
  assetCache: Record<string, AssetUploadResponse>;
  onRefresh: () => void;
  onLogin: () => void;
  loginCta: string;
  loginDisabled: boolean;
};

export function HistoryPage({ sessionState, history, historyError, assetCache, onRefresh, onLogin, loginCta, loginDisabled }: HistoryProps) {
  const { showToast } = useToast();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredHistory = normalizedSearch.length === 0
    ? history
    : history.filter((poll) => `${poll.title} ${poll.description ?? ''}`.toLowerCase().includes(normalizedSearch));

  useEffect(() => {
    if (historyError) showToast(historyError, { tone: 'error' });
  }, [historyError, showToast]);

  useEffect(() => {
    if (searchExpanded) {
      searchInputRef.current?.focus();
    }
  }, [searchExpanded]);

  if (sessionState !== 'authenticated') {
    return <AuthPrompt onLogin={onLogin} loginCta={loginCta} loginDisabled={loginDisabled} />;
  }
  const winnerTitle = (winner: PollHistoryResponse['winners'][number]) => {
    const hasTitle = (winner.displayName || '').trim().length > 0;
    if (hasTitle) return winner.displayName;
    if (winner.submittedByDisplayName) return winner.submittedByDisplayName;
    return 'Untitled entry';
  };

  const winnerUser = (winner: PollHistoryResponse['winners'][number]) => winner.submittedByDisplayName || winner.displayName || 'Anonymous';

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Archive</p>
          <h2>Past polls</h2>
        </div>
        <div className="section-head-controls">
          <div className={`poll-search-shell${searchExpanded ? ' expanded' : ''}`}>
            <div className="poll-search-input-wrap">
              <input
                ref={searchInputRef}
                type="text"
                className="poll-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search polls"
                aria-label="Search past polls"
                aria-hidden={!searchExpanded}
                disabled={!searchExpanded}
              />
            </div>
            <button
              className="ghost search-toggle"
              onClick={() => {
                if (searchExpanded) {
                  setSearchTerm('');
                }
                setSearchExpanded((value) => !value);
              }}
              aria-expanded={searchExpanded}
              aria-label={searchExpanded ? 'Close search' : 'Open search'}
            >
              <svg className="poll-search-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <circle cx="7" cy="7" r="4" />
                <line x1="10.3" y1="10.3" x2="14" y2="14" />
              </svg>
            </button>
          </div>
          <button className="ghost" onClick={onRefresh}>Refresh</button>
        </div>
      </div>
      {history.length === 0 && !historyError && <p className="muted">No closed polls yet</p>}
      {history.length > 0 && filteredHistory.length === 0 && <p className="muted">No polls match your search</p>}
      {filteredHistory.length > 0 && (
        <ul className="entries poll-list">
          {filteredHistory.map((p) => (
            <li key={p.id} className="entry-card history-item">
              {(() => {
                const closedText = `Closed ${new Date(p.votingClosesAt).toLocaleString()}`;
                const isTie = p.winners.length > 1 && p.winners.every((w) => w.votes === p.winners[0].votes);
                const stackVoteCount = isTie && p.winners.length > 2;
                const tiePreviewStyle = isTie
                  ? ({ ['--tie-count' as '--tie-count']: Math.max(p.winners.length, 1) } as CSSProperties)
                  : undefined;

                const renderThumb = (winner: PollHistoryResponse['winners'][number]) => {
                  const asset = winner.assetId ? assetCache[winner.assetId] : undefined;
                  const titleText = winnerTitle(winner);
                  const voteLabel = `${winner.votes} vote${winner.votes === 1 ? '' : 's'}`;
                  const labelSource = winnerUser(winner).trim();
                  const fallbackLabel = labelSource.slice(0, 1).toUpperCase() || '?';
                  const entryLink = `/polls/${p.id}#entry-${winner.entryId}`;

                  return asset?.url ? (
                    <Link
                      key={winner.entryId}
                      to={entryLink}
                      title={titleText}
                      className="history-thumb"
                    >
                      <img src={asset.url} alt={titleText} />
                      <div className={`history-thumb-label pill winner${stackVoteCount ? ' stacked' : ''}`}>
                        <span className="history-thumb-title">{winnerUser(winner)}</span>
                        {!stackVoteCount && <span aria-hidden="true">·</span>}
                        <span className="history-thumb-count">{voteLabel}</span>
                      </div>
                    </Link>
                  ) : (
                    <Link key={winner.entryId} to={entryLink} className="history-thumb history-thumb--fallback" title={titleText}>
                      <div className="history-thumb-fallback">{fallbackLabel}</div>
                      <div className={`history-thumb-label pill winner${stackVoteCount ? ' stacked' : ''}`}>
                        <span className="history-thumb-title">{winnerUser(winner)}</span>
                        {!stackVoteCount && <span aria-hidden="true">·</span>}
                        <span className="history-thumb-count">{voteLabel}</span>
                      </div>
                    </Link>
                  );
                };

                return (
                  <>
                    <div className="history-top">
                      <div>
                        <p className="history-title"><Link to={`/polls/${p.id}`}>{p.title}</Link></p>
                        <div className="history-subtitle" />
                      </div>
                    </div>

                    {p.winners.length === 0 && <p className="muted">No votes recorded</p>}

                    {p.winners.length > 0 && (
                      <>
                        <div className="history-body">
                          <div className="history-side" />

                          <div className={`history-preview-grid ${isTie ? 'is-tie' : ''}`} style={tiePreviewStyle}>
                            {isTie ? p.winners.map(renderThumb) : renderThumb(p.winners[0])}
                          </div>

                          <div className="history-meta">
                            <div className="history-meta-top">
                              <span className="pill subtle">{votingMethodLabel(p.votingMethod)}</span>
                              <VotingMethodInfo method={p.votingMethod} />
                            </div>
                            <div className="history-meta-title">{isTie ? `${p.winners.length} winners tied` : 'Winner'}</div>
                            <div className="history-meta-note">{closedText}</div>
                            <div className="history-meta-note">{p.totalVotes} total vote{p.totalVotes === 1 ? '' : 's'}</div>
                            <div className="history-meta-pills">
                              {isTie ? (
                                <span className="pill tie">Tie</span>
                              ) : (
                                p.winners.map((w) => (
                                  <span key={w.entryId} className="pill winner">{winnerUser(w)} · {w.votes} vote{w.votes === 1 ? '' : 's'}</span>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="history-actions">
                      <Link className="primary" to={`/polls/${p.id}`}>View poll</Link>
                    </div>
                  </>
                );
              })()}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
