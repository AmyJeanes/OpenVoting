import type { ReactNode } from 'react';
import type { FlashMessage } from '../types';

export type PageShellProps = {
  topbar: ReactNode;
  flash: FlashMessage | null;
  configError: string | null;
  children: ReactNode;
};

export function PageShell({ topbar, flash, configError, children }: PageShellProps) {
  const flashText = typeof flash === 'string' ? flash.trim() : flash?.text.trim();

  const flashContent = typeof flash === 'string'
    ? flashText
    : flash && flashText
      ? (
        <>
          {flashText}
          {flash.code && (
            <>
              {' '}
              <code>{flash.code}</code>
            </>
          )}
        </>
      )
      : null;

  return (
    <div className="page">
      {topbar}
      {configError && <div className="banner error">{configError}</div>}
      {flashContent && !configError && <div className="banner warning">{flashContent}</div>}
      <main className="content">{children}</main>
      <footer className="footer">
        <span>Powered by OpenVoting · <a href="https://github.com/AmyJeanes/OpenVoting" target="_blank" rel="noreferrer">GitHub</a></span>
      </footer>
    </div>
  );
}
