import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RankingModal } from './RankingModal';
import { createAsset, createEntryResponse, createPollResponse } from '../../test/factories';

describe('RankingModal', () => {
  const rankedEntries = [createEntryResponse({ id: 'entry-1', displayName: 'First pick' })];
  const poll = createPollResponse({ requireRanking: true });

  it('renders nothing when closed', () => {
    const { container } = render(
      <RankingModal
        open={false}
        poll={poll}
        rankedEntries={rankedEntries}
        draggingId={null}
        dragOverId={null}
        dragOverAfter={false}
        hasRankChanges={false}
        voteSubmitting={false}
        hasExistingVote={false}
        assetCache={{}}
        entryAssetId={() => ''}
        onBackToSelection={vi.fn()}
        onSubmitRanks={vi.fn()}
        onMoveRank={vi.fn()}
        onDragStart={vi.fn()}
        onDragOverItem={vi.fn()}
        onDropOnItem={vi.fn()}
        onDragEnd={vi.fn()}
        setItemRef={vi.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('disables submit when no rank changes and enables when changes exist', async () => {
    const onSubmitRanks = vi.fn();

    const { rerender } = render(
      <RankingModal
        open
        poll={poll}
        rankedEntries={rankedEntries}
        draggingId={null}
        dragOverId={null}
        dragOverAfter={false}
        hasRankChanges={false}
        voteSubmitting={false}
        hasExistingVote
        assetCache={{}}
        entryAssetId={() => ''}
        onBackToSelection={vi.fn()}
        onSubmitRanks={onSubmitRanks}
        onMoveRank={vi.fn()}
        onDragStart={vi.fn()}
        onDragOverItem={vi.fn()}
        onDropOnItem={vi.fn()}
        onDragEnd={vi.fn()}
        setItemRef={vi.fn()}
      />
    );

    const submitButton = screen.getByRole('button', { name: 'Update vote' });
    expect(submitButton).toBeDisabled();

    rerender(
      <RankingModal
        open
        poll={poll}
        rankedEntries={rankedEntries}
        draggingId={null}
        dragOverId={null}
        dragOverAfter={false}
        hasRankChanges
        voteSubmitting={false}
        hasExistingVote
        assetCache={{ 'asset-1': createAsset() }}
        entryAssetId={() => 'asset-1'}
        onBackToSelection={vi.fn()}
        onSubmitRanks={onSubmitRanks}
        onMoveRank={vi.fn()}
        onDragStart={vi.fn()}
        onDragOverItem={vi.fn()}
        onDropOnItem={vi.fn()}
        onDragEnd={vi.fn()}
        setItemRef={vi.fn()}
      />
    );

    const enabledButton = screen.getByRole('button', { name: 'Update vote' });
    expect(enabledButton).toBeEnabled();

    await userEvent.click(enabledButton);
    expect(onSubmitRanks).toHaveBeenCalledTimes(1);
  });
});
