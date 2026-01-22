import { Link } from 'react-router-dom';
import { AuthPrompt } from './AuthPrompt';
import { VotingMethodInfo } from './VotingMethodInfo';
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

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Archive</p>
          <h2>Past polls</h2>
        </div>
        <button className="ghost" onClick={onRefresh}>Refresh</button>
      </div>
      {historyError && <p className="error">{historyError}</p>}
      {history.length === 0 && !historyError && <p className="muted">No closed polls yet.</p>}
      {history.length > 0 && (
        <ul className="entries">
          {history.map((p) => (
            <li key={p.id} className="entry-card">
              <div className="entry-head">
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
                <div className="winners">
                  {p.winners.map((w) => (
                    <div key={w.entryId} className="winner-chip">
                      <div>
                        <strong>{w.displayName}</strong>
                        <span className="muted"> · {w.votes} vote{w.votes === 1 ? '' : 's'}</span>
                      </div>
                      {w.assetId && assetCache[w.assetId]?.url && (
                        <img src={assetCache[w.assetId]!.url} alt={w.displayName} className="winner-img" />
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="actions">
                <Link className="ghost" to={`/polls/${p.id}`}>View poll details</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
