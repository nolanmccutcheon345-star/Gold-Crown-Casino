import {describe,it,expect} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {Action,GameState,RuleProfile} from '../../src/contracts';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {startHand,applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {buyInStyle,styleBuyIn,effectiveBB,depthPlay,depthProfile} from '../../src/bots/depth';
import {regularConfig,regularProfile,regularBuyInForProfile,regularHabitsForProfile} from '../../src/bots/regulars';
import {createProfile} from '../../src/bots/profiles';
import {planChurn} from '../../src/session/churn';
import {validateData} from '../../src/storage/integrity';
class Port implements PersistencePort{value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,value:AppData){expect(this.value?.revision??null).toBe(expected);this.value=structuredClone(value);}close(){}}
const rules:RuleProfile={id:'ind-depth53',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:100,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const act=(g:GameState,action:Action)=>applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:`ind:${g.revision}`,action});
function facing(opener:number){let g=startHand({handId:'ind-depth53',button:0,profile:rules,seats:[50000,50000,50000,opener,50000,50000].map((stack,id)=>({id,name:`P${id}`,stack}))});g=act(g,{type:'raise',to:600});const o=observeBot(g,g.actor!,regularProfile('priya','high').policyVersion,'depth');o.ownCards=['5c','5d'];return {g,o};}
async function finish(c:SessionController){for(let i=0;c.data!.active!.game.street!=='complete'&&i<200;i++){const g=c.data!.active!.game;if(g.actor===0)await c.act({type:legalActions(g).check?'check':'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}expect(c.data!.active!.game.street).toBe('complete');}

describe('independent stack-depth and buy-in boundaries',()=>{
 it('does not treat unrelated deep players as implied odds against a short opener',()=>{
  const p=regularProfile('priya','high'),short=facing(6000),deep=facing(50000);
  expect(effectiveBB(short.o)).toBe(30);expect(effectiveBB(deep.o)).toBe(250);
  expect(depthPlay(short.o,p,'deep',{type:'fold'},()=>0)).toEqual({action:{type:'fold'},play:null});
  const call=depthPlay(deep.o,p,'deep',{type:'fold'},()=>0);expect(call.play).toBe('set-mine');expect(()=>act(deep.g,call.action)).not.toThrow();
  expect(depthProfile(short.o,p).effect?.applied).toContain('short-stack');
 });
 it('does not count earlier-street pot contributions as remaining deep-stack exposure',()=>{
  const {o}=facing(50000);o.street='flop';o.publicEvents=[];o.legal.check=true;
  for(const seat of o.seats){seat.totalCommitted=40000;seat.streetCommitted=0;seat.stack=10000;}
  expect(effectiveBB(o)).toBe(50);expect(depthProfile(o,regularProfile('priya','high')).effect).toBeNull();
 });
 it('set-mines the documented 22–77 range, not a random unmade holding or larger pair',()=>{
  const {o}=facing(50000),p=regularProfile('priya','high');
  for(const rank of '234567'){o.ownCards=[`${rank}c`,`${rank}d`];expect(depthPlay(o,p,'standard',{type:'fold'},()=>0).play).toBe('set-mine');}
  for(const cards of [['8c','8d'],['9c','9d'],['Kc','4d']]){o.ownCards=cards;expect(depthPlay(o,p,'standard',{type:'fold'},()=>0).play).toBeNull();}
 });
 it('never rounds styled stacks below minimum or above maximum, including non-aligned limits',()=>{
  const settings={buyIn:22000,bigBlind:300,minBuyInBB:31,maxBuyInBB:79,chipUnit:1000};
  for(const style of ['short','standard','deep'] as const){const amount=styleBuyIn(style,settings);expect(amount%1000).toBe(0);expect(amount).toBeGreaterThanOrEqual(9300);expect(amount).toBeLessThanOrEqual(23700);}
  expect(styleBuyIn('short',settings)).toBe(10000);expect(styleBuyIn('deep',settings)).toBe(23000);
  expect(()=>styleBuyIn('short',{...settings,minBuyInBB:32,maxBuyInBB:32})).toThrow(/denomination/);
 });
 it('does not retain an authored buy-in override after a regular profile is edited',()=>{
  const original=regularProfile('priya','high');expect(regularBuyInForProfile(original)).toBe('deep');expect(regularHabitsForProfile(original)).toBeDefined();
  const edited={...original,skill:original.skill!-.1};expect(regularBuyInForProfile(edited)).toBeUndefined();expect(regularHabitsForProfile(edited)).toBeUndefined();
 });
 it('funds actual styled tables independently of Hero, keeps explicit stacks and reloads exactly',async()=>{
  const port=new Port();let c=new SessionController(port);await c.init();const wallet=c.data!.wallet;
  await c.startSession({...DEFAULT_SETTINGS,seats:4,maxBuyInBB:500,opponents:[regularConfig('gus'),regularConfig('priya'),regularConfig('hank')],seatStacks:{3:12300}});expect(c.error).toBe('');
  const a=c.data!.active!;expect(a.game.seats.map(s=>s.startingStack)).toEqual([20000,8000,40000,12300]);expect(c.data!.wallet).toBe(wallet-20000);expect(c.data!.sessions.at(-1)!.settings.seatStacks).toBeUndefined();
  for(let i=0;i<8;i++){
   await finish(c);if(i<7){const before=c.data!,ledger=JSON.stringify(before.ledger),balance=before.wallet;await c.nextHand();expect(c.error).toBe('');expect(c.data!.wallet).toBe(balance);expect(JSON.stringify(c.data!.ledger)).toBe(ledger);}
  }
  await validateData(c.data!);const expected=structuredClone(c.data);c.close();c=new SessionController(port);await c.init();expect(c.error).toBe('');expect(c.data).toEqual(expected);c.close();
 },60000);
 it('styled simultaneous busts all receive legal stacks; old1.3 keeps table buy-in amounts',async()=>{
  const c=new SessionController(new Port());await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:6,maxBuyInBB:500,opponents:[regularConfig('gus'),regularConfig('priya'),regularConfig('hank'),regularConfig('monty'),regularConfig('ana')]});expect(c.error).toBe('');
  const d=structuredClone(c.data!),a=d.active!;for(const seat of a.game.seats)if(seat.id!==0)seat.stack=0;
  for(let seed=0;seed<30;seed++){
   a.game.handId=`depth-bust:${seed}`;const old=planChurn(d,a,false)!,next=planChurn(d,a,true)!;expect(next.news.filter(s=>s.includes('sits down')).length).toBeLessThanOrEqual(1);expect(next.settings.seatStacks?.[0]).toBeUndefined();
   for(const seat of a.game.seats.filter(s=>s.id!==0)){
    expect(old.settings.seatStacks?.[seat.id]).toBe(DEFAULT_SETTINGS.buyIn);
    const config=next.settings.opponents![seat.id-1],profile=createProfile(config,config.personalitySeed!,next.settings.population??'neutral');
    expect(next.settings.seatStacks?.[seat.id]).toBe(styleBuyIn(buyInStyle(profile,regularBuyInForProfile(profile)),next.settings));
   }
  }c.close();
 });
 it('preserves disabled top-ups for styled short-stackers',async()=>{
  const c=new SessionController(new Port());await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:2,allowTopUp:false,opponents:[regularConfig('gus')]});expect(c.error).toBe('');
  const d=structuredClone(c.data!),a=d.active!;a.game.seats.find(s=>s.id===1)!.stack=1000;
  for(let i=0;i<50;i++){a.game.handId=`disabled-styled:${i}`;expect(planChurn(d,a,true)).toBeNull();}c.close();
 });
});
