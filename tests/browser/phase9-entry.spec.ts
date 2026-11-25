import { expect, test } from '@playwright/test';

/* Phase 9 regression (F-01/F-02): the Omaha and Heads-up front doors must seat the
   player. The Phase 9 playtest found both entry buttons landing the player on the
   Hold'em cash lobby with no table started; these tests drive the real buttons in a
   fresh profile so the entry path cannot silently break again. */

test('Omaha: Sit down seats you at a four-card table', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('.subnav:not([hidden]) [data-view="omaha"]').first().click();
  await expect(page.getByTestId('plo')).toBeVisible();
  await page.locator('[data-plo-stakes="1-2"]').click();
  await page.locator('#plo-sit').click();
  await expect(page.getByTestId('plo-table')).toBeVisible();
  await expect(page.locator('.plo-seat.hero .plo-cards > *')).toHaveCount(4);
  expect(errors).toEqual([]);
});

test('Heads-up: Challenge starts a match against the first rung', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('.subnav:not([hidden]) [data-view="heads-up"]').first().click();
  await expect(page.getByTestId('heads-up')).toBeVisible();
  await page.locator('[data-hu-rung="0"]').click();
  await expect(page.getByTestId('hu-banner')).toBeVisible();
  await expect(page.getByTestId('poker-table')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Heads-up: an open cash table explains itself instead of a dead click', async ({ page }) => {
  await page.goto('/');
  // Open a cash table first through the visible quick-game card.
  await page.locator('#quick-start-live').click();
  await expect(page.getByTestId('poker-table')).toBeVisible();
  const games = page.locator('#nav-games'); if (await games.isVisible()) await games.click();
  await page.getByRole('button', { name: 'Heads-up challenge' }).click();
  await expect(page.getByTestId('heads-up')).toBeVisible();
  await expect(page.locator('[data-hu-rung="0"]')).toBeDisabled();
  await expect(page.locator('.privacy-blocked')).toContainText('table open');
});
