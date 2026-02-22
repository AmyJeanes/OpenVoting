import { render, screen } from '@testing-library/react';
import { MySubmissionsSection } from './MySubmissionsSection';
import { createAsset, createEntryResponse, createPollResponse } from '../../test/factories';

describe('MySubmissionsSection', () => {
  it('renders description below the image', () => {
    const poll = createPollResponse({ titleRequirement: 2 });
    const entry = createEntryResponse({ id: 'entry-1', displayName: 'My Entry', description: 'Description text', originalAssetId: 'asset-1' });

    render(
      <MySubmissionsSection
        poll={poll}
        entries={[entry]}
        assetCache={{ 'asset-1': createAsset({ id: 'asset-1', url: 'https://example.com/image.png' }) }}
        entryAssetId={(e) => e.originalAssetId ?? ''}
        onAskDelete={vi.fn()}
      />
    );

    const imageButton = screen.getByRole('button', { name: 'My Entry' });
    const description = screen.getByText('Description text');

    expect(imageButton.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('uses Entry title for optional titles when entry display name equals poll title fallback', () => {
    const poll = createPollResponse({ title: 'Photo Contest', titleRequirement: 1 });
    const entry = createEntryResponse({ id: 'entry-1', displayName: 'Photo Contest', originalAssetId: undefined });

    render(
      <MySubmissionsSection
        poll={poll}
        entries={[entry]}
        assetCache={{}}
        entryAssetId={() => ''}
        onAskDelete={vi.fn()}
      />
    );

    expect(screen.getByText('Entry')).toBeInTheDocument();
    expect(screen.queryByText('Photo Contest')).not.toBeInTheDocument();
  });

  it('applies bottom action alignment class to submission cards', () => {
    const poll = createPollResponse();
    const entry = createEntryResponse({ id: 'entry-1', displayName: 'My Entry' });

    render(
      <MySubmissionsSection
        poll={poll}
        entries={[entry]}
        assetCache={{}}
        entryAssetId={() => ''}
        onAskDelete={vi.fn()}
      />
    );

    expect(screen.getByText('My Entry').closest('.entry-card')).toHaveClass('with-bottom-actions');
  });

  it('does not render By line in your submissions', () => {
    const poll = createPollResponse();
    const entry = createEntryResponse({ id: 'entry-1', displayName: 'My Entry', submittedByDisplayName: 'Divided' });

    render(
      <MySubmissionsSection
        poll={poll}
        entries={[entry]}
        assetCache={{}}
        entryAssetId={() => ''}
        onAskDelete={vi.fn()}
      />
    );

    expect(screen.queryByText('By:')).not.toBeInTheDocument();
    expect(screen.queryByText('Divided')).not.toBeInTheDocument();
  });
});
