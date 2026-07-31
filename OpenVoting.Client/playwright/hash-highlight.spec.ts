import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

type TestSession = { closedPollTitle: string };

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const sessionPath = path.resolve(currentDir, '.auth', 'session.json');
const testSession = JSON.parse(fs.readFileSync(sessionPath, 'utf8')) as TestSession;

test('deep link to an entry highlights it and clears the highlight', async ({ page }) => {
  await page.goto('/polls/history');
  await page.getByTestId('history-search-toggle').click();
  await page.getByTestId('history-search-input').fill(testSession.closedPollTitle);
  const card = page.getByTestId('history-poll-list').getByTestId(/history-poll-/).filter({ hasText: testSession.closedPollTitle }).first();
  await card.getByRole('link', { name: 'View poll' }).click();

  await expect(page.getByTestId('closed-poll-breakdown')).toBeVisible();

  const entry = page.locator('li.entry-card').first();
  const entryId = await entry.getAttribute('id');
  expect(entryId).toBeTruthy();

  await page.goto(`${new URL(page.url()).pathname}#${entryId}`);

  const target = page.locator(`li#${entryId}`);
  await expect(target).toHaveClass(/entry-highlight/);
  await expect(target).not.toHaveClass(/entry-highlight/, { timeout: 6000 });
});
