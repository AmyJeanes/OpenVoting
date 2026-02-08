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
};

export function HistoryPage({ sessionState, history, historyError, assetCache, onRefresh }: HistoryProps) {
  if (sessionState !== 'authenticated') {
    return <AuthPrompt />;
  }

  const { showToast } = useToast();
  const winnerTitle = (winner: PollHistoryResponse['winners'][number]) => {
    const hasTitle = (winner.displayName || '').trim().length > 0;
    if (hasTitle) return winner.displayName;
    if (winner.submittedByDisplayName) return winner.submittedByDisplayName;
    return 'Untitled entry';
  };

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
        <ul className="entries">
          {history.map((p) => (
            <li key={p.id} className="entry-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div className="entry-head" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
                  <div>
                    <p className="entry-title"><Link to={`/polls/${p.id}`}>{p.title}</Link></p>
                    <p className="muted">Closed {new Date(p.votingClosesAt).toLocaleString()}</p>
                  </div>
                  <div className="metric-row">
                    <span className="pill subtle">{votingMethodLabel(p.votingMethod)}</span>
                    <VotingMethodInfo method={p.votingMethod} />
                  </div>
                </div>
                {p.winners.length === 0 && <p className="muted">No votes recorded.</p>}
                {p.winners.length > 0 && (
                  <div className="winners" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                    {p.winners.map((w) => {
                      const hasTitle = (w.displayName || '').trim().length > 0;
                      const titleText = winnerTitle(w);
                      const subtitle = hasTitle && w.submittedByDisplayName ? `by ${w.submittedByDisplayName}` : '';
                      return (
                        <div key={w.entryId} className="winner-chip" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, width: '100%', maxWidth: 220 }}>
                          <div>
                            <strong>{titleText}</strong>
                            <span className="muted"> · {w.votes} vote{w.votes === 1 ? '' : 's'}</span>
                          </div>
                          {subtitle && <div className="muted">{subtitle}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="actions" style={{ marginTop: 8 }}>
                  <Link className="ghost" to={`/polls/${p.id}`}>View poll details</Link>
                </div>
              </div>

              {/* Right-aligned winner preview; show a tie cluster when multiple winners are tied */}
              {p.winners.length > 0 && (() => {
                const isTie = p.winners.length > 1 && p.winners.every((w) => w.votes === p.winners[0].votes);

                if (isTie) {
                  const preview = p.winners.slice(0, 3);
                  const remaining = p.winners.length - preview.length;

                  return (
                    <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 160, padding: '4px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                        {preview.map((w, idx) => {
                          const asset = w.assetId ? assetCache[w.assetId] : undefined;
                          const labelSource = (w.displayName || w.submittedByDisplayName || '').trim();
                          const label = labelSource.slice(0, 1).toUpperCase() || '?';
                          const titleText = winnerTitle(w);
                          return asset?.url ? (
                            <a
                              key={w.entryId}
                              href={asset.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={titleText}
                              style={{ marginLeft: idx === 0 ? 0 : -14 }}
                            >
                              <img
                                src={asset.url}
                                alt={titleText}
                                style={{
                                  width: 74,
                                  height: 74,
                                  objectFit: 'cover',
                                  borderRadius: '50%',
                                  border: '2px solid var(--surface)',
                                  boxShadow: 'var(--shadow-soft)',
                                  cursor: 'zoom-in'
                                }}
                              />
                            </a>
                          ) : (
                            <div
                              key={w.entryId}
                              title={titleText}
                              style={{
                                width: 74,
                                height: 74,
                                borderRadius: '50%',
                                border: '2px solid var(--surface)',
                                background: 'var(--ghost-bg)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                color: 'var(--text-muted)',
                                marginLeft: idx === 0 ? 0 : -14
                              }}
                            >
                              {label}
                            </div>
                          );
                        })}
                        {remaining > 0 && (
                          <div style={{ marginLeft: 6, fontWeight: 700, color: 'var(--text-muted)' }}>+{remaining}</div>
                        )}
                      </div>
                      <div style={{ textAlign: 'center', width: '100%' }}>
                        <div style={{ fontWeight: 700 }}>{p.winners.length} winners tied</div>
                        <div className="muted" style={{ marginTop: 2 }}>
                          {p.winners.map((w) => winnerTitle(w)).slice(0, 3).join(', ')}{p.winners.length > 3 ? '…' : ''}
                        </div>
                        <div style={{ marginTop: 6 }}><span className="pill tie">Tie</span></div>
                      </div>
                    </div>
                  );
                }

                const w = p.winners[0];
                const asset = w.assetId ? assetCache[w.assetId] : undefined;
                if (!asset?.url) return null;
                const titleText = winnerTitle(w);
                return (
                  <a href={asset.url} target="_blank" rel="noopener noreferrer" title={titleText} style={{ marginLeft: 'auto', textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <img src={asset.url} alt={titleText} style={{ width: 160, height: 160, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border-strong)', cursor: 'zoom-in' }} />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 700 }}>{titleText}</div>
                        <div className="muted">{w.votes} vote{w.votes === 1 ? '' : 's'}</div>
                        <div style={{ marginTop: 6 }}><span className="pill winner">Winner</span></div>
                      </div>
                    </div>
                  </a>
                );
              })()}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
