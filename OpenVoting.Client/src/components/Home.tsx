import { Link } from 'react-router-dom';
import type { ConfigResponse, SessionState } from '../types';

export type HomeProps = {
  sessionState: SessionState;
  config: ConfigResponse | null;
  onLogin: () => void;
};

export function Home({ sessionState, config, onLogin }: HomeProps) {
  const loggedOut = sessionState !== 'authenticated';
  return (
    <section className="card hero">
      <div>
        <p className="eyebrow">OpenVoting</p>
        <h2>Run shareable polls without the chaos.</h2>
        <p className="lede">Authenticate with Discord, share direct links for live competitions, and keep admin tools separate from the voting surface.</p>
        <div className="actions">
          {loggedOut ? (
            <button className="primary" disabled={!config?.discordAuthorizeUrl} onClick={onLogin}>
              {config?.discordAuthorizeUrl ? 'Start sign-in' : 'Loading login…'}
            </button>
          ) : (
            <Link className="primary" to="/polls/current">Go to live poll</Link>
          )}
          <Link className="ghost" to="/history">See past polls</Link>
        </div>
      </div>
      <div className="hero-card">
        <p className="pill">Secure by default</p>
        <p>Accounts are checked automatically on load. Invalid sessions are logged out to keep results clean.</p>
        <p className="muted">Bring your community, we handle the flows.</p>
      </div>
    </section>
  );
}
