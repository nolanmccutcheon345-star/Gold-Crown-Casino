import {describe,it,expect,vi,afterEach} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {BotDecision} from '../../src/contracts';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {legalActions} from '../../src/core/engine';
import {auditSnapshot} from '../../src/storage/verified';
import {regularConfig} from '../../src/bots/regulars';
import * as context from '../../src/session/human-context';
import * as churn from '../../src/session/churn';
import {readFileSync} from 'node:fs';
const fixture=JSON.parse(readFileSync(new URL('./cash-compat-v58.json',import.meta.url),'utf8')) as {sourceCommit:string;cases:{data:AppData;decisions:{token:number;decision:BotDecision}[]}[]};
class Port implements PersistencePort{value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){expect(this.value?.revision??null).toBe(expected);this.value=structuredClone(next);}close(){}}
afterEach(()=>vi.restoreAllMocks());
async function setup(){const port=new Port();const c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:4,liveStraddle:true,seatStacks:{0:20000,1:20000,2:20000,3:20000},opponents:['tess','big-earl','hiro'].map(regularConfig)});expect(c.error).toBe('');return {c,port};}

describe('independent Version59 cash compatibility',()=>{
 it('matches 32 literal Version58 prepared decisions across all streets, straddles and extreme RNG tokens',async()=>{
  expect(fixture.sourceCommit).toBe('384ce64b2f753ef23c9649c9dfd44dd6f58efadb');let count=0;
  for(const entry of fixture.cases)for(const expected of entry.decisions){
   const port=new Port();port.value=structuredClone(entry.data) as AppData;port.value.active!.pending!.drawToken=expected.token;
   const c=new SessionController(port);await c.init();expect(c.error).toBe('');expect(c.data!.active!.humanLayer).toBe('human-1.9.0');
   await c.prepareBot();expect(c.error).toBe('');expect(c.data!.active!.pending!.drawToken).toBe(expected.token);expect(c.data!.active!.pending!.decision).toEqual(expected.decision as BotDecision);
   const saved=structuredClone(c.data!);c.close();const reloaded=new SessionController(port);await reloaded.init();expect(reloaded.data).toEqual(saved);reloaded.close();count++;
  }
  expect(count).toBe(32);
 });
 it('keeps new prepared decisions unchanged through reload, hand boundaries and a full snapshot audit',async()=>{
  const result=await setup();let c=result.c;const port=result.port;expect(c.data!.active!.humanLayer).toBe('human-1.21.0');let prepared=0;
  for(let hand=0;hand<8;hand++){
   for(let guard=0;c.data!.active!.game.street!=='complete'&&guard<150;guard++){
    const g=c.data!.active!.game;
    if(g.actor===0){const legal=legalActions(g);await c.act({type:legal.check?'check':legal.callAmount<=2*g.profile.bigBlind?'call':'fold'},g.handId,g.revision);}
    else{await c.prepareBot();expect(c.error).toBe('');const saved=structuredClone(c.data!);expect(saved.active!.pending!.decision!.observationHash).toContain(':human-1.21.0:');c.close();c=new SessionController(port);await c.init();expect(c.data).toEqual(saved);await c.commitBot(g.handId,g.revision);prepared++;}
    expect(c.error).toBe('');
   }
   expect(c.data!.active!.game.street).toBe('complete');if(hand===0){const settings=structuredClone(c.data!.sessions.find(s=>s.id===c.data!.active!.sessionId)!.settings);settings.seatStacks={1:20000};const plan=vi.spyOn(churn,'planChurn').mockReturnValueOnce({settings,news:['Tess rebuys.']});await c.nextHand();expect(plan).toHaveBeenCalled();const news=c.data!.active!.churnNews!.lines;expect(news[0]).toBe('Tess rebuys.');expect(news.filter(line=>line==='Tess rebuys.')).toHaveLength(1);plan.mockRestore();}else if(hand<7)await c.nextHand();expect(c.error).toBe('');expect(c.data!.active!.humanLayer).toBe('human-1.21.0');
  }
  expect(prepared).toBeGreaterThan(12);await c.cashOut();expect(c.error).toBe('');expect(await auditSnapshot(structuredClone(port.value!))).toEqual(c.data);c.close();
 },30000);
 it('fingerprints numeric witnessed images even when their threshold labels and actions match',async()=>{
  const {c,port}=await setup();const template=structuredClone(port.value!);c.close();
  const a=template.active!;a.pending={handId:a.game.handId,revision:a.game.revision,seatId:a.game.actor!,decisionId:`bot:${a.game.handId}:${a.game.revision}:${a.game.actor}`,policyVersion:a.profiles[a.game.actor!].policyVersion,drawToken:12345,decision:null};
  const decisions=[];
  const spy=vi.spyOn(context,'cashImages');
  for(const bluff of [.01,.02]){
   spy.mockReturnValue({0:{bluff,monster:0}});port.value=structuredClone(template);const restored=new SessionController(port);await restored.init();await restored.prepareBot();expect(restored.error).toBe('');decisions.push(restored.data!.active!.pending!.decision!);expect(spy.mock.calls.at(-1)?.[2]).toBe(a.game.actor);restored.close();
  }
  expect(decisions[0].action).toEqual(decisions[1].action);expect(decisions[0].observationHash).not.toBe(decisions[1].observationHash);expect(decisions.every(d=>d.observationHash.includes(':image:'))).toBe(true);
 });
 it('binds numeric rivalry evidence even below the activation threshold without reading private fields',async()=>{
  const {c,port}=await setup();const template=structuredClone(port.value!);c.close();const a=template.active!;
  a.pending={handId:a.game.handId,revision:a.game.revision,seatId:a.game.actor!,decisionId:`bot:${a.game.handId}:${a.game.revision}:${a.game.actor}`,policyVersion:a.profiles[a.game.actor!].policyVersion,drawToken:12345,decision:null};
  const identity=context.cashIdentity(a)(a.game.actor!)!;expect(identity).toBeTruthy();
  const spy=vi.spyOn(context,'cashGrudges'),decisions:BotDecision[]=[];
  for(const level of [.01,.02]){
   const grudges={[identity]:{hero:level}};
   Object.defineProperty(grudges,'privateCards',{enumerable:false,get(){throw Error('Private cards read');}});
   spy.mockReturnValue(grudges);port.value=structuredClone(template);const restored=new SessionController(port);await restored.init();await restored.prepareBot();expect(restored.error).toBe('');
   decisions.push(restored.data!.active!.pending!.decision!);restored.close();
  }
  expect(decisions[0].action).toEqual(decisions[1].action);expect(decisions[0].observationHash).not.toBe(decisions[1].observationHash);expect(decisions.every(d=>d.observationHash.includes(':grudge:'))).toBe(true);
 });

});
