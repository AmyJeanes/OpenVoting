import { useEffect } from 'react';
import { AuthPrompt } from './AuthPrompt';
import { useToast } from './ToastProvider';
import type { Dispatch, SetStateAction } from 'react';
import type { FieldRequirement, SessionState } from '../types';

export type AdminPageProps = {
  sessionState: SessionState;
  me: { isAdmin: boolean } | null;
  createForm: {
    title: string;
    description: string;
    votingMethod: number;
    titleRequirement: FieldRequirement;
    descriptionRequirement: FieldRequirement;
    imageRequirement: FieldRequirement;
  };
  setCreateForm: Dispatch<SetStateAction<AdminPageProps['createForm']>>;
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

  const requirementOptions = [
    { value: 0, label: 'Off' },
    { value: 1, label: 'Optional' },
    { value: 2, label: 'Required' }
  ];

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
        <div className="actions">
          <button className="primary" onClick={onCreatePoll} disabled={creating}>{creating ? 'Creating…' : 'Create poll'}</button>
        </div>
      </section>
    </div>
  );
}
