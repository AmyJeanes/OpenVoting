import { Link, NavLink } from 'react-router-dom';
import type { ConfigResponse, MeResponse, SessionState } from '../types';

export type TopbarProps = {
  sessionState: SessionState;
  me: MeResponse | null;
  config: ConfigResponse | null;
  loginCta: string;
  hasLivePolls: boolean;
  onLogin: () => void;
  onLogout: (message?: string) => void;
};

export function Topbar({ sessionState, me, config, loginCta, hasLivePolls, onLogin, onLogout }: TopbarProps) {
  const serverName = config?.serverName?.trim() || 'Voting';

  return (
    <header className="topbar">
      <div className="brand">
        <Link to="/polls/live" className="brand-link">
          <div className="brand-mark">VP</div>
          <div className="brand-copy">
            {hasLivePolls && (
              <div className="brand-row">
                <span className="pill live-pill"><span className="live-dot" aria-hidden="true" />Live</span>
              </div>
            )}
            <h1 className="brand-title">{serverName} Voting</h1>
            <p className="brand-sub">Real-time competitions with Discord sign-in.</p>
          </div>
        </Link>
      </div>
      <nav className="nav">
        <NavLink to="/polls/live" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          Live polls
        </NavLink>
        <NavLink to="/polls/history" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          Past polls
        </NavLink>
      </nav>
      <div className="user-shell">
        {sessionState === 'authenticated' && me ? (
          <div className="user-block">
            <div className="user-meta">
              <span className="user-name">{me.displayName}</span>
              {me.isAdmin && <span className="pill">Admin</span>}
            </div>
            <button className="ghost" onClick={() => onLogout('Signed out.')}>Logout</button>
          </div>
        ) : sessionState === 'loading' || sessionState === 'idle' ? (
          <div className="user-block">
            <span className="pill subtle">Loading session…</span>
          </div>
        ) : (
          <button
            className="primary"
            disabled={!config?.discordAuthorizeUrl}
            onClick={onLogin}
          >
            {loginCta}
          </button>
        )}
      </div>
    </header>
  );
}
