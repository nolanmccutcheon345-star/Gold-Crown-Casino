import {describe,it,expect} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {legalActions} from '../../src/core/engine';
import {HUMAN_LAYER_V12,HUMAN_LAYER_V13} from '../../src/bots/human';
import {planChurn,STRANGER_NAMES} from '../../src/session/churn';
import {REGULARS} from '../../src/bots/regulars';
import {icmEquities,icmBubbleFactor} from '../../src/tournament/icm';
import {bubbleFactor,icmFactor,type TournamentContext} from '../../src/tournament/bot-policy-v2';
import {NEW_EVENT_TOURNAMENT_POLICY,TOURNAMENT_POLICY_V25,TOURNAMENT_POLICY_V26,policyUsesIcm,supportedTournamentPolicy} from '../../src/tournament/bot-policy';
import {regularProfile} from '../../src/bots/regulars';
import {createProfile} from '../../src/bots/profiles';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData,tournamentStandings} from '../../src/tournament/runtime';
class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){if((this.value?.revision??null)!==expected)throw Error('Revision changed');this.value=structuredClone(next);}close(){}}

/** Play `n` hands with Hero calling or checking; returns the controller and every churn news line seen. */
async function session(n:number){
 const c=new SessionController(new Port());await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:9});
 const news:string[][]=[],start=c.data!.ledger?structuredClone(c.data!.ledger):null;
 for(let h=0;h<n;h++){
  for(let i=0;i<500&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;
   if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}
   expect(c.error).toBe('');}
  if(h<n-1){if(c.data!.active!.game.seats.find(s=>s.id===0)!.stack===0)await c.topUp(DEFAULT_SETTINGS.buyIn);await c.nextHand();expect(c.error).toBe('');
   const cn=c.data!.active!.churnNews;if(cn){expect(cn.handId).toBe(c.data!.active!.game.handId);news.push(cn.lines);}}
 }
 return {c,news,start};
}

describe('cash table churn (human-1.3.0)',()=>{
 it('new tables churn: players rebuy, top up, leave and get replaced over a session',async()=>{
  const {c,news}=await session(50);
  const a=c.data!.active!;expect(Number(a.humanLayer!.split('.')[1])).toBeGreaterThanOrEqual(3);void HUMAN_LAYER_V13;
  const lines=news.flat();
  // From layer 1.15.0 (patch 47) table news also carries breaks and announced last orbits.
  for(const l of lines)expect(l).toMatch(/ (rebuys|tops up)\.$|sits down\.$| (is taking a break|steps away from the table|goes for a smoke|takes a phone call|is back|sits back down)\.$|: “.+”$/);
  // Names stay unique at the table, settings carry no leftover one-hand fields.
  const names=a.game.seats.map(s=>s.name);expect(new Set(names).size).toBe(names.length);
  const settings=c.data!.sessions.find(s=>s.id===a.sessionId)!.settings;expect(settings.seatStacks).toBeUndefined();expect(settings.seatNames).toBeUndefined();
  // Newcomers are regulars or strangers by name.
  const known=new Set([...REGULARS.map(r=>r.name),...STRANGER_NAMES]);
  for(const l of lines){const m=/\. (.+) sits down\.$/.exec(l);if(m)expect(known.has(m[1])).toBe(true);}
  console.log(`churn over 50 hands: ${news.length} hands with news, ${lines.length} lines; e.g. ${lines.slice(0,4).join(' | ')}`);
 },120000);
 it('Hero is never touched by churn and the plan is deterministic',async()=>{
  const {c}=await session(16);const d=c.data!,a=d.active!;
  const p1=planChurn(d,a),p2=planChurn(structuredClone(d),structuredClone(a));expect(JSON.stringify(p1)).toBe(JSON.stringify(p2));
  if(p1){expect(p1.settings.seatStacks?.[0]).toBeUndefined();expect(p1.settings.seatNames?.[0]).toBeUndefined();}
  // Force every bot broke: each one rebuys or (at most one) leaves; Hero's seat untouched.
  const broke=structuredClone(a);for(const s of broke.game.seats)if(s.id!==0)s.stack=0;
  const plan=planChurn(d,broke)!;expect(plan).not.toBeNull();expect(plan.settings.seatStacks?.[0]).toBeUndefined();
  expect(plan.news.filter(l=>/sits down/.test(l)).length).toBeLessThanOrEqual(1);
  expect(Object.keys(plan.settings.seatStacks!).length).toBeGreaterThanOrEqual(plan.news.length);
 },60000);
 it('older layers never churn',async()=>{
  const c=new SessionController(new Port());await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:6});
  await (c as unknown as {mutate:(f:(d:AppData)=>Promise<void>)=>Promise<void>}).mutate(async d=>{d.active!.humanLayer=HUMAN_LAYER_V12;});
  expect(c.data!.active!.humanLayer).toBe(HUMAN_LAYER_V12);
  for(let h=0;h<8;h++){for(let i=0;i<500&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}}
   await c.nextHand();expect(c.error).toBe('');expect(c.data!.active!.churnNews).toBeUndefined();}
 },60000);
});

