export type AuthPromptProps = {
  onLogin?: () => void;
  loginCta?: string;
  loginDisabled?: boolean;
};

export function AuthPrompt({ onLogin, loginCta = 'Sign in', loginDisabled = false }: AuthPromptProps) {
  return (
    <section className="card">
      <p className="eyebrow">Sign-in required</p>
      <h2>Please log in to continue</h2>
      <p className="muted">You need to be a member of the Discord server to view polls and vote. Sign in with Discord to continue</p>
      {onLogin && (
        <div className="actions">
          <button className="primary" disabled={loginDisabled} onClick={onLogin}>{loginCta}</button>
        </div>
      )}
    </section>
  );
}
