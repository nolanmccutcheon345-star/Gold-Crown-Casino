import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {chipStackMarkup} from '../../src/ui/table-style';

/** Patch 52 review integration: tournament chips are display-only, money and engine data are untouched. */
describe('tournament chip stack parity',()=>{
 it('presents decorated chips beside unchanged numeric contributions and awards',()=>{
  const src=readFileSync('src/ui/tournament-play.ts','utf8');
  expect(src).toContain('chipStackMarkup(seat.streetCommitted,shown.profile.bigBlind)+chips(seat.streetCommitted)');
  expect(src).toContain("chipStackMarkup(award,shown.profile.bigBlind)+'+'+chips(award)");
  expect(src).toContain("shown.pot,shown.profile.bigBlind,' pot-chips'");
  expect(src).not.toContain('for="table-motion"');
  expect(chipStackMarkup(500,100)).toContain('aria-hidden="true"');
 });
});
