import { useEffect, useRef, useState } from 'react';
import type { PollResponse } from '../../types';

export type SubmissionSectionProps = {
  poll: PollResponse;
  entryForm: { displayName: string; description: string };
  entrySubmitting: boolean;
  entryFiles: { original?: File };
  entryFileValidationPending: boolean;
  entryFileInvalid: boolean;
  entrySubmitError: string | null;
  entrySubmitSuccessCount?: number;
  submissionLimitReached: boolean;
  submissionsRemaining: number | null;
  showEntryTitleField: boolean;
  showEntryDescriptionField: boolean;
  maxUploadFileSizeMB?: number;
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
    entryFileValidationPending,
    entryFileInvalid,
    entrySubmitError,
    entrySubmitSuccessCount = 0,
    submissionLimitReached,
    submissionsRemaining,
    showEntryTitleField,
    showEntryDescriptionField,
    maxUploadFileSizeMB = 10,
    onEntryFormChange,
    onEntryFilesChange,
    onSubmitEntry
  } = props;

  const [titleTouched, setTitleTouched] = useState(false);
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const [imageTouched, setImageTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const imageValidationMessages = new Set([
    'Please upload an image file',
    `Images must be ${maxUploadFileSizeMB}MB or smaller`,
    `File exceeds the allowed limit of ${maxUploadFileSizeMB} MB`,
    'Images must be square (1:1 aspect ratio)',
    'Images must be at least 512×512',
    'Unable to read the selected image'
  ]);

  const isTitleMissing = showEntryTitleField && poll.titleRequirement === 2 && entryForm.displayName.trim().length === 0;
  const isDescriptionMissing = showEntryDescriptionField && poll.descriptionRequirement === 2 && entryForm.description.trim().length === 0;
  const isImageMissing = poll.imageRequirement === 2 && !entryFiles.original;
  const showTitleInvalid = isTitleMissing && (titleTouched || submitAttempted);
  const showDescriptionInvalid = isDescriptionMissing && (descriptionTouched || submitAttempted);
  const showImageMissingInvalid = isImageMissing && (imageTouched || submitAttempted);
  const imageRequirementsLabel = `${poll.imageRequirement === 2 ? 'Required' : 'Optional'} · Max ${maxUploadFileSizeMB}MB · Square · At least 512×512`;
  const descriptionHelperText = `${poll.descriptionRequirement === 2 ? 'Required' : 'Optional'} · Markdown supported`;
  const imageHelperText = imageRequirementsLabel;
  const hasValidationErrors = showTitleInvalid || showDescriptionInvalid || showImageMissingInvalid || entryFileInvalid;
  const showValidationBanner = submitAttempted && hasValidationErrors;
  const disableSubmit = entrySubmitting
    || submissionLimitReached
    || !poll.canSubmit;

  const handleSubmit = () => {
    const missingTitle = showEntryTitleField && poll.titleRequirement === 2 && entryForm.displayName.trim().length === 0;
    const missingDescription = showEntryDescriptionField && poll.descriptionRequirement === 2 && entryForm.description.trim().length === 0;
    const missingImage = poll.imageRequirement === 2 && !entryFiles.original;

    setSubmitAttempted(true);
    if (missingTitle || missingDescription || missingImage || entryFileInvalid) {
      if (poll.imageRequirement !== 0) {
        setImageTouched(true);
      }
      return;
    }
    onSubmitEntry();
  };

  useEffect(() => {
    setTitleTouched(false);
    setDescriptionTouched(false);
    setImageTouched(false);
    setSubmitAttempted(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [entrySubmitSuccessCount]);

  const ineligibleReason = poll.ineligibleToSubmitReason;

  return (
    <section className="card submission-card" data-testid="submission-section">
      <div className="section-head">
        <h3>Submit an entry</h3>
      </div>
      {ineligibleReason && (
        <div className="banner error ineligible-notice" role="status" data-testid="submission-ineligible-banner">
          Not eligible to submit: {ineligibleReason}
        </div>
      )}
      <div className="form-grid">
        <div className="form-row full-row">
          {showEntryTitleField && (
            <label className="grow">Title
              <input
                value={entryForm.displayName}
                        className={showTitleInvalid ? 'input-invalid' : undefined}
                        aria-invalid={showTitleInvalid}
                onBlur={() => setTitleTouched(true)}
                onChange={(e) => onEntryFormChange({ ...entryForm, displayName: e.target.value })}
                data-testid="submission-title-input"
              />
                      <span className={showTitleInvalid ? 'field-error' : 'field-hint'}>{poll.titleRequirement === 2 ? 'Required' : 'Optional'}</span>
            </label>
          )}
          {poll.imageRequirement !== 0 && (
                    <label className="auto">Upload image
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                        className={(showImageMissingInvalid || entryFileInvalid) ? 'input-invalid' : undefined}
                        aria-invalid={showImageMissingInvalid || entryFileInvalid}
                onClick={(e) => {
                  e.currentTarget.value = '';
                }}
                onChange={(e) => {
                  setImageTouched(true);
                  onEntryFilesChange({ ...entryFiles, original: e.target.files?.[0] ?? undefined });
                }}
                data-testid="submission-image-input"
              />
              <span className={(showImageMissingInvalid || entryFileInvalid) ? 'field-error' : 'field-hint'}>{imageHelperText}</span>
            </label>
          )}
        </div>
        {showEntryDescriptionField && (
          <label className="full-row">Description
            <textarea
              rows={3}
              value={entryForm.description}
              className={showDescriptionInvalid ? 'input-invalid' : undefined}
              aria-invalid={showDescriptionInvalid}
              onBlur={() => setDescriptionTouched(true)}
              onChange={(e) => onEntryFormChange({ ...entryForm, description: e.target.value })}
              data-testid="submission-description-input"
            />
            <span className={showDescriptionInvalid ? 'field-error' : 'field-hint'}>{descriptionHelperText}</span>
          </label>
        )}
      </div>
      {submissionLimitReached && (
        <p className="muted submission-limit-warning">
          You have reached the submission limit for this poll
          {poll.maxSubmissionsPerMember > 0 ? ` (${poll.maxSubmissionsPerMember} total)` : ''}
        </p>
      )}
      {!submissionLimitReached && submissionsRemaining !== null && (
        <p className="muted">
          Submissions remaining: {submissionsRemaining} of {poll.maxSubmissionsPerMember}
        </p>
      )}
      {entryFileValidationPending && <p className="muted">Validating image…</p>}
      {showValidationBanner && (
        <div className="banner error form-validation-banner">Please correct the validation errors</div>
      )}
      {!!entrySubmitError && !imageValidationMessages.has(entrySubmitError) && entrySubmitError !== 'Title is required' && entrySubmitError !== 'Description is required' && entrySubmitError !== 'Upload an image to submit' && <div className="banner error">{entrySubmitError}</div>}
      <div className="actions form-actions spacious">
        <button className="primary" onClick={handleSubmit} disabled={disableSubmit} data-testid="submission-submit-button">
          {entrySubmitting ? 'Submitting…' : 'Submit entry'}
        </button>
      </div>
    </section>
  );
}

export default SubmissionSection;
