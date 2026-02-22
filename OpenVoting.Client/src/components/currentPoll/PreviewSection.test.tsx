import { render, screen } from '@testing-library/react';
import { PreviewSection } from './PreviewSection';
import { createEntryResponse, createPollResponse } from '../../test/factories';

describe('PreviewSection', () => {
  it('shows Entry when title requirement is off', () => {
    const poll = createPollResponse({ titleRequirement: 0 });
    const entry = createEntryResponse({ id: 'entry-1', displayName: 'Hidden title', teaserBlurHash: undefined });

    render(<PreviewSection poll={poll} entries={[entry]} />);

    expect(screen.getByText('Entry')).toBeInTheDocument();
    expect(screen.queryByText('Hidden title')).not.toBeInTheDocument();
  });

  it('shows Entry when optional title value matches poll title fallback', () => {
    const poll = createPollResponse({ title: 'Spring Contest', titleRequirement: 1 });
    const entry = createEntryResponse({ id: 'entry-1', displayName: 'Spring Contest', teaserBlurHash: undefined });

    render(<PreviewSection poll={poll} entries={[entry]} />);

    expect(screen.getByText('Entry')).toBeInTheDocument();
    expect(screen.queryByText('Spring Contest')).not.toBeInTheDocument();
  });
});
