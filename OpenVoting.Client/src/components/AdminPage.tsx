import { useEffect } from 'react';
import { AuthPrompt } from './AuthPrompt';
import { useToast } from './ToastProvider';
import type { Dispatch, SetStateAction } from 'react';
import type { CreatePollForm, SessionState } from '../types';

export type AdminPageProps = {
  sessionState: SessionState;
  me: { isAdmin: boolean } | null;
  createForm: CreatePollForm;
  setCreateForm: Dispatch<SetStateAction<CreatePollForm>>;
  creating: boolean;
  createError: string | null;
  onCreatePoll: () => void;
};

export function AdminPage({ sessionState, me, createForm, setCreateForm, creating, createError, onCreatePoll }: AdminPageProps) {
  if (sessionState !== 'authenticated') {
    return <AuthPrompt />;
  }

  if (!me?.isAdmin) {
    return <section className="card"><p>You need admin access to manage polls.</p></section>;
  }

  const { showToast } = useToast();

  useEffect(() => {
    if (createError) showToast(createError, { tone: 'error' });
  }, [createError, showToast]);

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
            <input value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} />
          </label>
          <label className="full-row">Description
            <textarea rows={3} value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
          </label>
        </div>
        <div className="actions form-actions spacious">
          <button className="primary" onClick={onCreatePoll} disabled={creating}>{creating ? 'Creating…' : 'Create poll'}</button>
        </div>
      </section>
    </div>
  );
}
