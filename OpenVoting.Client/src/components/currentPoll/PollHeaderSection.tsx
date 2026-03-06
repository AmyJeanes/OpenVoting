import { Link } from 'react-router-dom';
import type { PollResponse } from '../../types';
import { formatWindow, isMaxTimestamp, pollStatusLabel, shouldShowVotingMethod, votingMethodLabel } from '../../utils/format';
import { VotingMethodInfo } from '../VotingMethodInfo';
import { MarkdownText } from '../MarkdownText';

export type PollHeaderSectionProps = {
  poll: PollResponse | null;
  onRefreshPoll: () => Promise<void> | void;
};

export function PollHeaderSection({ poll, onRefreshPoll }: PollHeaderSectionProps) {
  const showVotingWindow = !!poll && (poll.status === 2 || poll.status === 3 || poll.status === 4 || poll.status === 5) && !isMaxTimestamp(poll.votingOpensAt);
  const showVotingMethod = !!poll && shouldShowVotingMethod(poll.status, poll.votingMethod);

  return (
    <section className="card" data-testid="current-poll-header">
      <div className="section-head poll-header-head">
        <div className="poll-header-main">
          <div className="poll-header-title-row">
            <div className="poll-header-copy">
              <p className="eyebrow">Poll</p>
              <h2>{poll ? poll.title : 'No active competition'}</h2>
            </div>
            <div className="actions poll-header-actions">
              <Link className="ghost" to="/polls/live" data-testid="current-poll-back-link">Back to live polls</Link>
              <button className="ghost" onClick={onRefreshPoll} data-testid="current-poll-refresh-button">Refresh</button>
            </div>
          </div>
          {poll && poll.description && <MarkdownText content={poll.description} className="muted poll-header-description" />}
        </div>
      </div>
      {!poll && <p className="muted">No data for this poll. It may have closed or been removed</p>}
      {poll && (
        <div className="details-grid poll-header-details">
          <div>
            <p className="muted">Status</p>
            <p className="metric poll-header-detail-value">{pollStatusLabel(poll.status)}</p>
          </div>
          <div>
            <p className="muted">Total votes</p>
            <p className="metric poll-header-detail-value">{poll.totalVotes}</p>
          </div>
          {showVotingMethod && (
            <div>
              <p className="muted">Voting method</p>
              <div className="metric-row">
                <p className="metric poll-header-detail-value">{votingMethodLabel(poll.votingMethod)}</p>
                <VotingMethodInfo method={poll.votingMethod} />
              </div>
            </div>
          )}
          <div>
            <p className="muted">Submission window</p>
            <p className="poll-header-detail-value">{formatWindow(poll.submissionOpensAt, poll.submissionClosesAt)}</p>
          </div>
          {showVotingWindow && (
            <div>
              <p className="muted">Voting window</p>
              <p className="poll-header-detail-value">{formatWindow(poll.votingOpensAt, poll.votingClosesAt)}</p>
            </div>
          )}
          {poll.mustHaveJoinedBefore && (
            <div>
              <p className="muted">Join cutoff</p>
              <p className="poll-header-detail-value">{new Date(poll.mustHaveJoinedBefore).toLocaleString()}</p>
            </div>
          )}
          {poll.requiredRoleIds.length > 0 && (
            <div>
              <p className="muted">Required roles</p>
              <p className="poll-header-detail-value">{poll.requiredRoleIds.join(', ')}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
