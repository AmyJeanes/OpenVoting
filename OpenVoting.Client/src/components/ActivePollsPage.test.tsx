import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ActivePollsPage, type ActivePollsPageProps } from './ActivePollsPage';
import { ToastProvider } from './ToastProvider';
import { createPollResponse } from '../test/factories';

type WrapperProps = Partial<ActivePollsPageProps> & { sessionState: ActivePollsPageProps['sessionState'] };

const renderWithProviders = (props: WrapperProps) => {
  const Wrapper = () => {
    const [createForm, setCreateForm] = useState<ActivePollsPageProps['createForm']>(props.createForm ?? {
      title: '',
      description: '',
      votingMethod: 1
    });

    return (
      <ToastProvider>
        <MemoryRouter>
          <ActivePollsPage
            sessionState={props.sessionState}
            me={props.me ?? null}
            activePolls={props.activePolls ?? []}
            pollError={props.pollError ?? null}
            loading={props.loading ?? false}
            onRefresh={props.onRefresh ?? vi.fn()}
            createForm={createForm}
            setCreateForm={setCreateForm}
            creating={props.creating ?? false}
            createError={props.createError ?? null}
            onCreatePoll={props.onCreatePoll ?? vi.fn()}
          />
        </MemoryRouter>
      </ToastProvider>
    );
  };

  return render(<Wrapper />);
};

describe('ActivePollsPage', () => {
  it('shows auth prompt when not authenticated', () => {
    renderWithProviders({ sessionState: 'anonymous' });
    expect(screen.getByText('Please log in to continue')).toBeInTheDocument();
  });

  it('lets admins trigger poll creation and see active polls', async () => {
    const onCreate = vi.fn();
    const poll = createPollResponse({ id: 'poll-123', title: 'Spring Contest', status: 2 });

    renderWithProviders({
      sessionState: 'authenticated',
      me: { isAdmin: true },
      activePolls: [poll],
      onCreatePoll: onCreate
    });

    expect(screen.getByText('Spring Contest')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View poll' })).toHaveAttribute('href', '/polls/poll-123');

    await userEvent.click(screen.getByRole('button', { name: 'Create poll' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('surfaces creation errors via toast', async () => {
    renderWithProviders({
      sessionState: 'authenticated',
      me: { isAdmin: true },
      createError: 'Failed to create'
    });

    expect(await screen.findByText('Failed to create')).toBeInTheDocument();
  });
});
