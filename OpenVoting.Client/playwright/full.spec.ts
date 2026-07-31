import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page, test } from '@playwright/test';

const uniqueValue = () => `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const squareImagePath = path.join(currentDir, 'fixtures', 'square-512.png');

function pollCardByTitle(page: Page, title: string): Locator {
  return page.getByTestId('active-poll-list').getByTestId(/active-poll-/).filter({ hasText: title }).first();
}

async function expectToast(page: Page, message: string) {
  await expect(page.getByRole('status').getByText(message)).toBeVisible();
}

async function ensureCreatePollPanelOpen(page: Page) {
  const toggle = page.getByTestId('create-poll-panel-toggle');
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }
}

async function ensureAdminPanelOpen(page: Page) {
  const toggle = page.getByTestId('admin-panel-toggle');
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }
}

async function ensureAdminEntriesOpen(page: Page) {
  const toggle = page.getByTestId('admin-entries-toggle');
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }
}

async function confirmDialog(page: Page) {
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await page.getByTestId('confirm-dialog-confirm').click();
}

async function createPoll(page: Page, title: string, description: string) {
  await page.goto('/polls/live');
  await ensureCreatePollPanelOpen(page);
  await page.getByTestId('create-poll-title-input').fill(title);
  await page.getByTestId('create-poll-description-input').fill(description);
  await page.getByTestId('create-poll-submit-button').click();

  if (await page.getByTestId('confirm-dialog').isVisible().catch(() => false)) {
    await confirmDialog(page);
  }

  await expectToast(page, 'Poll created');
  await expect(pollCardByTitle(page, title)).toBeVisible();
}

async function openPollFromLive(page: Page, title: string) {
  await page.goto('/polls/live');
  const pollCard = pollCardByTitle(page, title);
  await expect(pollCard).toBeVisible();
  await pollCard.getByRole('link', { name: 'View poll' }).click();
  await expect(page.getByTestId('current-poll-header')).toContainText(title);
}

async function submitTextEntry(page: Page, title: string, description: string) {
  await expect(page.getByTestId('submission-section')).toBeVisible();
  await page.getByTestId('submission-title-input').fill(title);
  await page.getByTestId('submission-description-input').fill(description);
  await page.getByTestId('submission-submit-button').click();
  await expect(page.getByTestId('my-submissions-section')).toContainText(title);
}

async function openVotingWithMethod(page: Page, methodId: '1' | '2') {
  await page.getByTestId('admin-open-voting-button').click();
  await expect(page.getByTestId('open-voting-modal')).toBeVisible();
  await page.getByTestId(`open-voting-method-${methodId}`).check();
  await page.getByTestId('open-voting-confirm-button').click();
  await expect(page.getByTestId('open-voting-modal')).toBeHidden();
}

// Ranked results render as a distribution bar plus a per-rank legend, e.g. "#1: 2".
async function expectRankDistribution(page: Page) {
  const distribution = page.getByTestId('closed-poll-breakdown').getByTestId('rank-distribution').first();
  await expect(distribution).toBeVisible();
  await expect(distribution).toContainText('#1:');
}

async function ensureEntryRankedFirst(page: Page, entryTitle: string) {
  const rankingItems = page.getByTestId('ranking-list').locator('li');
  const firstItem = rankingItems.first();
  if ((await firstItem.textContent())?.includes(entryTitle)) {
    return;
  }

  const targetItem = rankingItems.filter({ hasText: entryTitle }).first();
  await targetItem.getByRole('button', { name: `Move ${entryTitle} up` }).click();
  await expect(rankingItems.first()).toContainText(entryTitle);
}

test('full approval workflow covers creation, moderation, voting, closure, and deletion', async ({ page }) => {
  const pollTitle = `Full Approval Poll ${uniqueValue()}`;
  const firstEntryTitle = `Approval Alpha ${uniqueValue()}`;
  const secondEntryTitle = `Approval Beta ${uniqueValue()}`;

  await createPoll(page, pollTitle, 'Full approval flow coverage');
  await openPollFromLive(page, pollTitle);

  await ensureAdminPanelOpen(page);
  await page.getByTestId('admin-image-requirement-select').selectOption('0');
  await page.getByTestId('admin-max-submissions-input').fill('2');
  await page.getByTestId('admin-save-settings-button').click();
  await expectToast(page, 'Poll settings updated');
  await page.getByTestId('admin-open-submissions-button').click();
  await confirmDialog(page);
  await expect(page.getByTestId('submission-section')).toBeVisible();

  await submitTextEntry(page, firstEntryTitle, 'First approval entry');
  await submitTextEntry(page, secondEntryTitle, 'Second approval entry');

  await ensureAdminEntriesOpen(page);
  const secondEntryCard = page.getByTestId('admin-entries-section').getByTestId(/admin-entry-/).filter({ hasText: secondEntryTitle }).first();
  await secondEntryCard.getByRole('button', { name: 'Disqualify' }).click();
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await page.getByTestId('confirm-dialog').getByRole('textbox', { name: 'Reason' }).fill('Temporarily disqualified for moderation test');
  await page.getByTestId('confirm-dialog-confirm').click();
  await expect(secondEntryCard).toContainText('Disqualified: Temporarily disqualified for moderation test');
  await secondEntryCard.getByRole('button', { name: 'Requalify' }).click();
  await expect(secondEntryCard).not.toContainText('Disqualified:');

  await ensureAdminPanelOpen(page);
  await page.getByTestId('admin-start-review-button').click();
  await confirmDialog(page);
  await ensureAdminPanelOpen(page);
  await openVotingWithMethod(page, '1');

  const votingSection = page.getByTestId('voting-section');
  await expect(votingSection).toBeVisible();

  const firstVoteEntry = votingSection.getByTestId(/vote-entry-/).filter({ hasText: firstEntryTitle }).first();
  const secondVoteEntry = votingSection.getByTestId(/vote-entry-/).filter({ hasText: secondEntryTitle }).first();

  await firstVoteEntry.click();
  await page.getByTestId('vote-submit-button').click();
  await expect(page.getByTestId('vote-status-banner')).toBeVisible();

  await firstVoteEntry.click();
  await secondVoteEntry.click();
  await page.getByTestId('vote-submit-button').click();
  await expect(page.getByTestId('vote-status-banner')).toBeVisible();

  await ensureAdminPanelOpen(page);
  await page.getByTestId('admin-close-poll-button').click();
  await confirmDialog(page);
  await expect(page.getByTestId('closed-poll-breakdown')).toBeVisible();
  await expect(page.getByTestId('closed-poll-breakdown')).toContainText(secondEntryTitle);
  await expect(page.getByTestId('closed-poll-breakdown')).toContainText('Winner');

  await page.goto('/polls/history');
  await page.getByTestId('history-search-toggle').click();
  await page.getByTestId('history-search-input').fill(pollTitle);
  const historyCard = page.getByTestId('history-poll-list').getByTestId(/history-poll-/).filter({ hasText: pollTitle }).first();
  await expect(historyCard).toBeVisible();
  await historyCard.getByRole('link', { name: 'View poll' }).click();
  await expect(page.getByTestId('closed-poll-breakdown')).toContainText(secondEntryTitle);

  await ensureAdminPanelOpen(page);
  await page.getByTestId('admin-delete-poll-button').click();
  await confirmDialog(page);
  await expect(page).toHaveURL(/\/polls\/history$/);
  await page.getByTestId('history-search-toggle').click();
  await page.getByTestId('history-search-input').fill(pollTitle);
  await expect(page.getByText('No polls match your search')).toBeVisible();
});

test('full IRV workflow covers ranking, updating votes, and published results', async ({ page }) => {
  const pollTitle = `Full IRV Poll ${uniqueValue()}`;
  const firstEntryTitle = `IRV Alpha ${uniqueValue()}`;
  const secondEntryTitle = `IRV Beta ${uniqueValue()}`;

  await createPoll(page, pollTitle, 'Full IRV flow coverage');
  await openPollFromLive(page, pollTitle);

  await ensureAdminPanelOpen(page);
  await page.getByTestId('admin-image-requirement-select').selectOption('0');
  await page.getByTestId('admin-max-submissions-input').fill('2');
  await page.getByTestId('admin-save-settings-button').click();
  await expectToast(page, 'Poll settings updated');
  await page.getByTestId('admin-open-submissions-button').click();
  await confirmDialog(page);

  await submitTextEntry(page, firstEntryTitle, 'First ranked entry');
  await submitTextEntry(page, secondEntryTitle, 'Second ranked entry');

  await ensureAdminPanelOpen(page);
  await page.getByTestId('admin-start-review-button').click();
  await confirmDialog(page);
  await ensureAdminPanelOpen(page);
  await openVotingWithMethod(page, '2');

  await ensureAdminPanelOpen(page);
  await page.getByTestId('admin-max-selections-input').fill('2');
  await page.getByTestId('admin-save-settings-button').click();
  await expectToast(page, 'Poll settings updated');

  const votingSection = page.getByTestId('voting-section');
  const firstVoteEntry = votingSection.getByTestId(/vote-entry-/).filter({ hasText: firstEntryTitle }).first();
  const secondVoteEntry = votingSection.getByTestId(/vote-entry-/).filter({ hasText: secondEntryTitle }).first();

  await firstVoteEntry.click();
  await secondVoteEntry.click();
  await page.getByRole('button', { name: 'Continue to ranking' }).click();
  await expect(page.getByTestId('ranking-modal')).toBeVisible();
  await ensureEntryRankedFirst(page, secondEntryTitle);
  await page.getByTestId('ranking-submit-button').click();
  await expect(page.getByTestId('vote-status-banner')).toBeVisible();

  await page.getByRole('button', { name: 'Continue to ranking' }).click();
  await expect(page.getByTestId('ranking-modal')).toBeVisible();
  await ensureEntryRankedFirst(page, firstEntryTitle);
  await page.getByTestId('ranking-submit-button').click();
  await expect(page.getByTestId('vote-status-banner')).toBeVisible();

  await ensureAdminPanelOpen(page);
  await page.getByTestId('admin-close-poll-button').click();
  await confirmDialog(page);
  await expect(page.getByTestId('closed-poll-breakdown')).toBeVisible();
  await expect(page.getByTestId('closed-poll-breakdown')).toContainText(firstEntryTitle);
  await expect(page.getByTestId('closed-poll-breakdown')).toContainText('#1');
  await expectRankDistribution(page);

  await page.goto('/polls/history');
  await page.getByTestId('history-search-toggle').click();
  await page.getByTestId('history-search-input').fill(pollTitle);
  const historyCard = page.getByTestId('history-poll-list').getByTestId(/history-poll-/).filter({ hasText: pollTitle }).first();
  await expect(historyCard).toBeVisible();
  await historyCard.getByRole('link', { name: 'View poll' }).click();
  await expect(page.getByTestId('closed-poll-breakdown')).toContainText(firstEntryTitle);
  await expectRankDistribution(page);
});

test('voting rejects selecting more entries than allowed', async ({ page }) => {
  const pollTitle = `Full Selection Poll ${uniqueValue()}`;
  const firstEntryTitle = `Selection Alpha ${uniqueValue()}`;
  const secondEntryTitle = `Selection Beta ${uniqueValue()}`;

  await createPoll(page, pollTitle, 'Selection limit coverage');
  await openPollFromLive(page, pollTitle);

  await ensureAdminPanelOpen(page);
  await page.getByTestId('admin-image-requirement-select').selectOption('0');
  await page.getByTestId('admin-max-submissions-input').fill('2');
  await page.getByTestId('admin-save-settings-button').click();
  await expectToast(page, 'Poll settings updated');
  await page.getByTestId('admin-open-submissions-button').click();
  await confirmDialog(page);

  await submitTextEntry(page, firstEntryTitle, 'First entry');
  await submitTextEntry(page, secondEntryTitle, 'Second entry');

  await ensureAdminPanelOpen(page);
  await page.getByTestId('admin-start-review-button').click();
  await confirmDialog(page);
  await ensureAdminPanelOpen(page);
  await openVotingWithMethod(page, '1');

  await ensureAdminPanelOpen(page);
  await page.getByTestId('admin-max-selections-input').fill('1');
  await page.getByTestId('admin-save-settings-button').click();
  await expectToast(page, 'Poll settings updated');

  const votingSection = page.getByTestId('voting-section');
  await expect(votingSection).toContainText('Select up to 1 entries');
  await votingSection.getByTestId(/vote-entry-/).filter({ hasText: firstEntryTitle }).first().click();
  await votingSection.getByTestId(/vote-entry-/).filter({ hasText: secondEntryTitle }).first().click();
  await page.getByTestId('vote-submit-button').click();

  await expectToast(page, 'Select at most 1 entries');
  await expect(page.getByTestId('vote-status-banner')).toBeHidden();
});

// Only asserts the upload round trip, not a rendered image: Settings__BlobStorage__PublicBaseUrl
// is set by the Helm chart alone, so outside production the API returns a null asset URL and the
// entry card renders no <img> at all.
test('an entry image uploads and stores against a required-image poll', async ({ page }) => {
  const pollTitle = `Full Image Poll ${uniqueValue()}`;
  const entryTitle = `Image Alpha ${uniqueValue()}`;

  await createPoll(page, pollTitle, 'Image upload coverage');
  await openPollFromLive(page, pollTitle);

  // A new poll already requires an image, so this needs no settings change.
  await ensureAdminPanelOpen(page);
  await expect(page.getByTestId('admin-image-requirement-select')).toHaveValue('2');
  await page.getByTestId('admin-open-submissions-button').click();
  await confirmDialog(page);

  await expect(page.getByTestId('submission-section')).toBeVisible();
  await page.getByTestId('submission-title-input').fill(entryTitle);
  await page.getByTestId('submission-description-input').fill('Entry with an image');

  // A required image must actually be attached before the entry is accepted.
  await page.getByTestId('submission-submit-button').click();
  await expect(page.getByTestId('submission-section')).toContainText('Please correct the validation errors');
  await expect(page.getByTestId('my-submissions-section')).toBeHidden();

  // Reaching my submissions means the file passed client validation, uploaded to blob storage and
  // came back as an asset id the entry could be created against.
  await page.getByTestId('submission-image-input').setInputFiles(squareImagePath);
  await page.getByTestId('submission-submit-button').click();
  await expect(page.getByTestId('my-submissions-section')).toContainText(entryTitle);
  await expect(page.getByTestId('submission-section')).not.toContainText('Please correct the validation errors');

  // The form clears itself ready for the next entry.
  await expect(page.getByTestId('submission-title-input')).toHaveValue('');
});

test('submission limit blocks further entries until one is deleted', async ({ page }) => {
  const pollTitle = `Full Submission Poll ${uniqueValue()}`;
  const entryTitle = `Submission Alpha ${uniqueValue()}`;

  await createPoll(page, pollTitle, 'Submission limit coverage');
  await openPollFromLive(page, pollTitle);

  await ensureAdminPanelOpen(page);
  await page.getByTestId('admin-image-requirement-select').selectOption('0');
  await page.getByTestId('admin-max-submissions-input').fill('1');
  await page.getByTestId('admin-save-settings-button').click();
  await expectToast(page, 'Poll settings updated');
  await page.getByTestId('admin-open-submissions-button').click();
  await confirmDialog(page);

  const submissionSection = page.getByTestId('submission-section');
  await expect(submissionSection).toContainText('Submissions remaining: 1 of 1');

  await submitTextEntry(page, entryTitle, 'Only entry');

  // The form stays visible once the limit is hit, with submitting disabled rather than removed.
  await expect(submissionSection).toContainText('You have reached the submission limit for this poll (1 total)');
  await expect(page.getByTestId('submission-submit-button')).toBeDisabled();

  const mySubmissions = page.getByTestId('my-submissions-section');
  await mySubmissions.getByRole('button', { name: 'Delete' }).first().click();
  await confirmDialog(page);

  // The section only renders while you have entries, so deleting the last one removes it.
  await expect(mySubmissions).toBeHidden();
  await expect(submissionSection).toContainText('Submissions remaining: 1 of 1');
  await expect(page.getByTestId('submission-submit-button')).toBeEnabled();
});