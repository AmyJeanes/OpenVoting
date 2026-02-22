import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { OneTimeDiscordLinkAuthResponse } from '../types';

const tokenStorageKey = 'ov_token';

export function DiscordLinkPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasToken = token.trim().length > 0;
  const description = useMemo(() => {
    if (!hasToken) {
      return 'This login link is missing a token';
    }

    return 'This one-time link signs you in to OpenVoting';
  }, [hasToken]);

  const handleContinue = async () => {
    if (!hasToken || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/discord-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Unable to complete sign in');
      }

      const payload: OneTimeDiscordLinkAuthResponse = await response.json();
      localStorage.setItem(tokenStorageKey, payload.token);
      navigate('/', { replace: true });
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete sign in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card splash">
      <p className="eyebrow">Discord sign in</p>
      <h2>Continue sign in</h2>
      <p className="muted">{description}</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button className="primary" type="button" onClick={handleContinue} disabled={!hasToken || submitting}>
          {submitting ? 'Signing in…' : 'Continue'}
        </button>
        <button className="ghost" type="button" onClick={() => navigate('/', { replace: true })}>
          Cancel
        </button>
      </div>
    </section>
  );
}