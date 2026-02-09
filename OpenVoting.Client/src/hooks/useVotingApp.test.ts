import { renderHook, waitFor } from '@testing-library/react';
import { useVotingApp } from './useVotingApp';

declare const Response: typeof globalThis.Response;

describe('useVotingApp', () => {
  const originalFetch = global.fetch;
  const okJson = (body: unknown) => new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });

  beforeEach(() => {
    const store = new Map<string, string>();
    const fakeStorage = {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size;
      }
    } satisfies Storage;

    vi.stubGlobal('localStorage', fakeStorage);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  it('sets session anonymous when no saved token', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/config')) {
        return okJson({ serverName: 'Test Server', discordAuthorizeUrl: '', redirectUri: '' });
      }
      return new Response('', { status: 404 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useVotingApp());

    await waitFor(() => {
      expect(result.current.sessionState).toBe('anonymous');
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/config');
  });

  it('logs out and clears token on unauthorized me response', async () => {
    localStorage.setItem('ov_token', 'abc');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/config')) {
        return okJson({ serverName: 'Test Server', discordAuthorizeUrl: 'https://discord.test', redirectUri: 'https://app.test' });
      }
      if (url.endsWith('/api/auth/me')) {
        return new Response('unauthorized', { status: 401 });
      }
      return new Response('', { status: 404 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useVotingApp());

    await waitFor(() => {
      expect(result.current.sessionState).toBe('anonymous');
    });

    expect(localStorage.getItem('ov_token')).toBeNull();
    expect(result.current.flash).toBe('Your session expired. Please sign in again.');
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ headers: expect.any(Object) }));
  });

  it('surfaces stored flash message from auth redirect', async () => {
    localStorage.setItem('ov_flash', 'Join the Discord server to sign in.');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/config')) {
        return okJson({ serverName: 'Test Server', discordAuthorizeUrl: '', redirectUri: '' });
      }
      return new Response('', { status: 404 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useVotingApp());

    await waitFor(() => {
      expect(result.current.flash).toBe('Join the Discord server to sign in.');
    });

    expect(localStorage.getItem('ov_flash')).toBeNull();
  });
});

vi.mock('../components', () => ({
  useToast: () => ({ showToast: vi.fn() })
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn()
}));
