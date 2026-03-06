import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

type TestSession = {
  livePollTitle: string;
  closedPollTitle: string;
  liveEntryTitle: string;
  displayName: string;
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const sessionPath = path.resolve(currentDir, '.auth', 'session.json');
const testSession = JSON.parse(fs.readFileSync(sessionPath, 'utf8')) as TestSession;

test('live polls page loads seeded test data', async ({ page }) => {
  await page.goto('/polls/live');

  await expect(page.getByTestId('topbar')).toBeVisible();
  await expect(page.getByTestId('active-polls-page')).toBeVisible();
  await expect(page.getByTestId('topbar-user-shell')).toContainText(testSession.displayName);
  await expect(page.getByTestId('active-poll-list')).toContainText(testSession.livePollTitle);
});

test('current poll detail exposes voteable seeded entry', async ({ page }) => {
  await page.goto('/polls/live');
  const pollCard = page.getByTestId('active-poll-list').getByTestId(/active-poll-/).filter({ hasText: testSession.livePollTitle }).first();
  await expect(pollCard).toBeVisible();
  await pollCard.getByRole('link', { name: 'View poll' }).click();

  await expect(page.getByTestId('current-poll-page')).toBeVisible();
  await expect(page.getByTestId('current-poll-header')).toContainText(testSession.livePollTitle);
  await expect(page.getByTestId('voting-section')).toBeVisible();
  await expect(page.getByTestId(/vote-entry-/).first()).toContainText(testSession.liveEntryTitle);
});

test('history page loads seeded closed poll and search works', async ({ page }) => {
  await page.goto('/polls/history');

  await expect(page.getByTestId('history-page')).toBeVisible();
  await page.getByTestId('history-search-toggle').click();
  await page.getByTestId('history-search-input').fill('History');
  await expect(page.getByTestId('history-poll-list')).toContainText(testSession.closedPollTitle);
});