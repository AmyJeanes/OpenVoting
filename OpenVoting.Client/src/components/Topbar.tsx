import { Link, NavLink } from 'react-router-dom';
import type { ConfigResponse, MeResponse, SessionState } from '../types';

export type TopbarProps = {
  sessionState: SessionState;
  me: MeResponse | null;
  config: ConfigResponse | null;
  loginCta: string;
  onLogin: () => void;
  onLogout: (message?: string) => void;
};

export function Topbar({ sessionState, me, config, loginCta, onLogin, onLogout }: TopbarProps) {
  const serverName = config?.serverName?.trim() || 'OpenVoting';

  return (
    <header className="topbar">
      <div className="brand">
        <Link to="/">
          <h1>{serverName} Voting</h1>
        </Link>
      </div>
      <nav className="nav">
          <NavLink to="/polls/current" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Live polls
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
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
