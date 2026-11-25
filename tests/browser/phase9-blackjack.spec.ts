import { expect, test } from '@playwright/test';

/* Phase 9 regression (F-07): on a pre-filled minimum, the first chip tap must SET
   the bet the player intends (the playtest turned one $25 tap into a $30 bet), and
   the settlement announcement must name only components that actually applied. */

test('Blackjack: first chip sets the bet; settlement text names only real components', async ({ page }) => {
  await page.goto('/');
  await page.locator('.app-header [data-view="live"]').click();
  await page.locator('.subnav:not([hidden]) [data-view="blackjack"]').first().click();
  await page.locator('#blackjack-sit').click();
  await expect(page.locator('#bj-deal')).toBeVisible();

  const amount = page.locator('#bj-bet-amount');
  // The draft opens pre-filled at the $5 table minimum.
  await expect(amount).toHaveValue('5');
  // One $25 chip tap sets $25 — it must not become $30.
  await page.locator('[data-blackjack-chip="2500"]').click();
  await expect(amount).toHaveValue('25');
  // A second tap adds, as chip-building should.
  await page.locator('[data-blackjack-chip="500"]').click();
  await expect(amount).toHaveValue('30');
  // Clear, then a chip builds from zero.
  await page.locator('#bj-clear').click();
  await expect(amount).toHaveValue('0');
  await page.locator('[data-blackjack-chip="2500"]').click();
  await expect(amount).toHaveValue('25');

  await page.locator('#bj-deal').click();
  // Decline insurance if offered; insurance is never taken in this test.
  const noInsurance = page.locator('#bj-insurance-no');
  if (await noInsurance.isVisible().catch(() => false)) await noInsurance.click();
  // Stand through the hand until the settled panel offers a new bet.
  const newBet = page.locator('#bj-new-bet');
  for (let i = 0; i < 12 && !(await newBet.isVisible().catch(() => false)); i++) {
    const stand = page.locator('[data-blackjack-action="stand"]');
    if (await stand.isEnabled().catch(() => false)) await stand.click();
    else await page.waitForTimeout(400);
  }
  await expect(newBet).toBeVisible({ timeout: 30_000 });
  const spoken = await page.locator('#table-announcement').textContent();
  expect(spoken).toContain('Round complete');
  expect(spoken).not.toContain('insurance');
});
