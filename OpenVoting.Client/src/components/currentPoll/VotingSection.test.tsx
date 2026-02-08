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
        onProceedToRanking={vi.fn()}
        onSubmitVote={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    await userEvent.click(screen.getByText('Choice A'));
    expect(onToggleSelection).toHaveBeenCalledWith('entry-1', true);
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
});
