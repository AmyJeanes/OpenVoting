import { Link } from 'react-router-dom';
import type { PollResponse } from '../../types';
import { formatWindow, isMaxTimestamp, pollStatusLabel, votingMethodLabel } from '../../utils/format';
import { VotingMethodInfo } from '../VotingMethodInfo';

export type PollHeaderSectionProps = {
  poll: PollResponse | null;
  onRefreshPoll: () => Promise<void> | void;
};

export function PollHeaderSection({ poll, onRefreshPoll }: PollHeaderSectionProps) {
  const showVotingWindow = !!poll && (poll.status === 2 || poll.status === 3 || poll.status === 4 || poll.status === 5) && !isMaxTimestamp(poll.votingOpensAt);

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Poll</p>
          <h2>{poll ? poll.title : 'No active competition'}</h2>
          {poll && <span className={`pill ${poll.status === 0 ? 'admin' : 'subtle'}`}>Stage: {pollStatusLabel(poll.status)}</span>}
          {poll && poll.description && <p className="muted multiline">{poll.description}</p>}
        </div>
        <div className="actions">
          <Link className="ghost" to="/polls/live">Back to live polls</Link>
          <button className="ghost" onClick={onRefreshPoll}>Refresh</button>
        </div>
      </div>
      {!poll && <p className="muted">No data for this poll. It may have closed or been removed</p>}
      {poll && (
        <div className="details-grid">
          <div>
            <p className="muted">Status</p>
            <p className="metric">{pollStatusLabel(poll.status)}</p>
          </div>
          <div>
            <p className="muted">Voting method</p>
            <div className="metric-row">
              <p className="metric">{votingMethodLabel(poll.votingMethod)}</p>
              <VotingMethodInfo method={poll.votingMethod} />
            </div>
          </div>
          <div>
            <p className="muted">Submission window</p>
            <p>{formatWindow(poll.submissionOpensAt, poll.submissionClosesAt)}</p>
          </div>
          {showVotingWindow && (
            <div>
              <p className="muted">Voting window</p>
              <p>{formatWindow(poll.votingOpensAt, poll.votingClosesAt)}</p>
            </div>
          )}
          {poll.mustHaveJoinedBefore && (
            <div>
              <p className="muted">Join cutoff</p>
              <p>{new Date(poll.mustHaveJoinedBefore).toLocaleString()}</p>
            </div>
          )}
          {poll.requiredRoleIds.length > 0 && (
            <div>
              <p className="muted">Required roles</p>
              <p>{poll.requiredRoleIds.join(', ')}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
