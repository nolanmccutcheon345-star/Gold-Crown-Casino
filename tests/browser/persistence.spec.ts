import {openHostSetup} from './navigation';
import { expect, test, type Page } from '@playwright/test';

// Authored for compatible CI; actual managed-Sites browser evidence uses cua_repl.
async function wallet(page:Page){return page.getByTestId('cashier-wallet').innerText();}
async function cashier(page:Page){await page.locator('[data-view="cashier"]').click();}
async function finish(page:Page){
 for(let attempts=0;attempts<120;attempts++){
  await expect(page.locator('#call:enabled, #next-hand, #open-setup').first()).toBeVisible({timeout:30000});
  if(await page.getByTestId('street').textContent()==='HAND COMPLETE')return;
  await page.locator('#call:enabled').click();
 }
 throw new Error('Hand did not settle through visible controls');
}
async function takeSeat(page:Page){
 await openHostSetup(page);
 await page.locator('#seat-count').selectOption('2');await page.locator('#table-capacity').selectOption('2');await page.locator('#buy-in').fill('200');
 await page.locator('#setup-form button[type=submit]').click();await expect(page.getByTestId('street')).toHaveText('PREFLOP');
}

test('guest wallet edit, active hand reload, payout reload and exactly one cashout',async({page})=>{
 await page.goto('/');await expect(page.locator('[data-view="cashier"]')).toBeVisible();await cashier(page);
 await page.locator('#bankroll-amount').fill('1200');await page.locator('#bankroll-note').fill('Browser persistence baseline');await page.locator('#save-bankroll').click();
 await expect(page.getByTestId('cashier-wallet')).toHaveText('$1,200');await page.reload();await cashier(page);expect(await wallet(page)).toBe('$1,200');
 await takeSeat(page);const cards=await page.locator('.hero-seat .playing-card').allTextContents();
 const pot=await page.getByTestId('pot').innerText();await page.reload();await expect(page.getByTestId('street')).toHaveText('PREFLOP');
 expect(await page.locator('.hero-seat .playing-card').allTextContents()).toEqual(cards);expect(await page.getByTestId('pot').innerText()).toBe(pot);
 await page.locator('#pace').selectOption('250');await finish(page);const result=await page.getByTestId('session-profit').innerText();
 await page.reload();await expect(page.getByTestId('hand-count')).toHaveText('1');expect(await page.getByTestId('session-profit').innerText()).toBe(result);
 await cashier(page);const before=await page.getByTestId('cashier-profit').innerText();await page.locator('#bankroll-amount').fill('5000');
 await page.locator('#bankroll-note').fill('Manual adjustment, not winnings');await page.locator('#save-bankroll').click();
 expect(await page.getByTestId('cashier-profit').innerText()).toBe(before);await page.locator('#cashout').dblclick();const cashed=await wallet(page);
 await page.reload();await cashier(page);expect(await wallet(page)).toBe(cashed);expect(await page.getByTestId('cashier-profit').innerText()).toBe(before);
});

test('two tabs expose one writer; second cannot silently buy in',async({page,context})=>{
 await page.goto('/');await takeSeat(page);const other=await context.newPage();await other.goto('/');
 await expect(other.locator('.storage-banner.readonly')).toContainText(/read.only|another tab|writer/i);
 await openHostSetup(other);await expect(other.locator('#setup-form button[type=submit]')).toBeDisabled();
 await page.locator('#fold').click();await expect(page.getByTestId('hand-count')).toHaveText('1');await other.close();
});

test('public history download, import, replay and mobile no-overflow',async({page})=>{
 await page.goto('/');await takeSeat(page);await page.locator('#fold').click();await expect(page.getByTestId('hand-count')).toHaveText('1');
 await cashier(page);const profit=await page.getByTestId('cashier-profit').innerText();
 await page.getByRole('button',{name:'Hand history',exact:true}).click();await page.getByText('Export or import history',{exact:true}).click();await page.locator('#export-history').click();
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#download-history').click()]);
 expect(download.suggestedFilename()).toMatch(/\.json$/);const path=await download.path();expect(path).toBeTruthy();
 await page.locator('#import-rights').check();await page.locator('#import-history').setInputFiles(path!);
 await expect(page.getByTestId('study-import-preview')).toBeVisible();
 await page.locator('#study-import-select-all').click();await page.locator('#confirm-study-import').click();
 await expect(page.getByTestId('study-import-preview')).toHaveCount(0);
 await cashier(page);expect(await page.getByTestId('cashier-profit').innerText()).toBe(profit);
 await page.getByRole('button',{name:'Hand history',exact:true}).click();
 await page.locator('.hand-record summary').first().click();
 await page.locator('[data-replay]').first().click();await expect(page.getByTestId('hand-replay')).toBeVisible();
 await page.locator('#replay-next').click();await page.locator('#replay-first').click();await expect(page.getByTestId('hand-replay')).not.toContainText(/\b(?:nit|station|maniac)\b|policyVersion|drawToken/i);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
