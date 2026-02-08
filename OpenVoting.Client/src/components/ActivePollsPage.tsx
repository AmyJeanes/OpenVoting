import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AuthPrompt } from './AuthPrompt';
import { useToast } from './ToastProvider';
import type { Dispatch, SetStateAction } from 'react';
import type { FieldRequirement, PollResponse, SessionState } from '../types';
import { formatWindow, pollStatusLabel, votingMethodLabel } from '../utils/format';

export type ActivePollsPageProps = {
  sessionState: SessionState;
  me: { isAdmin: boolean } | null;
  activePolls: PollResponse[];
  pollError: string | null;
  loading: boolean;
  onRefresh: () => Promise<void> | void;
  createForm: {
    title: string;
    description: string;
    votingMethod: number;
    titleRequirement: FieldRequirement;
    descriptionRequirement: FieldRequirement;
    imageRequirement: FieldRequirement;
  };
  setCreateForm: Dispatch<SetStateAction<ActivePollsPageProps['createForm']>>;
  creating: boolean;
  createError: string | null;
  onCreatePoll: () => void;
};

export function ActivePollsPage({ sessionState, me, activePolls, pollError, loading, onRefresh, createForm, setCreateForm, creating, createError, onCreatePoll }: ActivePollsPageProps) {
  if (sessionState !== 'authenticated') {
    return <AuthPrompt />;
  }

  const { showToast } = useToast();

  useEffect(() => {
    if (createError) showToast(createError, { tone: 'error' });
  }, [createError, showToast]);

  useEffect(() => {
    if (pollError) showToast(pollError, { tone: 'error' });
  }, [pollError, showToast]);

  const requirementOptions = [
    { value: 0, label: 'Off' },
    { value: 1, label: 'Optional' },
    { value: 2, label: 'Required' }
  ];

  return (
    <div className="stack">
      {me?.isAdmin && (
        <section className="card admin-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Admin</p>
              <h2>Create poll</h2>
              <p className="muted">Admin-only: create a new competition.</p>
            </div>
            <span className="pill subtle">Admin</span>
          </div>
          <div className="form-grid">
            <label>Title
              <input value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} />
            </label>
            <label>Description
              <input value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
            </label>
            <label>Title field
              <select value={createForm.titleRequirement} onChange={(e) => setCreateForm({ ...createForm, titleRequirement: Number(e.target.value) as FieldRequirement })}>
                {requirementOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </label>
            <label>Description field
              <select value={createForm.descriptionRequirement} onChange={(e) => setCreateForm({ ...createForm, descriptionRequirement: Number(e.target.value) as FieldRequirement })}>
                {requirementOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </label>
            <label>Image field
              <select value={createForm.imageRequirement} onChange={(e) => setCreateForm({ ...createForm, imageRequirement: Number(e.target.value) as FieldRequirement })}>
                {requirementOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </label>
          </div>
          <div className="actions form-actions">
            <button className="primary" onClick={onCreatePoll} disabled={creating}>{creating ? 'Creating…' : 'Create poll'}</button>
          </div>
        </section>
      )}

      <section className="card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Live polls</p>
            <h2>Select a poll to participate</h2>
          </div>
          <button className="ghost" onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {loading && <p className="muted">Loading live polls…</p>}
        {!loading && activePolls.length === 0 && !pollError && <p className="muted">No active polls right now.</p>}
        {!loading && activePolls.length > 0 && (
          <ul className="entries">
            {activePolls.map((p) => {
              const statusPillClass = p.status === 0 ? 'pill compact admin' : 'pill compact subtle';
              const entryClass = p.status === 0 ? 'entry-card draft' : 'entry-card';
              return (
                <li key={p.id} className={entryClass}>
                <div className="entry-head">
                  <div>
                    <p className="entry-title">{p.title}</p>
                    {p.description && <p className="muted">{p.description}</p>}
                    <p className="muted">Submissions: {formatWindow(p.submissionOpensAt, p.submissionClosesAt)}</p>
                    {(p.status === 2 || p.status === 3 || p.status === 4) && (
                      <p className="muted">Voting: {formatWindow(p.votingOpensAt, p.votingClosesAt)}</p>
                    )}
                  </div>
                  <div className="actions">
                      <span className={statusPillClass}>{pollStatusLabel(p.status)}</span>
                    <span className="pill compact subtle">{votingMethodLabel(p.votingMethod)}</span>
                  </div>
                </div>
                <div className="actions">
                  <Link className="primary" to={`/polls/${p.id}`}>View poll</Link>
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
