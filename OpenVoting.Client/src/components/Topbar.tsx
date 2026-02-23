import { Link, NavLink } from 'react-router-dom';
import { useState } from 'react';
import type { ConfigResponse, MeResponse, SessionState } from '../types';
import { useThemePreference, type ThemeMode } from '../hooks/useThemePreference';

export type TopbarProps = {
  sessionState: SessionState;
  me: MeResponse | null;
  config: ConfigResponse | null;
  loginCta: string;
  hasLivePolls: boolean;
  onLogin: () => void;
  onLogout: (message?: string) => void;
};

function ThemeModeIcon({ mode, systemTheme }: { mode: ThemeMode; systemTheme: 'light' | 'dark' }) {
  if (mode === 'light') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 3.5v2.5M12 18v2.5M3.5 12H6M18 12h2.5M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (mode === 'dark') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M21.75 15a9.74 9.74 0 0 1-9 6 9.75 9.75 0 0 1-3.75-18.75A9.75 9.75 0 0 0 18 15.75c1.31 0 2.56-.26 3.75-.75Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {systemTheme === 'dark'
        ? <path d="M12 4A8 8 0 0 1 12 20Z" fill="currentColor" />
        : <path d="M12 4A8 8 0 0 0 12 20Z" fill="currentColor" />}
    </svg>
  );
}

export function Topbar({ sessionState, me, config, hasLivePolls, onLogout }: TopbarProps) {
  const serverName = config?.serverName?.trim() || 'Voting';
  const serverIconUrl = config?.serverIconUrl?.trim() || '';
  const serverInitials = (serverName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'VT').slice(0, 3);
  const { mode: themeMode, label: themeLabel, systemTheme, nextThemeMode, setMode } = useThemePreference();
  const [themeTooltipVisible, setThemeTooltipVisible] = useState(false);

  const themeResolvedLabel = systemTheme === 'dark' ? 'Dark' : 'Light';
  const themeTooltipText = themeMode === 'system'
    ? `Theme: System (${themeResolvedLabel})`
    : `Theme: ${themeLabel}`;

  const handleThemeToggle = () => {
    const nextMode = nextThemeMode(themeMode);
    setMode(nextMode);
    setThemeTooltipVisible(true);
  };

  return (
    <header className="topbar">
      <div className="brand">
        <Link to="/polls/live" className="brand-link">
          <div className={serverIconUrl ? 'brand-mark brand-mark-image' : 'brand-mark'}>
            {serverIconUrl ? <img src={serverIconUrl} alt={`${serverName} logo`} loading="lazy" /> : serverInitials}
          </div>
          <div className="brand-copy">
            {hasLivePolls && (
              <div className="brand-row">
                <span className="pill live-pill"><span className="live-dot" aria-hidden="true" />Live</span>
              </div>
            )}
            <h1 className="brand-title">{serverName} Voting</h1>
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
      <div className="theme-shell">
        <button
          type="button"
          className="theme-toggle"
          onClick={handleThemeToggle}
          onMouseEnter={() => setThemeTooltipVisible(true)}
          onMouseLeave={() => setThemeTooltipVisible(false)}
          onFocus={() => setThemeTooltipVisible(true)}
          onBlur={() => setThemeTooltipVisible(false)}
          aria-label={`Theme: ${themeLabel}`}
          aria-describedby={themeTooltipVisible ? 'theme-toggle-tooltip' : undefined}
        >
          <ThemeModeIcon mode={themeMode} systemTheme={systemTheme} />
        </button>
        <div
          id="theme-toggle-tooltip"
          role="tooltip"
          className={`theme-tooltip${themeTooltipVisible ? ' visible' : ''}`}
        >
          {themeTooltipText}
        </div>
      </div>
      <div className="user-shell">
        {sessionState === 'authenticated' && me ? (
          <div className="user-block">
            <div className="user-meta">
              <span className="user-name">{me.displayName}</span>
              {me.isAdmin && <span className="pill admin">Admin</span>}
            </div>
            <button className="ghost" onClick={() => onLogout('Signed out')}>Logout</button>
          </div>
        ) : sessionState === 'loading' || sessionState === 'idle' ? (
          <div className="user-block">
            <span className="pill subtle">Loading session…</span>
          </div>
        ) : null}
      </div>
    </header>
  );
}
