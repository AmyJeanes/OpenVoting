import type { PollResponse } from '../../types';

export type SubmissionSectionProps = {
  poll: PollResponse;
  entryForm: { displayName: string; description: string };
  entrySubmitting: boolean;
  entryFiles: { original?: File };
  submissionLimitReached: boolean;
  submissionsRemaining: number | null;
  showEntryTitleField: boolean;
  showEntryDescriptionField: boolean;
  onEntryFormChange: (form: SubmissionSectionProps['entryForm']) => void;
  onEntryFilesChange: (files: SubmissionSectionProps['entryFiles']) => void;
  onSubmitEntry: () => void;
};

export function SubmissionSection(props: SubmissionSectionProps) {
  const {
    poll,
    entryForm,
    entrySubmitting,
    entryFiles,
    submissionLimitReached,
    submissionsRemaining,
    showEntryTitleField,
    showEntryDescriptionField,
    onEntryFormChange,
    onEntryFilesChange,
    onSubmitEntry
  } = props;

  return (
    <section className="card">
      <div className="section-head">
        <h3>Submit an entry</h3>
      </div>
      <div className="form-grid">
        <div className="form-row full-row">
          {showEntryTitleField && (
            <label className="grow">Title
              <input value={entryForm.displayName} onChange={(e) => onEntryFormChange({ ...entryForm, displayName: e.target.value })} />
            </label>
          )}
          {poll.imageRequirement !== 0 && (
            <label className="auto">Upload image {poll.imageRequirement === 1 ? '(optional)' : ''}
              <input type="file" accept="image/*" onChange={(e) => onEntryFilesChange({ ...entryFiles, original: e.target.files?.[0] ?? undefined })} />
            </label>
          )}
        </div>
        {showEntryDescriptionField && (
          <label className="full-row">Description
            <textarea rows={3} value={entryForm.description} onChange={(e) => onEntryFormChange({ ...entryForm, description: e.target.value })} />
          </label>
        )}
      </div>
      {submissionLimitReached && (
        <p className="muted">
          You have reached the submission limit for this poll
          {poll.maxSubmissionsPerMember > 0 ? ` (${poll.maxSubmissionsPerMember} total).` : '.'}
        </p>
      )}
      {!submissionLimitReached && submissionsRemaining !== null && (
        <p className="muted">Submissions remaining: {submissionsRemaining} of {poll.maxSubmissionsPerMember}.</p>
      )}
      {!poll.canSubmit && !submissionLimitReached && <p className="muted">Submissions are closed for this poll.</p>}
      <div className="actions form-actions">
        <button className="primary" onClick={onSubmitEntry} disabled={entrySubmitting || submissionLimitReached || !poll.canSubmit}>
          {entrySubmitting ? 'Submitting…' : 'Submit entry'}
        </button>
      </div>
    </section>
  );
}
