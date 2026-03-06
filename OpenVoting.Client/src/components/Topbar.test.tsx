import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Topbar } from './Topbar';
import { createConfigResponse, createMeResponse } from '../test/factories';

describe('Topbar', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      writable: true,
      value: {
        getItem: vi.fn((key: string) => storage.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          storage.set(key, value);
        }),
        removeItem: vi.fn((key: string) => {
          storage.delete(key);
        }),
        clear: vi.fn(() => {
          storage.clear();
        }),
      },
    });

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('shows authenticated admin details and logs out with message', async () => {
    const onLogout = vi.fn();
    const config = createConfigResponse({ serverName: 'Guild' });
    render(
      <MemoryRouter>
        <Topbar
          sessionState="authenticated"
          me={createMeResponse({ displayName: 'Admin User', isAdmin: true })}
          config={config}
          loginCta="Login"
          hasLivePolls
          onLogin={vi.fn()}
          onLogout={onLogout}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Guild Voting')).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getAllByText('Admin').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Theme: System' })).toBeInTheDocument();
    expect(screen.getByTestId('topbar')).toBeInTheDocument();
    expect(screen.getByTestId('topbar-brand-link')).toHaveAttribute('href', '/polls/live');
    expect(screen.getByTestId('topbar-theme-toggle')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Logout'));
    expect(onLogout).toHaveBeenCalledWith('Signed out');
    expect(screen.getByTestId('topbar-logout-button')).toBeInTheDocument();
  });

  it('cycles theme mode system → light → dark → system', async () => {
    render(
      <MemoryRouter>
        <Topbar
          sessionState="anonymous"
          me={null}
          config={createConfigResponse()}
          loginCta="Sign in"
          hasLivePolls={false}
          onLogin={vi.fn()}
          onLogout={vi.fn()}
        />
      </MemoryRouter>
    );

    const themeToggle = screen.getByRole('button', { name: 'Theme: System' });

    await userEvent.click(themeToggle);
    expect(screen.getByRole('button', { name: 'Theme: Light' })).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Theme: Light');

    await userEvent.click(screen.getByRole('button', { name: 'Theme: Light' }));
    expect(screen.getByRole('button', { name: 'Theme: Dark' })).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Theme: Dark');

    await userEvent.click(screen.getByRole('button', { name: 'Theme: Dark' }));
    expect(screen.getByRole('button', { name: 'Theme: System' })).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Theme: System');
  });

  it('does not render login CTA when anonymous to avoid double sign-in', () => {
    const { container } = render(
      <MemoryRouter>
        <Topbar
          sessionState="anonymous"
          me={null}
          config={createConfigResponse()}
          loginCta="Sign in"
          hasLivePolls={false}
          onLogin={vi.fn()}
          onLogout={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'Theme: System' })).toBeInTheDocument();
    expect(container.querySelector('.user-shell')).toBeNull();
    expect(screen.getByTestId('topbar-nav')).toBeInTheDocument();
  });

  it('shows loading text while session is loading', () => {
    render(
      <MemoryRouter>
        <Topbar
          sessionState="loading"
          me={null}
          config={createConfigResponse()}
          loginCta="Sign in"
          hasLivePolls={false}
          onLogin={vi.fn()}
          onLogout={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });
});
