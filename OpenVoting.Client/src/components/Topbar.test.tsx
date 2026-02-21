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
    expect(onLogout).toHaveBeenCalledWith('Signed out');
  });

  it('does not render login CTA when anonymous to avoid double sign-in', () => {
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

    expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull();
  });
});
