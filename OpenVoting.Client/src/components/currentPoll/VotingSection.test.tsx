import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VotingSection } from './VotingSection';
import { createPollResponse, createEntryResponse, createAsset } from '../../test/factories';

describe('VotingSection', () => {
  it('toggles selection when an entry is clicked', async () => {
    const onToggleSelection = vi.fn();
    const poll = createPollResponse({ maxSelections: 3 });
    const entry = createEntryResponse({ id: 'entry-1', displayName: 'Choice A' });

    render(
      <VotingSection
        poll={poll}
        entries={[entry]}
        voteState={{}}
        voteSubmitting={false}
        voteInfo={null}
        assetCache={{}}
        isRankedMethod={false}
        entryAssetId={() => ''}
        onToggleSelection={onToggleSelection}
        onDisqualifiedSelectAttempt={vi.fn()}
        onProceedToRanking={vi.fn()}
        onSubmitVote={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    await userEvent.click(screen.getByText('Choice A'));
    expect(onToggleSelection).toHaveBeenCalledWith('entry-1', true);
    expect(onToggleSelection).toHaveBeenCalledTimes(1);
  });

  it('shows ranking controls when poll requires ranking', async () => {
    const onProceedToRanking = vi.fn();
    const poll = createPollResponse({ requireRanking: true, maxSelections: 2 });
    const entry = createEntryResponse({ id: 'entry-2', displayName: 'Rank Me', publicAssetId: 'asset-1' });

    render(
      <VotingSection
        poll={poll}
        entries={[entry]}
        voteState={{ 'entry-2': { selected: true, rank: '1' } }}
        voteSubmitting={false}
        voteInfo={null}
        assetCache={{ 'asset-1': createAsset() }}
        isRankedMethod
        entryAssetId={() => 'asset-1'}
        onToggleSelection={vi.fn()}
        onDisqualifiedSelectAttempt={vi.fn()}
        onProceedToRanking={onProceedToRanking}
        onSubmitVote={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    const button = screen.getByRole('button', { name: 'Continue to ranking' });
    expect(button).toBeEnabled();

    await userEvent.click(button);
    expect(onProceedToRanking).toHaveBeenCalledTimes(1);
  });

  it('renders entries in the order provided without resorting', () => {
    const poll = createPollResponse({ maxSelections: 3, requireRanking: false, titleRequirement: 1 });
    const entries = [
      createEntryResponse({ id: 'entry-1', displayName: 'First', publicAssetId: 'asset-1' }),
      createEntryResponse({ id: 'entry-2', displayName: 'Second', publicAssetId: 'asset-2' }),
      createEntryResponse({ id: 'entry-3', displayName: 'Third', publicAssetId: 'asset-3' })
    ];

    const assetCache = {
      'asset-1': createAsset({ id: 'asset-1', url: 'https://cdn.example.com/asset-1.png' }),
      'asset-2': createAsset({ id: 'asset-2', url: 'https://cdn.example.com/asset-2.png' }),
      'asset-3': createAsset({ id: 'asset-3', url: 'https://cdn.example.com/asset-3.png' })
    } as const;

    const { container } = render(
      <VotingSection
        poll={poll}
        entries={entries}
        voteState={{}}
        voteSubmitting={false}
        voteInfo={null}
        assetCache={assetCache}
        isRankedMethod={false}
        entryAssetId={(e) => e.publicAssetId ?? ''}
        onToggleSelection={vi.fn()}
        onDisqualifiedSelectAttempt={vi.fn()}
        onProceedToRanking={vi.fn()}
        onSubmitVote={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    const titles = Array.from(container.querySelectorAll('.entry-title')).map((el) => el.textContent?.trim());
    expect(titles).toEqual(['First', 'Second', 'Third']);
  });

  it('blocks selecting disqualified entries and raises attempt callback', async () => {
    const onToggleSelection = vi.fn();
    const onDisqualifiedSelectAttempt = vi.fn();
    const poll = createPollResponse({ maxSelections: 3 });
    const entry = createEntryResponse({ id: 'entry-1', displayName: 'Choice A', isDisqualified: true, disqualificationReason: 'Rule violation' });

    render(
      <VotingSection
        poll={poll}
        entries={[entry]}
        voteState={{}}
        voteSubmitting={false}
        voteInfo={null}
        assetCache={{}}
        isRankedMethod={false}
        entryAssetId={() => ''}
        onToggleSelection={onToggleSelection}
        onDisqualifiedSelectAttempt={onDisqualifiedSelectAttempt}
        onProceedToRanking={vi.fn()}
        onSubmitVote={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    await userEvent.click(screen.getByText('Choice A'));

    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(onToggleSelection).not.toHaveBeenCalled();
    expect(onDisqualifiedSelectAttempt).toHaveBeenCalledWith(expect.objectContaining({ id: 'entry-1' }));
  });

  it('shows a neutral Entry title when poll title field is off', () => {
    const poll = createPollResponse({ titleRequirement: 0, isAdmin: false });
    const entry = createEntryResponse({ id: 'entry-1', displayName: 'Hidden Title' });

    render(
      <VotingSection
        poll={poll}
        entries={[entry]}
        voteState={{}}
        voteSubmitting={false}
        voteInfo={null}
        assetCache={{}}
        isRankedMethod={false}
        entryAssetId={() => ''}
        onToggleSelection={vi.fn()}
        onDisqualifiedSelectAttempt={vi.fn()}
        onProceedToRanking={vi.fn()}
        onSubmitVote={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    expect(screen.getByText('Entry')).toBeInTheDocument();
    expect(screen.queryByText('Hidden Title')).not.toBeInTheDocument();
  });

  it('does not show submitter byline in voting view, even for admins', () => {
    const poll = createPollResponse({ isAdmin: true, titleRequirement: 1 });
    const entry = createEntryResponse({ id: 'entry-1', displayName: 'Choice A', submittedByDisplayName: 'Alice' });

    render(
      <VotingSection
        poll={poll}
        entries={[entry]}
        voteState={{}}
        voteSubmitting={false}
        voteInfo={null}
        assetCache={{}}
        isRankedMethod={false}
        entryAssetId={() => ''}
        onToggleSelection={vi.fn()}
        onDisqualifiedSelectAttempt={vi.fn()}
        onProceedToRanking={vi.fn()}
        onSubmitVote={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    expect(screen.queryByText('By:')).not.toBeInTheDocument();
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });
});
