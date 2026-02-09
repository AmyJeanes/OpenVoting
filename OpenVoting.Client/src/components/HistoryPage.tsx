import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AuthPrompt } from './AuthPrompt';
import { VotingMethodInfo } from './VotingMethodInfo';
import { useToast } from './ToastProvider';
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
  if (sessionState !== 'authenticated') {
    return <AuthPrompt onLogin={onLogin} loginCta={loginCta} loginDisabled={loginDisabled} />;
  }

  const { showToast } = useToast();
  const winnerTitle = (winner: PollHistoryResponse['winners'][number]) => {
    const hasTitle = (winner.displayName || '').trim().length > 0;
    if (hasTitle) return winner.displayName;
    if (winner.submittedByDisplayName) return winner.submittedByDisplayName;
    return 'Untitled entry';
  };

  const winnerUser = (winner: PollHistoryResponse['winners'][number]) => winner.submittedByDisplayName || winner.displayName || 'Anonymous';

  useEffect(() => {
    if (historyError) showToast(historyError, { tone: 'error' });
  }, [historyError, showToast]);

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Archive</p>
          <h2>Past polls</h2>
        </div>
        <button className="ghost" onClick={onRefresh}>Refresh</button>
      </div>
      {history.length === 0 && !historyError && <p className="muted">No closed polls yet.</p>}
      {history.length > 0 && (
        <ul className="entries poll-list">
          {history.map((p) => (
            <li key={p.id} className="entry-card history-item">
              {(() => {
                const closedText = `Closed ${new Date(p.votingClosesAt).toLocaleString()}`;
                const isTie = p.winners.length > 1 && p.winners.every((w) => w.votes === p.winners[0].votes);

                const renderThumb = (winner: PollHistoryResponse['winners'][number]) => {
                  const asset = winner.assetId ? assetCache[winner.assetId] : undefined;
                  const titleText = winnerTitle(winner);
                  const voteLabel = `${winner.votes} vote${winner.votes === 1 ? '' : 's'}`;
                  const labelSource = winnerUser(winner).trim();
                  const fallbackLabel = labelSource.slice(0, 1).toUpperCase() || '?';

                  return asset?.url ? (
                    <a
                      key={winner.entryId}
                      href={asset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={titleText}
                      className="history-thumb"
                    >
                      <img src={asset.url} alt={titleText} />
                      <div className="history-thumb-label pill winner">
                        <span className="history-thumb-title">{winnerUser(winner)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="history-thumb-count">{voteLabel}</span>
                      </div>
                    </a>
                  ) : (
                    <div key={winner.entryId} className="history-thumb history-thumb--fallback" title={titleText}>
                      <div className="history-thumb-fallback">{fallbackLabel}</div>
                      <div className="history-thumb-label pill winner">
                        <span className="history-thumb-title">{winnerUser(winner)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="history-thumb-count">{voteLabel}</span>
                      </div>
                    </div>
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

                    {p.winners.length === 0 && <p className="muted">No votes recorded.</p>}

                    {p.winners.length > 0 && (
                      <>
                        <div className="history-body">
                          <div className="history-side" />

                          <div className={`history-preview-grid ${isTie ? 'is-tie' : ''}`}>
                            {isTie ? p.winners.slice(0, 2).map(renderThumb) : renderThumb(p.winners[0])}
                            {isTie && p.winners.length > 2 && (
                              <div className="history-thumb history-thumb--remaining">+{p.winners.length - 2}</div>
                            )}
                          </div>

                          <div className="history-meta">
                            <div className="history-meta-top">
                              <span className="pill subtle">{votingMethodLabel(p.votingMethod)}</span>
                              <VotingMethodInfo method={p.votingMethod} />
                            </div>
                            <div className="history-meta-title">{isTie ? `${p.winners.length} winners tied` : 'Winner'}</div>
                            <div className="history-meta-note">{closedText}</div>
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

                        <div className="history-actions">
                          <Link className="primary" to={`/polls/${p.id}`}>View poll details</Link>
                        </div>
                      </>
                    )}
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
