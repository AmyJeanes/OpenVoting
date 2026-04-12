import { render, screen } from '@testing-library/react';
import { AdminEntriesSection } from './AdminEntriesSection';
import { createAsset, createEntryResponse, createPollResponse } from '../../test/factories';
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
        winners={[]}
        irvVotesByEntryId={new Map<string, number>()}
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
    expect(screen.getByText('Entry One').closest('.entry-card')).toHaveClass('unavailable');
  });

  it('uses dedicated styling class for requalify action', () => {
    const poll = createPollResponse({ isAdmin: true, status: 2, votingMethod: 1 });
    const entry = createEntryResponse({ id: 'entry-1', isDisqualified: true });

    render(
      <AdminEntriesSection
        poll={poll}
        winners={[]}
        irvVotesByEntryId={new Map<string, number>()}
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

  it('shows Entry when optional title value matches poll title fallback', () => {
    const poll = createPollResponse({ title: 'Spring Contest', titleRequirement: 1, isAdmin: true, status: 2 });
    const entry = createEntryResponse({ id: 'entry-1', displayName: 'Spring Contest' });

    render(
      <AdminEntriesSection
        poll={poll}
        winners={[]}
        irvVotesByEntryId={new Map<string, number>()}
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

    expect(screen.getByText('Entry')).toBeInTheDocument();
    expect(screen.queryByText('Spring Contest')).not.toBeInTheDocument();
  });

  it('applies bottom action alignment class to admin entry cards', () => {
    const poll = createPollResponse({ isAdmin: true, status: 2 });
    const entry = createEntryResponse({ id: 'entry-1', displayName: 'Entry One' });

    render(
      <AdminEntriesSection
        poll={poll}
        winners={[]}
        irvVotesByEntryId={new Map<string, number>()}
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

    expect(screen.getByText('Entry One').closest('.entry-card')).toHaveClass('with-bottom-actions');
  });

  it('renders description below the image in admin view', () => {
    const poll = createPollResponse({ isAdmin: true, status: 2 });
    const entry = createEntryResponse({ id: 'entry-1', displayName: 'Entry One', description: 'Description text', publicAssetId: 'asset-1' });

    render(
      <AdminEntriesSection
        poll={poll}
        winners={[]}
        irvVotesByEntryId={new Map<string, number>()}
        entries={[entry]}
        entriesLoading={false}
        votingBreakdown={[]}
        votingBreakdownError={null}
        breakdownByEntryId={new Map<string, VotingBreakdownEntry>()}
        assetCache={{ 'asset-1': createAsset({ id: 'asset-1', url: 'https://example.com/image.png' }) }}
        entryAssetId={(e) => e.publicAssetId ?? ''}
        onAskDisqualify={vi.fn()}
        onRequalify={vi.fn()}
        onAskDelete={vi.fn()}
      />
    );

    const imageButton = screen.getByRole('button', { name: 'Entry One' });
    const description = screen.getByText('Description text');

    expect(imageButton.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
