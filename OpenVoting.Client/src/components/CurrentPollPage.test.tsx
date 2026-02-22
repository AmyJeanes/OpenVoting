import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CurrentPollPage, type CurrentPollProps } from './CurrentPollPage';
import { ToastProvider } from './ToastProvider';
import { createEntryResponse, createPollResponse, createVoteResponse } from '../test/factories';

function renderPage(overrides: Partial<CurrentPollProps> = {}) {
  const entryOne = createEntryResponse({ id: 'entry-1', displayName: 'Entry One' });
  const entryTwo = createEntryResponse({ id: 'entry-2', displayName: 'Entry Two' });
  const poll = createPollResponse({ status: 2, requireRanking: true, maxSelections: 2, canVote: true, canSubmit: false });

  const Wrapper = () => {
    const [voteSubmitting, setVoteSubmitting] = useState(false);
    const [voteError, setVoteError] = useState<string | null>(null);

    const props: CurrentPollProps = {
      sessionState: 'authenticated',
      me: { isAdmin: false },
      poll,
      pollDetail: null,
      pollLoading: false,
      pollError: null,
      entries: [entryOne, entryTwo],
      entriesError: null,
      entriesLoading: false,
      voteState: {
        'entry-1': { selected: true, rank: '1' },
        'entry-2': { selected: true, rank: '2' }
      },
      voteError,
      voteSubmitting,
      voteInfo: createVoteResponse({
        voteId: 'vote-1',
        choices: [
          { entryId: 'entry-2', rank: 1 },
          { entryId: 'entry-1', rank: 2 }
        ]
      }),
      votingBreakdown: [],
      votingBreakdownError: null,
      entryForm: { displayName: '', description: '' },
      entryFiles: {},
      entryFileValidationPending: false,
      entryFileInvalid: false,
      entrySubmitError: null,
      entrySubmitSuccessCount: 0,
      entrySubmitting: false,
      assetCache: {},
      onRefreshPoll: vi.fn(),
      onSelectPoll: vi.fn(),
      onToggleSelection: vi.fn(),
      onUpdateRank: vi.fn(),
      onSubmitVote: vi.fn(async () => {
        setVoteError(null);
        setVoteSubmitting(true);
        await new Promise((resolve) => window.setTimeout(resolve, 10));
        setVoteSubmitting(false);
      }),
      onSubmitEntry: vi.fn(),
      onEntryFormChange: vi.fn(),
      onEntryFilesChange: vi.fn(),
      onDisqualify: vi.fn(),
      onRequalify: vi.fn(),
      onDeleteEntry: vi.fn(),
      onTransition: vi.fn(),
      onDeletePoll: vi.fn(),
      onUpdateMetadata: vi.fn(),
      onUpdateSubmissionSettings: vi.fn(),
      onUpdateVotingSettings: vi.fn(),
      uploadMaxFileSizeMB: 10,
      onLogin: vi.fn(),
      loginCta: 'Sign in',
      loginDisabled: false,
      ...overrides
    };

    return (
      <ToastProvider>
        <MemoryRouter>
          <CurrentPollPage {...props} />
        </MemoryRouter>
      </ToastProvider>
    );
  };

  return render(<Wrapper />);
}

describe('CurrentPollPage', () => {
  it('closes ranking modal after updating an existing vote', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Continue to ranking' }));
    expect(await screen.findByText('Order your selections')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Update vote' }));

    await waitFor(() => {
      expect(screen.queryByText('Order your selections')).not.toBeInTheDocument();
    });
  });
});
