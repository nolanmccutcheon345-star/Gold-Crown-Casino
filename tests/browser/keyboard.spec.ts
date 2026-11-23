import {openHostSetup} from './navigation';
import {expect,test,type Page,type Locator} from '@playwright/test';

// Keyboard/DOM evidence only. This does not claim a real screen reader spoke it.
async function tabTo(page:Page,target:Locator){
 for(let i=0;i<160;i++){
  if(await target.evaluate(element=>element===document.activeElement))return;
  await page.keyboard.press('Tab');
 }
 throw new Error('Visible control was not reachable within 160 Tab presses');
}
async function activate(page:Page,target:Locator){await tabTo(page,target);await page.keyboard.press('Enter');}

test('keyboard setup, complete hand, cashier and history preserve accessible status',async({page})=>{
 await page.goto('/');
 await activate(page,page.getByRole('button',{name:'Host setup',exact:true}));
 const seats=page.getByLabel('Players at the table');await tabTo(page,seats);
 await page.keyboard.press('Home');await page.keyboard.press('Tab');await expect(seats).toHaveValue('2');
 const capacity=page.getByLabel('Table capacity');await tabTo(page,capacity);
 await page.keyboard.press('Home');await page.keyboard.press('Tab');await expect(capacity).toHaveValue('2');
 await activate(page,page.locator('#setup-submit'));
 await expect(page.getByTestId('poker-table')).toBeVisible();
 await expect(page.locator('.hero-seat [role="img"]')).toHaveCount(2);
 await expect(page.locator('.seat:not(.hero-seat) [role="img"]').first()).toHaveAttribute('aria-label','Hidden card');
 await expect(page.locator('#table-announcement')).toHaveAttribute('aria-live','polite');
 const pace=page.getByLabel('Bot action pace');await tabTo(page,pace);
 await page.keyboard.press('Home');await page.keyboard.press('Tab');
 for(let turn=0;turn<120;turn++){
  await page.waitForFunction(()=>document.querySelector('[data-testid="street"]')?.textContent==='HAND COMPLETE'||Boolean(document.querySelector<HTMLButtonElement>('#call:enabled')));
  if(await page.getByTestId('street').textContent()==='HAND COMPLETE')break;
  await activate(page,page.locator('#call'));
 }
 await expect(page.getByTestId('street')).toHaveText('HAND COMPLETE');
 await expect(page.getByTestId('hand-count')).toHaveText('1');
 await expect(page.locator('#table-announcement')).not.toHaveText('');
 await activate(page,page.getByRole('button',{name:'Cashier',exact:true}));
 await expect(page.getByTestId('cashier-wallet')).toBeVisible();
 await activate(page,page.locator('#cashout'));
 await expect(page.getByTestId('cashier-table')).toHaveText('$0');
 await expect(page.locator('#cashout')).toHaveCount(0);
 await activate(page,page.getByRole('button',{name:'Hand history',exact:true}));
 const summary=page.locator('.hand-record summary').first();await activate(page,summary);
 await expect(page.locator('.history-events').first()).toBeVisible();
});

test('cashier commits the amount typed before a clock render and preserves rejected drafts', async ({page}) => {
 await page.goto('/?measurePerformance=1');
 await openHostSetup(page);
 await page.locator('#seat-count').selectOption('2');
 await page.locator('#table-capacity').selectOption('2');
 await page.locator('#setup-submit').click();
 await page.locator('#fold').click();
 await expect(page.getByTestId('street')).toHaveText('HAND COMPLETE');
 await page.getByRole('button',{name:'Cashier',exact:true}).click();

 const amount = page.getByLabel('Add chips ($)',{exact:true});
 const transfer = page.getByRole('button',{name:'Transfer to table'});
 const wallet = page.getByTestId('cashier-wallet');
 const stack = page.getByTestId('cashier-table');
 const profit = page.getByTestId('cashier-profit');
 await expect(amount).toHaveValue('1');
 await expect(wallet).toHaveText('$9,800');
 await expect(stack).toHaveText('$199');

 async function crossRender(input:Locator,button:Locator) {
  await expect(button).toBeFocused();
  await expect(input).toBeVisible();
  // A clock save can preserve the same DOM node. Observe the committed save itself.
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
   const name = 'ai-texas-performance-sample';
   const done = (event:Event) => {
    if ((event as CustomEvent).detail.name !== 'persistence.commit') return;
    clearTimeout(timer);
    window.removeEventListener(name,done);
    resolve();
   };
   const timer = setTimeout(() => { window.removeEventListener(name,done); reject(Error('No clock save observed')); },20000);
   window.addEventListener(name,done);
  }));
  await expect(button).toBeEnabled();
  await expect(button).toBeFocused();
 }
 for (const typed of ['0','-5','0.50']) {
  await amount.fill(typed);
  await amount.press('Tab');
  await expect(transfer).toBeFocused();
  await crossRender(amount,transfer);
  await expect(amount).toHaveValue(typed);
  await page.keyboard.press('Enter');
  if (typed==='0.50') break;
  await expect(page.getByRole('alert')).toContainText(typed==='0'?'positive top-up':'positive amount');
  await expect(amount).toHaveValue(typed);
  await expect(wallet).toHaveText('$9,800');
  await expect(stack).toHaveText('$199');
 }
 await expect(wallet).toHaveText('$9,799.50');
 await expect(stack).toHaveText('$199.50');
 await expect(profit).toHaveText('−$1');

 const balance = page.getByLabel('Set available virtual bankroll ($)');
 const note = page.getByLabel('Adjustment note');
 const adjust = page.getByRole('button',{name:'Record bankroll adjustment'});
 await balance.fill('9811.25');
 await note.fill('keyboard draft across a clock save');
 await note.press('Tab');
 await crossRender(balance,adjust);
 await expect(balance).toHaveValue('9811.25');
 await expect(note).toHaveValue('keyboard draft across a clock save');
 await page.keyboard.press('Enter');
 await expect(wallet).toHaveText('$9,811.25');
 await expect(note).toHaveValue('Manual bankroll adjustment');
 await expect(profit).toHaveText('−$1');
 await page.reload();
 await page.getByRole('button',{name:'Cashier',exact:true}).click();
 await expect(wallet).toHaveText('$9,811.25');
 await expect(stack).toHaveText('$199.50');
 await expect(profit).toHaveText('−$1');
});
