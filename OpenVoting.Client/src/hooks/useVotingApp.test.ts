import { act, renderHook, waitFor } from '@testing-library/react';
import { useVotingApp } from './useVotingApp';
import { createMeResponse, createPollResponse } from '../test/factories';

declare const Response: typeof globalThis.Response;
const showToastMock = vi.fn();

describe('useVotingApp', () => {
  const originalFetch = global.fetch;
  const okJson = (body: unknown) => new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });

  const mockFetch = (route: (url: string) => Response) => {
    const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      return Promise.resolve(route(url));
    });
    global.fetch = fetchMock;
    return fetchMock;
  };

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
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    showToastMock.mockReset();
  });

  it('sets session anonymous when no saved token', async () => {
    const fetchMock = mockFetch((url) => {
      if (url.endsWith('/api/config')) {
        return okJson({ serverName: 'Test Server', discordAuthorizeUrl: '' });
      }
      return new Response('', { status: 404 });
    });

    const { result } = renderHook(() => useVotingApp());

    await waitFor(() => {
      expect(result.current.sessionState).toBe('anonymous');
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/config');
  });

  it('logs out and clears token on unauthorized me response', async () => {
    localStorage.setItem('ov_token', 'abc');
    const fetchMock = mockFetch((url) => {
      if (url.endsWith('/api/config')) {
        return okJson({ serverName: 'Test Server', discordAuthorizeUrl: 'https://discord.test' });
      }
      if (url.endsWith('/api/auth/me')) {
        return new Response('unauthorized', { status: 401 });
      }
      return new Response('', { status: 404 });
    });

    const { result } = renderHook(() => useVotingApp());

    await waitFor(() => {
      expect(result.current.sessionState).toBe('anonymous');
    });

    expect(localStorage.getItem('ov_token')).toBeNull();
    expect(result.current.flash).toBe('Your session expired, please sign in again');
    const meInit = fetchMock.mock.calls.find(([input]) => input === '/api/auth/me')?.[1];
    expect(new Headers(meInit?.headers).get('Authorization')).toBe('Bearer abc');
  });

  it('surfaces stored flash message from auth redirect', async () => {
    localStorage.setItem('ov_flash', 'Join the Discord server to sign in');
    mockFetch((url) => {
      if (url.endsWith('/api/config')) {
        return okJson({ serverName: 'Test Server', discordAuthorizeUrl: '' });
      }
      return new Response('', { status: 404 });
    });

    const { result } = renderHook(() => useVotingApp());

    await waitFor(() => {
      expect(result.current.flash).toBe('Join the Discord server to sign in');
    });

    expect(localStorage.getItem('ov_flash')).toBeNull();
  });

  it('keeps selected image file in state while async validation is pending', async () => {
    mockFetch((url) => {
      if (url.endsWith('/api/config')) {
        return okJson({ serverName: 'Test Server', discordAuthorizeUrl: '' });
      }
      return new Response('', { status: 404 });
    });

    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn()
    });

    class PendingImage {
      naturalWidth = 1024;
      naturalHeight = 1024;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        // Keep validation pending by never invoking onload/onerror.
      }
    }
    vi.stubGlobal('Image', PendingImage);

    const { result } = renderHook(() => useVotingApp());

    await waitFor(() => {
      expect(result.current.sessionState).toBe('anonymous');
    });

    const file = new File(['image'], 'professor_booboo_by_lieveheersbeestje-d7mb7og.jpg', { type: 'image/jpeg' });

    act(() => {
      result.current.handleEntryFilesChange({ original: file });
    });

    expect(result.current.entryFiles.original?.name).toBe('professor_booboo_by_lieveheersbeestje-d7mb7og.jpg');
  });

  it('keeps selected file when validation fails so submit reports specific validation error', async () => {
    mockFetch((url) => {
      if (url.endsWith('/api/config')) {
        return okJson({ serverName: 'Test Server', discordAuthorizeUrl: '' });
      }
      return new Response('', { status: 404 });
    });

    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn()
    });

    class RectImage {
      naturalWidth = 1000;
      naturalHeight = 800;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        this.onload?.();
      }
    }
    vi.stubGlobal('Image', RectImage);

    const { result } = renderHook(() => useVotingApp());

    await waitFor(() => {
      expect(result.current.sessionState).toBe('anonymous');
    });

    const file = new File(['image'], 'professor_booboo_by_lieveheersbeestje-d7mb7og.jpg', { type: 'image/jpeg' });

    act(() => {
      result.current.handleEntryFilesChange({ original: file });
    });

    await waitFor(() => {
      expect(result.current.entrySubmitError).toBe('Images must be square (1:1 aspect ratio)');
    });

    expect(result.current.entryFiles.original?.name).toBe('professor_booboo_by_lieveheersbeestje-d7mb7og.jpg');
  });

  it('rejects image files larger than 10MB during client-side validation', async () => {
    mockFetch((url) => {
      if (url.endsWith('/api/config')) {
        return okJson({ serverName: 'Test Server', discordAuthorizeUrl: '' });
      }
      return new Response('', { status: 404 });
    });

    const { result } = renderHook(() => useVotingApp());

    await waitFor(() => {
      expect(result.current.sessionState).toBe('anonymous');
    });

    const file = new File(['image'], 'too-large.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: (10 * 1024 * 1024) + 1 });

    act(() => {
      result.current.handleEntryFilesChange({ original: file });
    });

    await waitFor(() => {
      expect(result.current.entrySubmitError).toBe('Images must be 10MB or smaller');
    });

    expect(result.current.entryFileInvalid).toBe(true);
    expect(showToastMock).toHaveBeenCalledWith('Images must be 10MB or smaller', { tone: 'error' });
  });

  it('stores current path before redirecting to Discord login', async () => {
    window.history.replaceState({}, '', '/polls/live/abc?view=grid#details');

    mockFetch((url) => {
      if (url.endsWith('/api/config')) {
        return okJson({ serverName: 'Test Server', discordAuthorizeUrl: 'https://discord.test/oauth' });
      }
      return new Response('', { status: 404 });
    });

    const { result } = renderHook(() => useVotingApp());

    await waitFor(() => {
      expect(result.current.config?.discordAuthorizeUrl).toBe('https://discord.test/oauth');
    });

    act(() => {
      try {
        result.current.handleLogin();
      } catch {
        // jsdom does not implement full-page navigation.
      }
    });

    expect(localStorage.getItem('ov_post_login_return_to')).toBe('/polls/live/abc?view=grid#details');
  });

  it('restores saved return path after token callback', async () => {
    window.history.replaceState({}, '', '/?token=jwt-token');
    localStorage.setItem('ov_post_login_return_to', '/polls/live/next?tab=vote#entry-1');

    mockFetch((url) => {
      if (url.endsWith('/api/config')) {
        return okJson({ serverName: 'Test Server', discordAuthorizeUrl: 'https://discord.test/oauth' });
      }
      if (url.endsWith('/api/auth/me')) {
        return new Response('unauthorized', { status: 401 });
      }
      return new Response('', { status: 404 });
    });

    const { result } = renderHook(() => useVotingApp());

    await waitFor(() => {
      expect(result.current.sessionState).toBe('anonymous');
    });

    expect(window.location.pathname).toBe('/polls/live/next');
    expect(window.location.search).toBe('?tab=vote');
    expect(window.location.hash).toBe('#entry-1');
    expect(localStorage.getItem('ov_post_login_return_to')).toBeNull();
  });

  it('uses returnTo query from callback redirect and clears saved fallback path', async () => {
    window.history.replaceState({}, '', '/?token=jwt-token&returnTo=%2Fpolls%2Fhistory%3Fq%3Ddone%23top');
    localStorage.setItem('ov_post_login_return_to', '/polls/live/next?tab=vote#entry-1');

    mockFetch((url) => {
      if (url.endsWith('/api/config')) {
        return okJson({ serverName: 'Test Server', discordAuthorizeUrl: 'https://discord.test/oauth' });
      }
      if (url.endsWith('/api/auth/me')) {
        return new Response('unauthorized', { status: 401 });
      }
      return new Response('', { status: 404 });
    });

    const { result } = renderHook(() => useVotingApp());

    await waitFor(() => {
      expect(result.current.sessionState).toBe('anonymous');
    });

    expect(window.location.pathname).toBe('/polls/history');
    expect(window.location.search).toBe('?q=done');
    expect(window.location.hash).toBe('#top');
    expect(localStorage.getItem('ov_post_login_return_to')).toBeNull();
  });

  describe('when signed in', () => {
    const poll = createPollResponse({ id: 'poll-1' });
    let failures: Record<string, string>;

    beforeEach(() => {
      localStorage.setItem('ov_token', 'abc');
      failures = {};
      mockFetch((url) => {
        const path = new URL(url, 'http://localhost').pathname;
        if (failures[path]) return new Response(failures[path], { status: 500 });
        switch (path) {
          case '/api/config': return okJson({ serverName: 'Test Server', discordAuthorizeUrl: '' });
          case '/api/auth/me': return okJson(createMeResponse());
          case '/api/polls/active': return okJson([poll]);
          case '/api/polls/poll-1/summary': return okJson(poll);
          case '/api/polls/poll-1/entries': return okJson([]);
          case '/api/polls/poll-1': return okJson({ entries: [], winners: [] });
          default: return new Response(null, { status: 204 });
        }
      });
    });

    it('shows a live polls refresh failure as a poll error', async () => {
      const { result } = renderHook(() => useVotingApp());
      await waitFor(() => {
        expect(result.current.sessionState).toBe('authenticated');
      });

      failures['/api/polls/poll-1/summary'] = 'Summary failed';
      act(() => {
        result.current.refreshLivePolls();
      });

      await waitFor(() => {
        expect(result.current.pollError).toBe('Summary failed');
      });
    });

    it('shows a history refresh failure as a history error', async () => {
      const { result } = renderHook(() => useVotingApp());
      await waitFor(() => {
        expect(result.current.sessionState).toBe('authenticated');
      });

      failures['/api/polls/history'] = 'History failed';
      act(() => {
        result.current.refreshHistory();
      });

      await waitFor(() => {
        expect(result.current.historyError).toBe('History failed');
      });
    });
  });
});

vi.mock('../components', () => ({
  useToast: () => ({ showToast: showToastMock })
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn()
}));
