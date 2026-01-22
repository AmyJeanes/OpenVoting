import type { ReactNode } from 'react';

export type PageShellProps = {
  topbar: ReactNode;
  flash: string | null;
  configError: string | null;
  children: ReactNode;
};

export function PageShell({ topbar, flash, configError, children }: PageShellProps) {
  const flashText = flash?.trim();
  return (
    <div className="page">
      {topbar}
      {configError && <div className="banner error">{configError}</div>}
      {flashText && !configError && <div className="banner">{flashText}</div>}
      <main className="content">{children}</main>
      <footer className="footer">
        <span>Powered by OpenVoting · <a href="https://github.com/AmyJeanes/OpenVoting" target="_blank" rel="noreferrer">GitHub</a></span>
      </footer>
    </div>
  );
}
