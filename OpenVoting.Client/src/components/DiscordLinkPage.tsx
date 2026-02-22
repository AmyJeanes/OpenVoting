import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { FlashMessage, OneTimeDiscordLinkAuthResponse, OneTimeDiscordLinkStatusResponse } from '../types';

const tokenStorageKey = 'ov_token';

export function DiscordLinkPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [status, setStatus] = useState<OneTimeDiscordLinkStatusResponse | null>(null);

  const hasToken = token.trim().length > 0;
  const canContinue = hasToken && status?.status === 'valid';

  useEffect(() => {
    if (!hasToken) {
      setStatus({ status: 'invalid', message: 'Missing login token' });
      return;
    }

    let cancelled = false;
    const fetchStatus = async () => {
      setStatusLoading(true);
      try {
        const response = await fetch(`/api/auth/discord-link/status?token=${encodeURIComponent(token)}`);
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || 'Unable to verify login link');
        }

        const payload: OneTimeDiscordLinkStatusResponse = await response.json();
        if (!cancelled) {
          setStatus(payload);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unable to verify login link';
          setStatus({ status: 'invalid', message });
        }
      } finally {
        if (!cancelled) {
          setStatusLoading(false);
        }
      }
    };

    fetchStatus();
    return () => {
      cancelled = true;
    };
  }, [hasToken, token]);

  const title = useMemo(() => {
    if (!hasToken) {
      return 'Do you want to log in?';
    }

    if (statusLoading) {
      return 'Checking login link…';
    }

    if (status?.displayName) {
      return `Do you want to log in as ${status.displayName}?`;
    }

    return 'Do you want to log in?';
  }, [hasToken, statusLoading, status]);

  const warningMessage = useMemo<FlashMessage | null>(() => {
    if (status && status.status !== 'valid') {
      return {
        text: `${status.message ?? 'This login link is invalid, expired, or already used'}. Run this in the Discord server for a new link:`,
        code: '/voting'
      };
    }

    return null;
  }, [status]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent<FlashMessage | null>('ov-flash', { detail: warningMessage }));

    return () => {
      window.dispatchEvent(new CustomEvent<FlashMessage | null>('ov-flash', { detail: null }));
    };
  }, [warningMessage]);

  const handleContinue = async () => {
    if (!canContinue || submitting) {
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
      <h2>{title}</h2>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button className="primary" type="button" onClick={handleContinue} disabled={!canContinue || statusLoading || submitting}>
          {submitting ? 'Signing in…' : 'Continue'}
        </button>
        <button className="ghost" type="button" onClick={() => navigate('/', { replace: true })}>
          Cancel
        </button>
      </div>
    </section>
  );
}