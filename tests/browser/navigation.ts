import type {Page} from '@playwright/test';
/** Reach setup through the visible navigation, including the active-table disclosure. */
export async function openHostSetup(page:Page){
 await page.getByRole('button',{name:'Play: live table',exact:true}).click();
 const games=page.locator('#nav-games');if(await games.isVisible())await games.click();
 await page.getByRole('button',{name:'Host setup',exact:true}).click();
}
