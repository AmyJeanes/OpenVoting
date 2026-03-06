import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HistoryPage } from './HistoryPage';
import { ToastProvider } from './ToastProvider';
import type { HistoryProps } from './HistoryPage';

const iso = () => new Date('2024-01-01T00:00:00.000Z').toISOString();

const createHistoryPoll = (overrides: Partial<HistoryProps['history'][number]> = {}): HistoryProps['history'][number] => ({
  id: 'poll-1',
  title: 'Sample Poll',
  description: 'Sample description',
  status: 5,
  votingMethod: 1,
  votingClosesAt: iso(),
  totalVotes: 3,
  winners: [
    {
      entryId: 'entry-1',
      displayName: 'Winner',
      votes: 3,
      submittedByDisplayName: 'Winner'
    }
  ],
  ...overrides
});

const renderHistory = (props: Partial<HistoryProps> = {}) => {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <HistoryPage
          sessionState={props.sessionState ?? 'authenticated'}
          history={props.history ?? []}
          historyError={props.historyError ?? null}
          assetCache={props.assetCache ?? {}}
          onRefresh={props.onRefresh ?? vi.fn()}
          onLogin={props.onLogin ?? vi.fn()}
          loginCta={props.loginCta ?? 'Sign in'}
          loginDisabled={props.loginDisabled ?? false}
        />
      </MemoryRouter>
    </ToastProvider>
  );
};

describe('HistoryPage', () => {
  it('filters past polls by title and description in realtime', async () => {
    const springPoll = createHistoryPoll({ id: 'poll-1', title: 'Spring Contest', description: 'Season opener' });
    const summerPoll = createHistoryPoll({ id: 'poll-2', title: 'Summer Clash', description: 'Beach theme' });

    renderHistory({ history: [springPoll, summerPoll] });

    expect(screen.getByTestId('history-page')).toBeInTheDocument();
    expect(screen.getByTestId('history-poll-list')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Open search' }));
    const searchInput = screen.getByRole('textbox', { name: 'Search past polls' });
    expect(screen.getByTestId('history-search-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('history-search-input')).toBe(searchInput);

    await userEvent.type(searchInput, 'beach');
    expect(screen.getByText('Summer Clash')).toBeInTheDocument();
    expect(screen.queryByText('Spring Contest')).not.toBeInTheDocument();

    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, 'spring');
    expect(screen.getByText('Spring Contest')).toBeInTheDocument();
    expect(screen.queryByText('Summer Clash')).not.toBeInTheDocument();
  });

  it('shows all tied winners in the preview without a remaining counter', () => {
    const tiePoll = createHistoryPoll({
      winners: [
        {
          entryId: 'entry-1',
          displayName: 'Winner One',
          votes: 10,
          submittedByDisplayName: 'Winner One'
        },
        {
          entryId: 'entry-2',
          displayName: 'Winner Two',
          votes: 10,
          submittedByDisplayName: 'Winner Two'
        },
        {
          entryId: 'entry-3',
          displayName: 'Winner Three',
          votes: 10,
          submittedByDisplayName: 'Winner Three'
        }
      ]
    });

    renderHistory({ history: [tiePoll] });

    expect(screen.getByTestId('history-poll-poll-1')).toBeInTheDocument();
    expect(screen.getByTestId('history-view-poll-poll-1')).toHaveAttribute('href', '/polls/poll-1');

    expect(screen.getByTitle('Winner One')).toBeInTheDocument();
    expect(screen.getByTitle('Winner Two')).toBeInTheDocument();
    expect(screen.getByTitle('Winner Three')).toBeInTheDocument();
    const stackedVoteLabels = screen.getAllByText('10 votes').filter((node) => node.closest('.history-thumb-label.stacked'));
    expect(stackedVoteLabels).toHaveLength(3);
    expect(screen.queryByText('+1')).not.toBeInTheDocument();
  });
});
