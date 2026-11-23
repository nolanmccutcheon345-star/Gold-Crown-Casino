import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';

/* Patch 85: landscape phones and tablets. */
const css=readFileSync('src/ui/landscape.css','utf8'),app=readFileSync('src/ui/app.ts','utf8');
describe('landscape layout',()=>{
  it('is loaded last, after the other styles',()=>{
    const order=['polish.css','structure.css','motion-more.css','visuals.css','landscape.css'].map(f=>app.indexOf(`import './${f}'`));
    expect(order.every(i=>i>0)).toBe(true);expect([...order].sort((a,b)=>a-b)).toEqual(order);
  });
  it('applies only to landscape phones and landscape tablets, never to portrait or wide desktops',()=>{
    for(const m of css.match(/^@media[^{]+/gm)!)expect(m,m).toContain('orientation:landscape');
    expect(css).toContain('(orientation:landscape) and (max-height:540px)');
    expect(css).toContain('(min-width:900px) and (max-width:1180px)');
  });
  it('the app marks every kind of table, so only seated screens change',()=>{
    expect(app).toMatch(/\(view==='live'&&game\)\|\|\(view==='tournaments'&&tournament\?\.data\?\.active\)\|\|\(view==='omaha'&&plo\?\.state\.active\)\?' at-table':''/);
    expect(css).toContain('.app-shell.view-blackjack:has(.bj-grid)');
  });
  it('controls go to a right-hand column in every game, and the felt is scaled to fit',()=>{
    expect(css).toMatch(/:is\(\.action-panel,\.t-action-panel\)\{position:fixed!important;top:0!important;right:0!important/);
    expect(css).toContain('.app-shell.at-table.view-omaha .plo-actions{position:fixed');
    expect(css).toContain('zoom:var(--ls-zoom)');
    for(const h of [470,420,380,340])expect(css).toContain(`(max-height:${h}px)`);
  });
  it('sitting down in landscape starts at the top of the page',()=>{
    expect(app).toContain('if (seated && !wasSeated)');expect(app).toContain('window.scrollTo(0, 0)');
  });
});
