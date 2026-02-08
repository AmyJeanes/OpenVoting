import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Topbar } from './Topbar';
import { createConfigResponse, createMeResponse } from '../test/factories';

describe('Topbar', () => {
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

    await userEvent.click(screen.getByText('Logout'));
    expect(onLogout).toHaveBeenCalledWith('Signed out.');
  });

  it('disables login when auth URL is missing and enables when provided', async () => {
    const onLogin = vi.fn();

    const { rerender } = render(
      <MemoryRouter>
        <Topbar
          sessionState="anonymous"
          me={null}
          config={createConfigResponse({ discordAuthorizeUrl: '' })}
          loginCta="Sign in"
          hasLivePolls={false}
          onLogin={onLogin}
          onLogout={vi.fn()}
        />
      </MemoryRouter>
    );

    const disabledButton = screen.getByRole('button', { name: 'Sign in' });
    expect(disabledButton).toBeDisabled();

    rerender(
      <MemoryRouter>
        <Topbar
          sessionState="anonymous"
          me={null}
          config={createConfigResponse()}
          loginCta="Sign in"
          hasLivePolls={false}
          onLogin={onLogin}
          onLogout={vi.fn()}
        />
      </MemoryRouter>
    );

    const enabledButton = screen.getByRole('button', { name: 'Sign in' });
    expect(enabledButton).toBeEnabled();

    await userEvent.click(enabledButton);
    expect(onLogin).toHaveBeenCalledTimes(1);
  });
});
