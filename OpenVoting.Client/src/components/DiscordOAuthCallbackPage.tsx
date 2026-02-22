import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const tokenStorageKey = 'ov_token';
const flashStorageKey = 'ov_flash';

type DiscordAuthResponse = {
  token: string;
};

export function DiscordOAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const code = params.get('code') ?? '';
  const oauthError = params.get('error');
  const oauthErrorDescription = params.get('error_description');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = code.trim().length > 0 && !oauthError;
  const description = useMemo(() => {
    if (oauthError) {
      return oauthErrorDescription ?? oauthError;
    }

    if (!canContinue) {
      return 'Missing Discord authorization code';
    }

    return 'Complete sign in to continue to OpenVoting';
  }, [canContinue, oauthError, oauthErrorDescription]);

  const handleCancel = () => {
    navigate('/', { replace: true });
  };

  const handleContinue = async () => {
    if (!canContinue || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      const response = await fetch('/api/auth/discord', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code, redirectUri })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Unable to complete sign in');
      }

      const payload: DiscordAuthResponse = await response.json();
      localStorage.setItem(tokenStorageKey, payload.token);
      localStorage.removeItem(flashStorageKey);
      navigate('/', { replace: true });
      window.location.reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to complete sign in';
      setError(message);
      localStorage.setItem(flashStorageKey, message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card splash">
      <p className="eyebrow">Discord sign in</p>
      <h2>Finish sign in</h2>
      <p className="muted">{description}</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button className="primary" type="button" onClick={handleContinue} disabled={!canContinue || submitting}>
          {submitting ? 'Signing in…' : 'Continue'}
        </button>
        <button className="ghost" type="button" onClick={handleCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}