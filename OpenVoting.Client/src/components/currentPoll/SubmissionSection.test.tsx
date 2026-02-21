import { fireEvent, render, screen } from '@testing-library/react';
import { SubmissionSection } from './SubmissionSection';
import { createPollResponse } from '../../test/factories';

describe('SubmissionSection', () => {
  it('clears file input value on click so selecting the same file re-triggers change', () => {
    render(
      <SubmissionSection
        poll={createPollResponse({ imageRequirement: 2 })}
        entryForm={{ displayName: '', description: '' }}
        entrySubmitting={false}
        entryFiles={{}}
        entryFileValidationPending={false}
        entryFileInvalid={false}
        entrySubmitError={null}
        submissionLimitReached={false}
        submissionsRemaining={2}
        showEntryTitleField
        showEntryDescriptionField
        onEntryFormChange={vi.fn()}
        onEntryFilesChange={vi.fn()}
        onSubmitEntry={vi.fn()}
      />
    );

    const input = screen.getByLabelText(/upload image/i) as HTMLInputElement;
    Object.defineProperty(input, 'value', { value: 'C:\\fakepath\\professor_booboo_by_lieveheersbeestje-d7mb7og.jpg', writable: true, configurable: true });

    fireEvent.click(input);

    expect(input.value).toBe('');
  });

  it('shows static required/optional helper text', () => {
    render(
      <SubmissionSection
        poll={createPollResponse({ titleRequirement: 2, descriptionRequirement: 1, imageRequirement: 1 })}
        entryForm={{ displayName: '', description: '' }}
        entrySubmitting={false}
        entryFiles={{}}
        entryFileValidationPending={false}
        entryFileInvalid={false}
        entrySubmitError={null}
        submissionLimitReached={false}
        submissionsRemaining={2}
        showEntryTitleField
        showEntryDescriptionField
        onEntryFormChange={vi.fn()}
        onEntryFilesChange={vi.fn()}
        onSubmitEntry={vi.fn()}
      />
    );

    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getAllByText('Required').length).toBe(1);
    expect(screen.getAllByText('Optional').length).toBe(2);
  });

  it('disables submit while image validation is pending', () => {
    render(
      <SubmissionSection
        poll={createPollResponse({ imageRequirement: 2 })}
        entryForm={{ displayName: '', description: '' }}
        entrySubmitting={false}
        entryFiles={{}}
        entryFileValidationPending
        entryFileInvalid={false}
        entrySubmitError={null}
        submissionLimitReached={false}
        submissionsRemaining={2}
        showEntryTitleField
        showEntryDescriptionField
        onEntryFormChange={vi.fn()}
        onEntryFilesChange={vi.fn()}
        onSubmitEntry={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Submit entry' })).toBeEnabled();
    expect(screen.getByText('Validating image…')).toBeInTheDocument();
  });

  it('shows image constraint error under upload after submit attempt', () => {
    const onSubmitEntry = vi.fn();
    const file = new File(['image'], 'bad.jpg', { type: 'image/jpeg' });
    render(
      <SubmissionSection
        poll={createPollResponse({ imageRequirement: 2 })}
        entryForm={{ displayName: '', description: '' }}
        entrySubmitting={false}
        entryFiles={{ original: file }}
        entryFileValidationPending={false}
        entryFileInvalid
        entrySubmitError="Images must be at least 512×512"
        submissionLimitReached={false}
        submissionsRemaining={2}
        showEntryTitleField
        showEntryDescriptionField
        onEntryFormChange={vi.fn()}
        onEntryFilesChange={vi.fn()}
        onSubmitEntry={onSubmitEntry}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Submit entry' }));

    expect(onSubmitEntry).not.toHaveBeenCalled();
    expect(screen.getByText('Please correct the validation errors')).toBeInTheDocument();
    expect(screen.getByText('Images must be at least 512×512')).toBeInTheDocument();
  });

  it('does not show required title error until interaction', () => {
    render(
      <SubmissionSection
        poll={createPollResponse({ titleRequirement: 2, imageRequirement: 0 })}
        entryForm={{ displayName: '', description: 'Description present' }}
        entrySubmitting={false}
        entryFiles={{}}
        entryFileValidationPending={false}
        entryFileInvalid={false}
        entrySubmitError={null}
        submissionLimitReached={false}
        submissionsRemaining={2}
        showEntryTitleField
        showEntryDescriptionField
        onEntryFormChange={vi.fn()}
        onEntryFilesChange={vi.fn()}
        onSubmitEntry={vi.fn()}
      />
    );

    expect(screen.queryByText('Title is required')).toBeNull();
    expect(screen.queryByText('Please correct the validation errors below')).toBeNull();
  });

  it('shows title and description required errors under fields after submit attempt', () => {
    const onSubmitEntry = vi.fn();
    render(
      <SubmissionSection
        poll={createPollResponse({ titleRequirement: 2, descriptionRequirement: 2, imageRequirement: 0 })}
        entryForm={{ displayName: '', description: '' }}
        entrySubmitting={false}
        entryFiles={{}}
        entryFileValidationPending={false}
        entryFileInvalid={false}
        entrySubmitError={null}
        submissionLimitReached={false}
        submissionsRemaining={2}
        showEntryTitleField
        showEntryDescriptionField
        onEntryFormChange={vi.fn()}
        onEntryFilesChange={vi.fn()}
        onSubmitEntry={onSubmitEntry}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Submit entry' }));

    expect(onSubmitEntry).not.toHaveBeenCalled();
    expect(screen.getByText('Please correct the validation errors')).toBeInTheDocument();
    expect(screen.getAllByText('Required').length).toBe(2);
  });

  it('shows image required error under upload after submit attempt', () => {
    const onSubmitEntry = vi.fn();
    render(
      <SubmissionSection
        poll={createPollResponse({ imageRequirement: 2, titleRequirement: 0, descriptionRequirement: 0 })}
        entryForm={{ displayName: 'A title', description: 'desc' }}
        entrySubmitting={false}
        entryFiles={{}}
        entryFileValidationPending={false}
        entryFileInvalid={false}
        entrySubmitError={null}
        submissionLimitReached={false}
        submissionsRemaining={2}
        showEntryTitleField
        showEntryDescriptionField
        onEntryFormChange={vi.fn()}
        onEntryFilesChange={vi.fn()}
        onSubmitEntry={onSubmitEntry}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Submit entry' }));

    expect(onSubmitEntry).not.toHaveBeenCalled();
    expect(screen.getByText('Please correct the validation errors')).toBeInTheDocument();
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('shows title required state only after title interaction', () => {
    render(
      <SubmissionSection
        poll={createPollResponse({ titleRequirement: 2, imageRequirement: 0, descriptionRequirement: 0 })}
        entryForm={{ displayName: '', description: '' }}
        entrySubmitting={false}
        entryFiles={{}}
        entryFileValidationPending={false}
        entryFileInvalid={false}
        entrySubmitError={null}
        submissionLimitReached={false}
        submissionsRemaining={2}
        showEntryTitleField
        showEntryDescriptionField={false}
        onEntryFormChange={vi.fn()}
        onEntryFilesChange={vi.fn()}
        onSubmitEntry={vi.fn()}
      />
    );

    const titleInput = screen.getByRole('textbox');
    expect(titleInput).toHaveAttribute('aria-invalid', 'false');

    fireEvent.blur(titleInput);

    expect(titleInput).toHaveAttribute('aria-invalid', 'true');
  });
});
