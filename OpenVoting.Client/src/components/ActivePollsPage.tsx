import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthPrompt } from './AuthPrompt';
import { useToast } from './ToastProvider';
import type { Dispatch, SetStateAction } from 'react';
import type { CreatePollForm, PollResponse, SessionState } from '../types';
import { formatWindow, pollStatusLabel } from '../utils/format';

export type ActivePollsPageProps = {
  sessionState: SessionState;
  me: { isAdmin: boolean } | null;
  activePolls: PollResponse[];
  pollError: string | null;
  loading: boolean;
  onRefresh: () => Promise<void> | void;
  createForm: CreatePollForm;
  setCreateForm: Dispatch<SetStateAction<CreatePollForm>>;
  creating: boolean;
  createError: string | null;
  createSuccessCount?: number;
  onCreatePoll: () => void;
  onLogin: () => void;
  loginCta: string;
  loginDisabled: boolean;
};

export function ActivePollsPage({ sessionState, me, activePolls, pollError, loading, onRefresh, createForm, setCreateForm, creating, createError, createSuccessCount = 0, onCreatePoll, onLogin, loginCta, loginDisabled }: ActivePollsPageProps) {
  if (sessionState !== 'authenticated') {
    return <AuthPrompt onLogin={onLogin} loginCta={loginCta} loginDisabled={loginDisabled} />;
  }

  const { showToast } = useToast();
  const [adminExpanded, setAdminExpanded] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const titleMissing = createForm.title.trim().length === 0;
  const showTitleInvalid = titleMissing && (titleTouched || submitAttempted);
  const showDescriptionInvalid = false && descriptionTouched;
  const hasValidationErrors = showTitleInvalid;

  const handleCreate = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setSubmitAttempted(true);
    if (titleMissing) {
      return;
    }
    onCreatePoll();
  };

  useEffect(() => {
    setTitleTouched(false);
    setDescriptionTouched(false);
    setSubmitAttempted(false);
  }, [createSuccessCount]);

  useEffect(() => {
    if (pollError) showToast(pollError, { tone: 'error' });
  }, [pollError, showToast]);

  return (
    <div className="stack">
      {me?.isAdmin && (
        <section className={`card admin-card${adminExpanded ? '' : ' collapsed'}`}>
          <button
            type="button"
            className="section-head admin-toggle"
            onClick={() => setAdminExpanded((v) => !v)}
            aria-expanded={adminExpanded}
            aria-label="Toggle create poll panel"
          >
            <div>
              <p className="eyebrow">Admin</p>
              <h2>Create poll</h2>
            </div>
            <div className="actions">
              <span className="pill admin">Admin</span>
            </div>
          </button>
          <div className="admin-collapse">
            <div className="admin-collapse-inner">
              <div className="stack">
                <div className="form-grid">
                  <label className="full-row">Title
                    <input
                      value={createForm.title}
                      className={showTitleInvalid ? 'input-invalid' : undefined}
                      aria-invalid={showTitleInvalid}
                      onBlur={() => setTitleTouched(true)}
                      onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    />
                    <span className={showTitleInvalid ? 'field-error' : 'field-hint'}>Required</span>
                  </label>
                  <label className="full-row">Description
                    <textarea
                      rows={3}
                      value={createForm.description}
                      className={showDescriptionInvalid ? 'input-invalid' : undefined}
                      aria-invalid={showDescriptionInvalid}
                      onBlur={() => setDescriptionTouched(true)}
                      onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    />
                    <span className="field-hint">Optional</span>
                  </label>
                </div>
                {submitAttempted && hasValidationErrors && (
                  <div className="banner error form-validation-banner">Please correct the validation errors</div>
                )}
                {createError && <div className="banner error form-validation-banner">{createError}</div>}
                <div className="actions form-actions spacious">
                  <button className="primary" onClick={handleCreate} disabled={creating}>{creating ? 'Creating…' : 'Create poll'}</button>
                </div>
              </div>
            </div>
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
        {!loading && activePolls.length === 0 && !pollError && <p className="muted">No active polls right now</p>}
        {!loading && activePolls.length > 0 && (
          <ul className="entries poll-list">
            {activePolls.map((p) => {
              const statusPillClass = p.status === 0 ? 'pill status admin' : 'pill status live';
              const entryClass = p.status === 0 ? 'entry-card draft' : 'entry-card';
              return (
                <li key={p.id} className={entryClass}>
                  <div className="entry-head">
                    <div className="entry-head-main">
                      <p className="entry-title live-title">{p.title}</p>
                    </div>
                    <div className="badges entry-badges">
                      <span className={statusPillClass}>{pollStatusLabel(p.status)}</span>
                    </div>
                  </div>
                  <div className="live-poll-details">
                    {p.description && <p className="muted multiline">{p.description}</p>}
                    <p className="muted">Submissions: {formatWindow(p.submissionOpensAt, p.submissionClosesAt)}</p>
                    {(p.status === 2 || p.status === 3 || p.status === 4) && (
                      <p className="muted">Voting: {formatWindow(p.votingOpensAt, p.votingClosesAt)}</p>
                    )}
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
