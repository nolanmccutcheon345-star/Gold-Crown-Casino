import {openHostSetup} from './navigation';
import { expect, test, type Page } from '@playwright/test';

async function finishThroughVisibleControls(page:Page){
 for(let i=0;i<120;i++){
  await page.waitForFunction(()=>{
   const phase=document.querySelector('[data-testid="street"]');
   const call=document.querySelector<HTMLButtonElement>('#call');
   return phase?.textContent==='HAND COMPLETE'||Boolean(call&&!call.disabled);
  },{},{timeout:30000});
  if(await page.getByTestId('street').textContent()==='HAND COMPLETE')return;
  await page.locator('#call').click();
 }
 throw new Error('A single cash hand failed to terminate within 120 Hero decisions');
}

for(const count of [2,3,4,5,6,7,8,9,10]){
 test(`${count}-seat setup, real hand, settlement and redacted history`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await openHostSetup(page);
  await page.getByLabel('Players at the table').selectOption(String(count));
  await page.locator('#table-capacity').selectOption(String(count));
  await page.locator('#buy-in').fill('200');
  await page.locator('#setup-submit').click();
  await expect(page.getByTestId('poker-table')).toBeVisible();
  await page.getByLabel('Bot action pace').selectOption('250');
  await expect(page.getByTestId('poker-table')).not.toContainText(/\b(nit|station|maniac|fit-or-fold|stronger-reg)\b/i);
  await finishThroughVisibleControls(page);
  await expect(page.getByTestId('hand-count')).toHaveText('1');
  await expect(page.getByTestId('pot')).toHaveText(/^\$/);
  await page.getByRole('button',{name:'Hand history',exact:true}).click();
  await expect(page.locator('.hand-record')).toHaveCount(1);
  await page.locator('.hand-record summary').click();
  await expect(page.locator('.history-events')).toBeVisible();
  await expect(page.locator('#export-history')).toBeEnabled();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  expect(overflow,'viewport must not require horizontal page scrolling').toBe(false);
  expect(errors).toEqual([]);
 });
}
