import { expect, test } from '@playwright/test';

test('unknown routes render the not found page', async ({ page }) => {
  await page.goto('/definitely-not-a-real-route');

  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Go home' }).click();
  await expect(page).toHaveURL(/\/polls\/live$/);
});

test('the root path redirects to live polls', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/polls\/live$/);
  await expect(page.getByTestId('active-polls-page')).toBeVisible();
});

test('searching for something absent shows the empty result message', async ({ page }) => {
  await page.goto('/polls/live');
  await expect(page.getByTestId('active-poll-list')).toBeVisible();

  await page.getByTestId('active-poll-search-toggle').click();
  await page.getByTestId('active-poll-search-input').fill('no-poll-has-this-title-zzz');

  await expect(page.getByText('No polls match your search')).toBeVisible();
  await expect(page.getByTestId('active-poll-list')).toBeHidden();
});

test('the discord link page rejects a request with no token', async ({ page }) => {
  await page.goto('/auth/discord-link');

  await expect(page.getByRole('heading', { name: 'Do you want to log in?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  // The page hands its warning to the shell banner rather than rendering it inline.
  await expect(page.getByText('Missing login token')).toBeVisible();
});

test('the discord oauth callback rejects a request with no code', async ({ page }) => {
  await page.goto('/auth/discord-callback');

  await expect(page.getByText('Missing Discord authorization code')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
});
