import {describe,expect,it} from 'vitest';
import {omahaResult} from '../../src/stats/by-game';
import {PloTable,freshPlo,PLO_STAKES} from '../../src/plo/table';
import {ploMarkup} from '../../src/plo/view';
import {seatSpots} from '../../src/ui/replayer';

const ui={stakes:'1-2',buyInBB:100,raiseTo:null,error:'',notice:'',thinking:false};
describe('Patch 81 visuals',()=>{
 it('reports Omaha results in big blinds per 100 hands',()=>{
  const bb=(l:string)=>PLO_STAKES.find(x=>x.label===l)?.bigBlind;
  const r=omahaResult([{net:200,stakes:'$1/$2 PLO'},{net:-400,stakes:'$1/$2 PLO'},{net:1000,stakes:'$5/$10 PLO'},{net:50,stakes:'unknown'}],bb);
  expect(r.game).toBe('omaha');expect(r.samples).toBe(3);expect(r.net).toBe(850);expect(r.verdict).toBe('too-early');expect(r.rate!.mean).toBeCloseTo((10000-20000+10000)/3,6);
 });
 it('draws seat plates with avatars, and bets on the felt between each player and the pot',()=>{
  const t=new PloTable(freshPlo());t.sit('1-2',100);const a=t.state.active!;
  const html=ploMarkup(t,ui,{card:c=>c?`[${c}]`:'[back]',esc:s=>s});
  expect((html.match(/class="plo-plate"/g)??[]).length).toBe(a.hand.seats.length);
  expect((html.match(/class="plo-avatar"/g)??[]).length).toBe(a.hand.seats.length);
  const spots=seatSpots(a.hand.seats.map(s=>s.id));
  for(const s of a.hand.seats.filter(x=>x.bet>0)){
   const m=html.match(new RegExp(`data-seat="${s.id}" style="left:([0-9.]+)%;top:([0-9.]+)%`))!;expect(m).not.toBeNull();
   const x=Number(m[1]),y=Number(m[2]),p=spots[s.id];
   expect(Math.abs(x-50)).toBeLessThanOrEqual(Math.abs(p.x-50)+.1);expect(Math.abs(y-50)).toBeLessThanOrEqual(Math.abs(p.y-50)+.1);
  }
  expect(html).toContain('POT-LIMIT OMAHA');
  for(const s of a.hand.seats){const p=spots[s.id];if(p.x<30)expect(html).toMatch(/plo-seat side-left/);if(p.x>70)expect(html).toMatch(/plo-seat side-right/);}
 });
});
