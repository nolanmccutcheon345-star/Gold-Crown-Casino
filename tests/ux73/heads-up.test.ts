import {afterEach,describe,expect,it} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {normalizeTableSettings,validChallenge} from '../../src/session/configuration';
import {auditSnapshot} from '../../src/storage/verified';
import {LADDER_IDS,MATCH_HANDS,matchSettings,matchState,recordMatch,nextRung,ladderMarkup,matchBanner,type LadderState} from '../../src/ui/heads-up';
import {regularById} from '../../src/bots/regulars';

class Memory implements PersistencePort {
 data:AppData|null=null;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,data:AppData){if(expected!==(this.data?.revision??null))throw Error('revision changed');this.data=structuredClone(data);}
 close(){}
}
const controllers:SessionController[]=[];
afterEach(()=>{controllers.splice(0).forEach(c=>c.close());});

describe('Patch 73 heads-up challenge',()=>{
 it('builds a valid two-seat match against the rung\'s regular, with no top-ups',()=>{
  expect(LADDER_IDS).toHaveLength(10);for(const id of LADDER_IDS)expect(regularById(id)).toBeDefined();
  const s=matchSettings(DEFAULT_SETTINGS,3);const n=normalizeTableSettings(s);
  expect(n.seats).toBe(2);expect(n.capacity).toBe(2);expect(n.challenge).toEqual({rung:3,opponent:'tex'});expect(n.allowTopUp).toBe(false);expect(n.buyIn).toBe(100*DEFAULT_SETTINGS.bigBlind);
  expect(validChallenge(undefined)).toBe(true);expect(validChallenge({rung:1,opponent:'nobody'})).toBe(false);expect(validChallenge({rung:-1,opponent:'tex'})).toBe(false);expect(validChallenge({rung:1,opponent:'tex',extra:1})).toBe(false);
  expect(()=>normalizeTableSettings({...s,challenge:{rung:2,opponent:'nobody'}})).toThrow(/challenge/);
  expect(()=>matchSettings(DEFAULT_SETTINGS,10)).toThrow();
 });
 it('plays a match with the same opponent throughout and tracks it to the end',async()=>{
  const c=new SessionController(new Memory());controllers.push(c);await c.init();
  await c.startSession(matchSettings(DEFAULT_SETTINGS,0));expect(c.error).toBe('');
  const name=regularById('sal')!.name;
  let m=matchState(c.data!)!;expect(m).toMatchObject({rung:0,opponent:'sal',name,hands:0,over:false});
  for(let h=0;h<MATCH_HANDS;h++){
   for(let i=0;i<200&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;
    if(g.actor===0){const f=c.data!.active!.frames.at(-1)!;await c.act(f.legal.canRaise&&h%2===0?{type:'raise',to:f.legal.maxRaiseTo!}:f.legal.check?{type:'check'}:{type:'call'},g.handId,g.revision);}
    else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}}
   expect(c.error).toBe('');
   const seats=c.data!.active!.game.seats;expect(seats).toHaveLength(2);expect(seats.find(s=>s.id===1)!.name).toBe(name);for(const line of c.data!.active!.churnNews?.lines??[])expect(line).not.toMatch(/leaves|rebuys|tops up|sits down|joins/);
   expect(seats.reduce((a,s)=>a+s.startingStack,0)).toBe(2*100*DEFAULT_SETTINGS.bigBlind);
   m=matchState(c.data!)!;if(m.over)break;
   await c.nextHand();expect(c.error).toBe('');
  }
  expect(m.over).toBe(true);expect(['bust','hands']).toContain(m.how);if(m.how==='bust')expect(m.won).toBe(m.villain===0);expect(m.hero+m.villain).toBe(2*100*DEFAULT_SETTINGS.bigBlind);
  await c.cashOut();expect(c.error).toBe('');await auditSnapshot(structuredClone(c.data!));
  const after=matchState(c.data!)!;expect(after.over).toBe(true);
  const ladder:LadderState={beaten:[],matches:[]};const rec=recordMatch(ladder,{...after,how:m.how,won:m.won});
  expect(rec).not.toBeNull();expect(recordMatch(ladder,after)).toBeNull();expect(ladder.matches).toHaveLength(1);
  expect(ladder.beaten).toEqual(m.won?['sal']:[]);expect(nextRung(ladder)).toBe(m.won?1:0);
 },180000);
 it('calls the chip leader the winner at the hand limit and a walk-out a loss',()=>{
  const data={sessions:[{id:'s',settings:{challenge:{rung:2,opponent:'frank'}},handIds:Array.from({length:MATCH_HANDS},(_,i)=>`h${i}`)}],hands:[],
   active:{sessionId:'s',game:{street:'complete',seats:[{id:0,stack:25000},{id:1,stack:15000}]}}} as unknown as AppData;
  expect(matchState(data)).toMatchObject({over:true,how:'hands',won:true,hands:MATCH_HANDS});
  const walked={...data,active:null,sessions:[{...data.sessions[0],handIds:['h0']}]} as unknown as AppData;
  expect(matchState(walked)).toMatchObject({over:true,how:'left',won:false});
  const mid={...data,sessions:[{...data.sessions[0],handIds:['h0']}],active:{...data.active!,game:{street:'flop',seats:[{id:0,stack:0},{id:1,stack:40000}]}}} as unknown as AppData;
  expect(matchState(mid)).toMatchObject({over:false});
 });
 it('shows the ladder in order: beaten, next, locked',()=>{
  const html=ladderMarkup({beaten:['sal','big-earl'],matches:[{opponent:'sal',rung:0,won:true,hands:80,net:20000,at:'',sessionId:'a',how:'bust'}]},{busy:false,tableOpen:false,bankroll:1_000_000,buyIn:20000,last:null});
  expect(html).toContain('data-hu-rung="2"');expect(html).toContain('Challenge Frank');expect(html).toContain('Rematch Big Earl');expect(html).not.toContain('data-hu-rung="3"');expect(html).toContain('1–0 in matches');
  expect(ladderMarkup({beaten:[],matches:[]},{busy:false,tableOpen:true,bankroll:1_000_000,buyIn:20000,last:null})).toMatch(/data-hu-rung="0" disabled/);
  expect(matchBanner({sessionId:'s',rung:0,opponent:'sal',name:'Sal',hands:9,hero:25000,villain:15000,over:false,won:false,how:null,net:0})).toContain('Hand 10 of 150');
 });
});