describe('final-table ICM (policy 2.6.0)',()=>{
 it('equities sum to the prize pool and match known values',()=>{
  const e=icmEquities([5000,3000,2000],[50,30,20]);expect(e.reduce((a,b)=>a+b,0)).toBeCloseTo(100,9);
  // Independent check: Malmuth–Harville by enumerating every finishing order.
  const brute=(st:number[],pr:number[])=>{const n=st.length,out=Array(n).fill(0);const go=(left:number[],place:number,p:number)=>{if(!left.length)return;const tot=left.reduce((a,i)=>a+st[i],0);for(const i of left){const q=p*st[i]/tot;out[i]+=q*(pr[place]??0);go(left.filter(j=>j!==i),place+1,q);}};go([...Array(n).keys()],0,1);return out;};
  const b=brute([5000,3000,2000],[50,30,20]);for(let i=0;i<3;i++)expect(e[i]).toBeCloseTo(b[i],9);
  const s6=[1200,800,3000,450,2600,1950],p6=[40,25,15,10,6,4],b6=brute(s6,p6),e6=icmEquities(s6,p6);for(let i=0;i<6;i++)expect(e6[i]).toBeCloseTo(b6[i],9);
  // Hand-computed: P1 wins 1st half the time; 2nd = .3*(5/7)+.2*(5/8) = .3393; 3rd = .1607 → 38.48.
  expect(e[0]).toBeCloseTo(50*.5+30*(.3*5/7+.2*5/8)+20*(1-.5-(.3*5/7+.2*5/8)),9);
  expect(icmEquities([1000,1000],[70,30])).toEqual([50,50]);
  expect(icmEquities([0,1000,1000],[50,30,20])[0]).toBeCloseTo(20,9);
  const nine=icmEquities(Array.from({length:9},(_,i)=>1000*(i+1)),[30,20,14,10,8,6,5,4,3]);expect(nine.reduce((a,b)=>a+b,0)).toBeCloseTo(100,9);
  for(let i=1;i<9;i++)expect(nine[i]).toBeGreaterThan(nine[i-1]);
 });
 it('bubble factors: above 1 with pay jumps, 1 heads-up and in winner-take-all',()=>{
  expect(icmBubbleFactor([3000,3000,3000],[50,30,20],0,1)).toBeGreaterThan(1.2);
  expect(icmBubbleFactor([3000,3000],[70,30],0,1)).toBeCloseTo(1,9);
  expect(icmBubbleFactor([3000,3000,3000],[100],0,1)).toBeCloseTo(1,9);
  // A medium stack facing the chip leader with a short stack still in feels the most pressure.
  const s=[2000,6000,1000];expect(icmBubbleFactor(s,[50,30,20],0,1)).toBeGreaterThan(icmBubbleFactor([2000,6000,4000],[50,30,20],0,1)*0.9);
 });
 it('only 2.6.0 standings carry prizes; strong regulars feel ICM more than stations',()=>{
  expect(policyUsesIcm(NEW_EVENT_TOURNAMENT_POLICY)).toBe(true);expect(supportedTournamentPolicy(TOURNAMENT_POLICY_V25)).toBe(true);
  expect(policyUsesIcm(TOURNAMENT_POLICY_V25)).toBe(false);expect(policyUsesIcm(TOURNAMENT_POLICY_V26)).toBe(true);
  const ctx:TournamentContext={playersLeft:4,paid:3,stacks:[4000,4000,4000,4000],prizes:[50,30,20,0]};
  const reg=regularProfile(REGULARS.find(r=>r.stakes.includes('high'))!.id,'high'),station=createProfile({selection:'station'} as never,7,'mid' as never);
  const fr=bubbleFactor(ctx,reg,4000,4000,100,true,true),fs=bubbleFactor(ctx,station,4000,4000,100,true,true);
  expect(fr).toBeGreaterThan(fs);expect(fs).toBeGreaterThanOrEqual(1);
  // Without the ICM flag the old heuristic is used unchanged.
  const {prizes,...old}=ctx;void prizes;expect(bubbleFactor(ctx,reg,4000,4000,100,true,false)).toBe(bubbleFactor(old,reg,4000,4000,100,true,false));
  expect(icmFactor({...ctx,playersLeft:11,stacks:Array(11).fill(1000),prizes:[1]},reg,1000,1000)).toBeNull();
 });
 it('new events use 2.6.0, carry prizes in standings and pass the full audit',async()=>{
  const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('daily-125',27,'fast');
  const e=c.data!.active!;expect(e.tournamentPolicyVersion).toBe(NEW_EVENT_TOURNAMENT_POLICY);
  const st=tournamentStandings(e)!;expect(st.prizes).toBeDefined();expect(st.prizes!.length).toBeLessThanOrEqual(st.playersLeft);
  for(let guard=0;guard<3000&&c.data!.active!.handNumber<=8&&c.data!.active!.status==='running';guard++){const a=c.data!.active!,g=c.gameView!;
   if(a.game.street==='complete'){await c.nextHand();continue;}
   if(g.actor===0)await c.act({type:g.legal.check?'check':'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(a.game.handId,a.game.revision);}expect(c.error).toBe('');}
  expect(auditTournamentData(c.data!)).toBeGreaterThan(0);c.close();
 },120000);
});
