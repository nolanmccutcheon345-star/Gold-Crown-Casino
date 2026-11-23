import {afterEach,describe,expect,it} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {replayLog,streetJumps,heroSpot,seatSpots,miniTable} from '../../src/ui/replayer';

class Memory implements PersistencePort {
 data:AppData|null=null;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,data:AppData){if(expected!==(this.data?.revision??null))throw Error('revision changed');this.data=structuredClone(data);}
 close(){}
}
const controllers:SessionController[]=[];
afterEach(()=>{controllers.splice(0).forEach(c=>c.close());});
const draw={card:(c:string|undefined)=>c?`[${c}]`:'[back]',money:(n:number)=>`$${n/100}`,esc:(s:string)=>s.replace(/</g,'&lt;')};

/** Plays hands where Hero checks or calls, so hands reach later streets. */
async function hands(count:number){
 const c=new SessionController(new Memory());controllers.push(c);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:4});
 for(let h=0;h<count;h++){
  for(let i=0;i<200&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;
   if(g.actor===0){const l=g.seats.find(s=>s.id===0)!;await c.act(l.stack>0&&g.street!=='complete'?(c.data!.active!.frames.at(-1)!.legal.check?{type:'check'}:{type:'call'}):{type:'fold'},g.handId,g.revision);}
   else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}}
  expect(c.error).toBe('');if(c.data!.active!.game.seats.find(s=>s.id===0)!.stack===0)break;if(h<count-1)await c.nextHand();
 }
 return c.data!.hands;
}

describe('Patch 71 hand replayer',()=>{
 it('lists every event once, in order, at the first frame that shows it, and jumps by street',async()=>{
  const all=await hands(6);
  for(const hand of all){
   const log=replayLog(hand.frames),last=hand.frames.at(-1)!;
   expect(log.map(e=>e.event.id)).toEqual(last.events.map(e=>e.id));
   for(const e of log)expect(hand.frames[e.frame].events.some(x=>x.id===e.event.id)).toBe(true);
   for(let i=1;i<log.length;i++)expect(log[i].frame).toBeGreaterThanOrEqual(log[i-1].frame);
   const jumps=streetJumps(hand.frames);
   expect(jumps[0]).toMatchObject({street:'preflop',frame:0});expect(jumps.at(-1)!.street).toBe('complete');
   for(const j of jumps.slice(1))expect(hand.frames[j.frame].street).toBe(j.street);
  }
  expect(all.some(h=>streetJumps(h.frames).some(j=>j.street==='flop'))).toBe(true);
 },120000);
 it('prices Hero decisions and names the choice made',async()=>{
  const all=await hands(6);let spots=0;
  for(const hand of all)hand.frames.forEach((f,i)=>{const s=heroSpot(hand.frames,i);if(f.actor!==0||f.street==='complete'){expect(s).toBeNull();return;}
   spots++;expect(s!.pot).toBe(f.pot);expect(s!.toCall).toBe(Math.min(f.legal.callAmount,f.seats.find(x=>x.id===0)!.stack));
   if(s!.toCall>0)expect(s!.potOdds).toBeCloseTo(s!.toCall/(s!.pot+s!.toCall),9);else expect(s!.potOdds).toBeNull();
   if(i<hand.frames.length-1)expect(['check','call','fold','raise']).toContain(s!.choice);});
  expect(spots).toBeGreaterThan(0);
 },120000);
 it('draws Hero at the bottom and never shows a hidden card',async()=>{
  const spots=seatSpots([3,0,1,2]);expect(spots[0].y).toBeGreaterThan(85);expect(Math.abs(spots[0].x-50)).toBeLessThan(1);
  const all=await hands(4);
  for(const hand of all)for(const f of hand.frames){
   const html=miniTable(f,draw);
   for(const seat of f.seats)if(seat.id!==0&&seat.hole.length===0&&!seat.folded)expect(html).toContain('[back]');
   const hero=f.seats.find(s=>s.id===0)!;if(!hero.folded)for(const c of hero.hole)expect(html).toContain(`[${c}]`);
  }
  const f=structuredClone(all[0].frames[0]);f.seats[1].name='<img src=x>';expect(miniTable(f,draw)).not.toContain('<img');
 },120000);
});
describe('Patch 71 log wording',()=>{
 it('uses the plain verb for You and keeps names otherwise',async()=>{
  const {actorLine}=await import('../../src/ui/replayer');
  expect(actorLine('You','Calls $2')).toBe('You call $2');expect(actorLine('You','Raises to $6')).toBe('You raise to $6');expect(actorLine('You','Awarded $39 · showdown')).toBe('You won $39 · showdown');
  expect(actorLine('Abe','Raises to $78')).toBe('Abe raises to $78');expect(actorLine('You','Posts blind $1')).toBe('You post blind $1');
 });
});
