import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DiscordLinkPage } from './DiscordLinkPage';
import type { FlashMessage } from '../types';

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <DiscordLinkPage />
  </MemoryRouter>
);

describe('DiscordLinkPage', () => {
  it('reports a missing login token without waiting on a status fetch', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const flashes: (FlashMessage | null)[] = [];
    const onFlash = (event: Event) => flashes.push((event as CustomEvent<FlashMessage | null>).detail);
    window.addEventListener('ov-flash', onFlash);

    try {
      renderAt('/auth/discord-link');

      expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
      expect(fetchMock).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(flashes.some((f) => f && typeof f !== 'string' && f.text.includes('Missing login token'))).toBe(true);
      });
    } finally {
      window.removeEventListener('ov-flash', onFlash);
    }
  });

  it('enables continue once the token checks out as valid', async () => {
    global.fetch = vi.fn(async () => new Response(
      JSON.stringify({ status: 'valid', displayName: 'Amy' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )) as unknown as typeof fetch;

    renderAt('/auth/discord-link?token=good-token');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
    });

    expect(screen.getByRole('heading', { name: 'Do you want to log in as Amy?' })).toBeInTheDocument();
  });
});
