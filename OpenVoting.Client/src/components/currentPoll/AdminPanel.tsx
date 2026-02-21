import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
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
  saveSuccessCount?: number;
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
    saveSuccessCount = 0,
    onMetaChange,
    onSubmissionChange,
    onVotingChange,
    onTransition,
    onDeletePoll,
    onSave
  } = props;

  const [expanded, setExpanded] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    setTitleTouched(false);
    setSubmitAttempted(false);
  }, [saveSuccessCount]);

  const titleMissing = metaForm.title.trim().length === 0;
  const showTitleInvalid = titleMissing && (titleTouched || submitAttempted);
  const noSubmissionFieldsEnabled = metaForm.titleRequirement === 0 && metaForm.descriptionRequirement === 0 && metaForm.imageRequirement === 0;
  const showSubmissionFieldsInvalid = noSubmissionFieldsEnabled && submitAttempted;
  const hasValidationErrors = showTitleInvalid || showSubmissionFieldsInvalid;

  const handleToggle = () => setExpanded((v) => !v);

  const handleSave = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setSubmitAttempted(true);
    if (titleMissing || noSubmissionFieldsEnabled) {
      return;
    }
    onSave();
  };

  return (
    <section className={`card admin-card${expanded ? '' : ' collapsed'}`}>
      <button
        type="button"
        className="section-head admin-toggle"
        onClick={handleToggle}
        aria-expanded={expanded}
      >
        <div>
          <p className="eyebrow">Admin</p>
          <h3>Poll controls</h3>
        </div>
        <div className="actions">
          <span className="pill admin">Admin</span>
        </div>
      </button>
      <div className="admin-collapse">
        <div className="admin-collapse-inner">
          <div className="actions admin-actions">
            {poll.status === 0 && <button type="button" className="primary" onClick={(e) => { e.stopPropagation(); onTransition(poll.id, 'open-submissions'); }}>Open submissions</button>}
            {poll.status === 1 && <button type="button" className="primary" onClick={(e) => { e.stopPropagation(); onTransition(poll.id, 'start-review'); }}>Start review</button>}
            {poll.status === 5 && <button type="button" className="primary" onClick={(e) => { e.stopPropagation(); onTransition(poll.id, 'open-voting'); }}>Open voting</button>}
            {poll.status === 2 && <button type="button" className="primary" onClick={(e) => { e.stopPropagation(); onTransition(poll.id, 'close'); }}>Close poll</button>}
            <button
              type="button"
              className="ghost danger"
              onClick={(e) => {
                e.stopPropagation();
                onDeletePoll(poll.id);
              }}
            >
              Delete poll
            </button>
          </div>

          <div className="stack">
            <div>
              <p className="eyebrow">Basics</p>
              <div className="form-grid">
                <label>Title
                  <input
                    value={metaForm.title}
                    className={showTitleInvalid ? 'input-invalid' : undefined}
                    aria-invalid={showTitleInvalid}
                    onBlur={() => setTitleTouched(true)}
                    onChange={(e) => onMetaChange({ ...metaForm, title: e.target.value })}
                  />
                  <span className={showTitleInvalid ? 'field-error' : 'field-hint'}>Required</span>
                </label>
                <label>Title field
                  <select value={metaForm.titleRequirement} onChange={(e) => onMetaChange({ ...metaForm, titleRequirement: Number(e.target.value) as FieldRequirement })}>
                    {requirementOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
                <label>Description field
                  <select
                    className={showSubmissionFieldsInvalid ? 'input-invalid' : undefined}
                    aria-invalid={showSubmissionFieldsInvalid}
                    value={metaForm.descriptionRequirement}
                    onChange={(e) => onMetaChange({ ...metaForm, descriptionRequirement: Number(e.target.value) as FieldRequirement })}
                  >
                    {requirementOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
                <label>Image field
                  <select
                    className={showSubmissionFieldsInvalid ? 'input-invalid' : undefined}
                    aria-invalid={showSubmissionFieldsInvalid}
                    value={metaForm.imageRequirement}
                    onChange={(e) => onMetaChange({ ...metaForm, imageRequirement: Number(e.target.value) as FieldRequirement })}
                  >
                    {requirementOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
                <label className="full-row">Description
                  <textarea rows={3} value={metaForm.description} onChange={(e) => onMetaChange({ ...metaForm, description: e.target.value })} />
                  <span className="field-hint">Optional</span>
                </label>
                <div className="full-row">
                  <span className={showSubmissionFieldsInvalid ? 'field-error' : 'field-hint'}>At least one submission field (title, description, or image) must be enabled</span>
                </div>
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
                <p className="muted">Leave blank to close manually</p>
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
                <p className="muted">Leave blank to close manually</p>
              </div>
            )}

            {submitAttempted && hasValidationErrors && (
              <div className="banner error form-validation-banner">Please correct the validation errors</div>
            )}

            <div className="actions form-actions spacious">
              <button className="ghost" onClick={handleSave} disabled={settingsSaving}>
                {settingsSaving ? 'Saving…' : 'Save poll settings'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
