import { useEffect, useState } from 'react';
import { AuthPrompt } from './AuthPrompt';
import type { Dispatch, SetStateAction } from 'react';
import type { CreatePollForm, SessionState } from '../types';

export type AdminPageProps = {
  sessionState: SessionState;
  me: { isAdmin: boolean } | null;
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

export function AdminPage({ sessionState, me, createForm, setCreateForm, creating, createError, createSuccessCount = 0, onCreatePoll, onLogin, loginCta, loginDisabled }: AdminPageProps) {
  if (sessionState !== 'authenticated') {
    return <AuthPrompt onLogin={onLogin} loginCta={loginCta} loginDisabled={loginDisabled} />;
  }

  if (!me?.isAdmin) {
    return <section className="card"><p>You need admin access to manage polls</p></section>;
  }

  const [titleTouched, setTitleTouched] = useState(false);
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const titleMissing = createForm.title.trim().length === 0;
  const showTitleInvalid = titleMissing && (titleTouched || submitAttempted);
  const showDescriptionInvalid = false && descriptionTouched;
  const hasValidationErrors = showTitleInvalid;

  const handleCreate = () => {
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

  return (
    <div className="stack">
      <section className="card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Admin</p>
            <h2>Create poll</h2>
          </div>
        </div>
        <div className="form-grid">
          <label>Title
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
      </section>
    </div>
  );
}
