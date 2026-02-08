import type { FieldRequirement, PollResponse } from '../../types';
import { votingMethodLabel } from '../../utils/format';
import { VotingMethodInfo } from '../VotingMethodInfo';

export type AdminPanelProps = {
  poll: PollResponse;
  showSubmissionSettings: boolean;
  showVotingSettings: boolean;
  metaForm: {
    title: string;
    description: string;
    titleRequirement: FieldRequirement;
    descriptionRequirement: FieldRequirement;
    imageRequirement: FieldRequirement;
  };
  submissionForm: { maxSubmissionsPerMember: number; submissionClosesAt: string };
  votingForm: { maxSelections: number; votingClosesAt: string };
  requirementOptions: Array<{ value: FieldRequirement; label: string }>;
  settingsSaving: boolean;
  onMetaChange: (form: AdminPanelProps['metaForm']) => void;
  onSubmissionChange: (form: AdminPanelProps['submissionForm']) => void;
  onVotingChange: (form: AdminPanelProps['votingForm']) => void;
  onTransition: (pollId: string, path: string) => void;
  onDeletePoll: (pollId: string) => void;
  onSave: () => void;
};

export function AdminPanel(props: AdminPanelProps) {
  const {
    poll,
    showSubmissionSettings,
    showVotingSettings,
    metaForm,
    submissionForm,
    votingForm,
    requirementOptions,
    settingsSaving,
    onMetaChange,
    onSubmissionChange,
    onVotingChange,
    onTransition,
    onDeletePoll,
    onSave
  } = props;

  return (
    <section className="card admin-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h3>Poll controls</h3>
        </div>
        <span className="pill">Admin</span>
      </div>
      <p className="muted">Only admins see this. Use with care.</p>
      <div className="actions admin-actions">
        {poll.status === 0 && <button className="primary" onClick={() => onTransition(poll.id, 'open-submissions')}>Open submissions</button>}
        {poll.status === 1 && <button className="primary" onClick={() => onTransition(poll.id, 'start-review')}>Start review</button>}
        {poll.status === 5 && <button className="primary" onClick={() => onTransition(poll.id, 'open-voting')}>Open voting</button>}
        {poll.status === 2 && <button className="ghost" onClick={() => onTransition(poll.id, 'close')}>Close poll</button>}
        <button className="ghost" onClick={() => onDeletePoll(poll.id)}>Delete poll</button>
      </div>

      <div className="stack">
        <div>
          <p className="eyebrow">Basics</p>
          <div className="form-grid">
            <label>Title
              <input value={metaForm.title} onChange={(e) => onMetaChange({ ...metaForm, title: e.target.value })} />
            </label>
            <label>Title field
              <select value={metaForm.titleRequirement} onChange={(e) => onMetaChange({ ...metaForm, titleRequirement: Number(e.target.value) as FieldRequirement })}>
                {requirementOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label>Description field
              <select value={metaForm.descriptionRequirement} onChange={(e) => onMetaChange({ ...metaForm, descriptionRequirement: Number(e.target.value) as FieldRequirement })}>
                {requirementOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label>Image field
              <select value={metaForm.imageRequirement} onChange={(e) => onMetaChange({ ...metaForm, imageRequirement: Number(e.target.value) as FieldRequirement })}>
                {requirementOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label className="full-row">Description
              <textarea rows={3} value={metaForm.description} onChange={(e) => onMetaChange({ ...metaForm, description: e.target.value })} />
            </label>
          </div>
        </div>

        {showSubmissionSettings && (
          <div>
            <p className="eyebrow">Submission stage</p>
            <div className="form-grid">
              <label>Max submissions per member
                <input
                  type="number"
                  min={1}
                  value={submissionForm.maxSubmissionsPerMember}
                  onChange={(e) => onSubmissionChange({ ...submissionForm, maxSubmissionsPerMember: Math.max(1, Number(e.target.value)) })}
                />
              </label>
              <label>Auto-close submissions (optional)
                <input
                  type="datetime-local"
                  value={submissionForm.submissionClosesAt}
                  onChange={(e) => onSubmissionChange({ ...submissionForm, submissionClosesAt: e.target.value })}
                />
              </label>
            </div>
            <p className="muted">Leave blank to close manually.</p>
          </div>
        )}

        {showVotingSettings && (
          <div>
            <p className="eyebrow">Voting stage</p>
            <p className="muted">
              Voting method: {votingMethodLabel(poll.votingMethod)} (locked once voting starts)
              {' '}<VotingMethodInfo method={poll.votingMethod} />
            </p>
            <div className="form-grid">
              <label>Max selections
                <input
                  type="number"
                  min={1}
                  value={votingForm.maxSelections}
                  onChange={(e) => onVotingChange({ ...votingForm, maxSelections: Math.max(1, Number(e.target.value)) })}
                />
              </label>
              <label>Auto-close voting (optional)
                <input
                  type="datetime-local"
                  value={votingForm.votingClosesAt}
                  onChange={(e) => onVotingChange({ ...votingForm, votingClosesAt: e.target.value })}
                />
              </label>
            </div>
            <p className="muted">Leave blank to close manually.</p>
          </div>
        )}

        <div className="actions form-actions spacious">
          <button className="ghost" onClick={onSave} disabled={settingsSaving}>
            {settingsSaving ? 'Saving…' : 'Save poll settings'}
          </button>
        </div>
      </div>
    </section>
  );
}
