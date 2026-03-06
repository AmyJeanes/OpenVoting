import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PollDetailPage } from './PollDetailPage';
import type { PollDetailResponse } from '../types';

const iso = () => new Date('2024-01-01T00:00:00.000Z').toISOString();

function createPollDetail(overrides: Partial<PollDetailResponse> = {}): PollDetailResponse {
  return {
    id: 'poll-1',
    title: 'Sample Poll',
    description: 'Description',
    status: 1,
    votingMethod: 1,
    submissionOpensAt: iso(),
    submissionClosesAt: iso(),
    votingOpensAt: iso(),
    votingClosesAt: iso(),
    hideEntriesUntilVoting: false,
    maxSelections: 2,
    requireRanking: false,
    totalVotes: 7,
    titleRequirement: 1,
    descriptionRequirement: 1,
    imageRequirement: 1,
    winners: [],
    entries: [],
    ...overrides
  };
}

function renderPage(detail: PollDetailResponse) {
  return render(
    <MemoryRouter initialEntries={['/polls/poll-1']}>
      <Routes>
        <Route
          path="/polls/:pollId"
          element={<PollDetailPage sessionState="authenticated" fetchDetail={vi.fn().mockResolvedValue(detail)} assetCache={{}} />}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('PollDetailPage', () => {
  it('hides total votes before voting starts', async () => {
    renderPage(createPollDetail({ status: 1, totalVotes: 7 }));

    expect(await screen.findByText('Sample Poll')).toBeInTheDocument();
    expect(screen.queryByText('Total votes')).not.toBeInTheDocument();
    expect(screen.queryByText('7')).not.toBeInTheDocument();
  });

  it('shows total votes once voting has started', async () => {
    renderPage(createPollDetail({ status: 2, totalVotes: 7 }));

    expect(await screen.findByText('Sample Poll')).toBeInTheDocument();
    expect(screen.getByText('Total votes')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });
});