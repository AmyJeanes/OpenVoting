import { act, renderHook, waitFor } from '@testing-library/react';
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('sets session anonymous when no saved token', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/config')) {
        return okJson({ serverName: 'Test Server', discordAuthorizeUrl: '' });
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
        return okJson({ serverName: 'Test Server', discordAuthorizeUrl: 'https://discord.test' });
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
    expect(result.current.flash).toBe('Your session expired, please sign in again');
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ headers: expect.any(Object) }));
  });

  it('surfaces stored flash message from auth redirect', async () => {
    localStorage.setItem('ov_flash', 'Join the Discord server to sign in');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/config')) {
        return okJson({ serverName: 'Test Server', discordAuthorizeUrl: '' });
      }
      return new Response('', { status: 404 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useVotingApp());

    await waitFor(() => {
      expect(result.current.flash).toBe('Join the Discord server to sign in');
    });

    expect(localStorage.getItem('ov_flash')).toBeNull();
  });

  it('keeps selected image file in state while async validation is pending', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/config')) {
        return okJson({ serverName: 'Test Server', discordAuthorizeUrl: '' });
      }
      return new Response('', { status: 404 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

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
    vi.stubGlobal('Image', PendingImage as unknown as typeof Image);

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
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/config')) {
        return okJson({ serverName: 'Test Server', discordAuthorizeUrl: '' });
      }
      return new Response('', { status: 404 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

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
    vi.stubGlobal('Image', RectImage as unknown as typeof Image);

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
});

vi.mock('../components', () => ({
  useToast: () => ({ showToast: vi.fn() })
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn()
}));
