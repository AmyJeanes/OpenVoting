import { render, screen } from '@testing-library/react';
import { AdminEntriesSection } from './AdminEntriesSection';
import { createEntryResponse, createPollResponse } from '../../test/factories';
import type { VotingBreakdownEntry } from '../../types';

describe('AdminEntriesSection', () => {
  it('renders clearer disqualification metadata text', () => {
    const poll = createPollResponse({ isAdmin: true, status: 2, votingMethod: 1 });
    const entry = createEntryResponse({
      id: 'entry-1',
      displayName: 'Entry One',
      isDisqualified: true,
      disqualificationReason: 'Bad picture',
      disqualifiedByDisplayName: 'Alice Mod',
      disqualifiedAt: '2026-02-22T10:00:00.000Z'
    });

    render(
      <AdminEntriesSection
        poll={poll}
        entries={[entry]}
        entriesLoading={false}
        votingBreakdown={[]}
        votingBreakdownError={null}
        breakdownByEntryId={new Map<string, VotingBreakdownEntry>()}
        assetCache={{}}
        entryAssetId={() => ''}
        onAskDisqualify={vi.fn()}
        onRequalify={vi.fn()}
        onAskDelete={vi.fn()}
      />
    );

    expect(screen.getByText(/Disqualified by Alice Mod/)).toBeInTheDocument();
    expect(screen.getByText('Disqualified: Bad picture')).toBeInTheDocument();
  });

  it('uses dedicated styling class for requalify action', () => {
    const poll = createPollResponse({ isAdmin: true, status: 2, votingMethod: 1 });
    const entry = createEntryResponse({ id: 'entry-1', isDisqualified: true });

    render(
      <AdminEntriesSection
        poll={poll}
        entries={[entry]}
        entriesLoading={false}
        votingBreakdown={[]}
        votingBreakdownError={null}
        breakdownByEntryId={new Map<string, VotingBreakdownEntry>()}
        assetCache={{}}
        entryAssetId={() => ''}
        onAskDisqualify={vi.fn()}
        onRequalify={vi.fn()}
        onAskDelete={vi.fn()}
      />
    );

    const button = screen.getByRole('button', { name: 'Requalify' });
    expect(button).toHaveClass('requalify');
  });
});
