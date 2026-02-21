import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminPanel } from './AdminPanel';
import { createPollResponse } from '../../test/factories';

describe('AdminPanel', () => {
  const baseProps = {
    poll: createPollResponse({ isAdmin: true }),
    showSubmissionSettings: true,
    showVotingSettings: false,
    metaForm: {
      title: 'Poll title',
      description: 'Description',
      titleRequirement: 1 as const,
      descriptionRequirement: 1 as const,
      imageRequirement: 1 as const
    },
    submissionForm: { maxSubmissionsPerMember: 2, submissionClosesAt: '' },
    votingForm: { maxSelections: 1, votingClosesAt: '' },
    requirementOptions: [
      { value: 0 as const, label: 'Off' },
      { value: 1 as const, label: 'Optional' },
      { value: 2 as const, label: 'Required' }
    ],
    settingsSaving: false,
    onMetaChange: vi.fn(),
    onSubmissionChange: vi.fn(),
    onVotingChange: vi.fn(),
    onTransition: vi.fn(),
    onDeletePoll: vi.fn(),
    onSave: vi.fn()
  };

  it('shows validation banner and blocks save when title is blank', async () => {
    render(
      <AdminPanel
        {...baseProps}
        metaForm={{
          ...baseProps.metaForm,
          title: ''
        }}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Save poll settings' }));

    expect(baseProps.onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Please correct the validation errors')).toBeInTheDocument();
  });

  it('blocks save when all submission fields are disabled', async () => {
    render(
      <AdminPanel
        {...baseProps}
        metaForm={{
          ...baseProps.metaForm,
          titleRequirement: 0,
          descriptionRequirement: 0,
          imageRequirement: 0
        }}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Save poll settings' }));

    expect(baseProps.onSave).not.toHaveBeenCalled();
    expect(screen.getByText('At least one submission field (title, description, or image) must be enabled')).toBeInTheDocument();
  });
});
