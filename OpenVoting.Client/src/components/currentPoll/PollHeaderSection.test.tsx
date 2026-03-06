import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PollHeaderSection } from './PollHeaderSection';
import { createPollResponse } from '../../test/factories';

describe('PollHeaderSection', () => {
  it('hides the voting method before voting starts', () => {
    render(
      <MemoryRouter>
        <PollHeaderSection poll={createPollResponse({ status: 0, votingMethod: 1 })} onRefreshPoll={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.queryByText('Voting method')).not.toBeInTheDocument();
    expect(screen.queryByText('Approval')).not.toBeInTheDocument();
  });

  it('shows the voting method once voting has started', () => {
    render(
      <MemoryRouter>
        <PollHeaderSection poll={createPollResponse({ status: 2, votingMethod: 1 })} onRefreshPoll={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByText('Voting method')).toBeInTheDocument();
    expect(screen.getByText('Approval')).toBeInTheDocument();
  });
});