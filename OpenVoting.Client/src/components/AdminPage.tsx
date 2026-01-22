import { AuthPrompt } from './AuthPrompt';
import type { SessionState } from '../types';

export type AdminPageProps = {
  sessionState: SessionState;
  me: { isAdmin: boolean } | null;
  createForm: {
    title: string;
    description: string;
    votingMethod: number;
  };
  setCreateForm: (form: AdminPageProps['createForm']) => void;
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
          <label>Description
            <input value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
          </label>
        </div>
        {createError && <p className="error">{createError}</p>}
        <div className="actions">
          <button className="primary" onClick={onCreatePoll} disabled={creating}>{creating ? 'Creating…' : 'Create poll'}</button>
        </div>
      </section>
    </div>
  );
}
