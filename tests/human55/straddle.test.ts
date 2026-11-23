import {describe,it,expect} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {GameState,RuleProfile,Action} from '../../src/contracts';
import {DEFAULT_SETTINGS,SessionController,rules} from '../../src/session/controller';
import {startHand,applyCommand,legalActions,nextHand,nextHandStraddleSeat,projectView,validatePublicReplay,assertAccounting} from '../../src/core/engine';
import {assertSupportedCashScope} from '../../src/session/release-scope';
import {ruleProfileConfigVersion} from '../../src/rules/provenance';
import {HUMAN_LAYER_V15} from '../../src/bots/human';
import {straddleRate,decidesToStraddle,REGULAR_STRADDLE,straddledView} from '../../src/bots/straddle';
import {regularProfile,REGULARS} from '../../src/bots/regulars';
import {createProfile} from '../../src/bots/profiles';
class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){if((this.value?.revision??null)!==expected)throw Error('Revision changed');this.value=structuredClone(next);}close(){}}
const base:RuleProfile={id:'st',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const allow:RuleProfile={...base,straddle:{kind:'utg-live',multiple:2}};
const seats=(n:number,stack=20000)=>Array.from({length:n},(_,i)=>({id:i,name:`S${i}`,stack}));
const act=(s:GameState,a:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action:a});

describe('engine: live straddle (V410)',()=>{
 it('under the gun posts twice the big blind, action starts to its left, the straddler has the option',()=>{
  let s=startHand({handId:'a',button:0,profile:allow,seats:seats(6),straddle:{seatId:3}});
  expect(s.straddleSeat).toBe(3);expect(s.currentBet).toBe(400);expect(s.pot).toBe(700);expect(s.actor).toBe(4);
  const blinds=s.events.filter(e=>e.type==='blind');expect(blinds.map(e=>[e.seatId,e.amount,e.detail??''])).toEqual([[1,100,''],[2,200,''],[3,400,'Live straddle']]);
  const l=legalActions(s);expect(l.callAmount).toBe(400);expect(l.minRaiseTo).toBe(800);
  expect(()=>act(s,{type:'raise',to:700})).toThrow();
  s=act(s,{type:'call'});s=act(s,{type:'fold'});s=act(s,{type:'fold'});
  expect(s.actor).toBe(1);expect(legalActions(s).callAmount).toBe(300);s=act(s,{type:'call'});
  expect(s.actor).toBe(2);expect(legalActions(s).callAmount).toBe(200);s=act(s,{type:'call'});
  expect(s.actor).toBe(3);const option=legalActions(s);expect(option.check).toBe(true);expect(option.canRaise).toBe(true);expect(option.minRaiseTo).toBe(800);
  s=act(s,{type:'raise',to:1600});expect(s.pending).toEqual([4,1,2]);
  for(let fold=0;fold<3;fold++)s=act(s,{type:'fold'});
  expect(s.street).toBe('complete');expect(s.seats.find(x=>x.id===3)!.stack).toBe(20000+1200);expect(s.events.some(e=>e.type==='refund'&&e.seatId===3&&e.amount===1200)).toBe(true);assertAccounting(s);
  const view=projectView(s,0);expect(view.straddleSeat).toBe(3);
 });
 it('rules and seats are checked: only with the rule, only under the gun, four or more players, chips behind',()=>{
  expect(()=>startHand({handId:'b',button:0,profile:base,seats:seats(6),straddle:{seatId:3}})).toThrow(/not enabled/);
  expect(()=>startHand({handId:'b',button:0,profile:allow,seats:seats(6),straddle:{seatId:4}})).toThrow(/under the gun/);
  expect(()=>startHand({handId:'b',button:0,profile:allow,seats:seats(3),straddle:{seatId:0}})).toThrow(/under the gun/);
  const short=seats(6);short[3].stack=400;expect(()=>startHand({handId:'b',button:0,profile:allow,seats:short,straddle:{seatId:3}})).toThrow(/chips behind/);
  expect(()=>startHand({handId:'b',button:0,profile:{...allow,straddle:{kind:'mississippi',multiple:2} as never},seats:seats(6)})).toThrow(/straddle/);
  expect(()=>startHand({handId:'b',button:0,profile:{...allow,straddle:{kind:'utg-live',multiple:3} as never},seats:seats(6)})).toThrow(/straddle/);
  expect(()=>startHand({handId:'b',button:0,profile:{...base,mode:'tournament',straddle:{kind:'utg-live',multiple:2},tournament:{bigBlindAnte:0,antePriority:'blind-first',buttonRule:'dead-button'}} as RuleProfile,seats:seats(6)})).toThrow();
  // Without a straddle the rule changes nothing about the deal.
  const plain=startHand({handId:'c',button:0,profile:allow,seats:seats(6)});expect(plain.straddleSeat).toBeUndefined();expect(plain.currentBet).toBe(200);expect(plain.actor).toBe(3);
 });
 it('scope: a single live straddle is allowed; multiple straddles, bomb pots and run-it-twice stay blocked',()=>{
  expect(()=>assertSupportedCashScope({straddle:{kind:'utg-live',multiple:2}})).not.toThrow();
  for(const key of ['straddle','straddles','bombPot','bombPots','runItTwice'])expect(()=>assertSupportedCashScope({[key]:true})).toThrow();
  expect(()=>assertSupportedCashScope({straddle:{kind:'mississippi',multiple:2}})).toThrow();expect(()=>assertSupportedCashScope({straddle:{kind:'utg-live',multiple:2,extra:1}})).toThrow();
 });
 it('next hand asks only the next under-the-gun seat; straddled hands replay exactly',()=>{
  let s=startHand({handId:'n1',button:0,profile:allow,seats:seats(6)});while(s.street!=='complete')s=act(s,{type:'fold'});
  const utg=nextHandStraddleSeat(s);expect(utg).toBe(4);const asked:number[]=[];
  let n=nextHand(s,'n2',seat=>{asked.push(seat);return true;});expect(asked).toEqual([4]);expect(n.straddleSeat).toBe(4);expect(n.actor).toBe(5);
  const frames=[projectView(n,0)];
  while(n.street!=='complete'){const l=legalActions(n);n=act(n,l.check?{type:'check'}:{type:'call'});frames.push(projectView(n,0));}
  expect(()=>validatePublicReplay(frames)).not.toThrow();
  const forged=structuredClone(frames);delete forged[0].straddleSeat;expect(()=>validatePublicReplay(forged)).toThrow();
  expect(nextHand(s,'n3',()=>false).straddleSeat).toBeUndefined();
  // Rules without straddles never ask.
  let p=startHand({handId:'p1',button:0,profile:base,seats:seats(6)});while(p.street!=='complete')p=act(p,{type:'fold'});
  expect(nextHand(p,'p2',()=>{throw Error('asked');}).straddleSeat).toBeUndefined();
 });
 it('the straddle setting is part of the rule-profile version, so a change applies from the next hand (V706)',()=>{
  const off=rules({...DEFAULT_SETTINGS}),on=rules({...DEFAULT_SETTINGS,liveStraddle:true});
  expect(off.straddle).toBeUndefined();expect(on.straddle).toEqual({kind:'utg-live',multiple:2});expect(on.version).not.toBe(off.version);
  expect(ruleProfileConfigVersion(off)).toBe(off.version);
 });
});

describe('players straddle (layer 1.5.0)',()=>{
 it('loose, aggressive and recreational players straddle; strong tight players and short stacks do not',()=>{
  const r=(id:string)=>straddleRate(regularProfile(id,'mid'),{},REGULAR_STRADDLE[id]);
  expect(r('vince')).toBeGreaterThan(.5);expect(r('hiro')).toBe(0);
  const maniacs=straddleRate(createProfile({selection:'maniac'},5,'neutral')),nits=straddleRate(createProfile({selection:'nit'},5,'neutral'));expect(maniacs).toBeGreaterThan(nits);
  expect(straddleRate(createProfile({selection:'lag'},9,'neutral'),{tilt:.8})).toBeGreaterThan(straddleRate(createProfile({selection:'lag'},9,'neutral'),{}));
  const vince=regularProfile('vince','mid');expect(decidesToStraddle(vince,'h',3,20,{},.99)).toBe(false);
  expect(decidesToStraddle(vince,'h',3,100,{},.7)).toBe(decidesToStraddle(vince,'h',3,100,{},.7));
  for(const id of Object.keys(REGULAR_STRADDLE))expect(REGULARS.some(x=>x.id===id)).toBe(true);
 });
 it('a straddled pot reads the straddle as the big blind before the flop only',()=>{
  const s=startHand({handId:'v',button:0,profile:allow,seats:seats(6),straddle:{seatId:3}});const o={...projectView(s,0),bigBlind:200,street:'preflop'} as never;
  expect((straddledView(o,400) as {bigBlind:number}).bigBlind).toBe(400);expect((straddledView({...(o as object),street:'flop'} as never,400) as {bigBlind:number}).bigBlind).toBe(200);
 });
 it('a straddle table plays complete legal hands with straddles from players and Hero; history stays valid',async()=>{
  const c=new SessionController(new Port());await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:9,liveStraddle:true});expect(c.error).toBe('');
  expect(c.data!.active!.humanLayer).toMatch(/^human-1\.([5-9]|1[0-9]|2[01])\.0$/);void HUMAN_LAYER_V15;expect(c.data!.active!.game.profile.straddle).toBeDefined();
  await c.setHeroStraddle(true);let straddles=0,hero=0;
  for(let h=0;h<70;h++){
   for(let i=0;i<600&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;
    if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}
    expect(c.error).toBe('');}
   if(c.data!.active!.game.straddleSeat!==undefined){straddles++;if(c.data!.active!.game.straddleSeat===0)hero++;}
   if(h<69){if(c.data!.active!.game.seats.find(s=>s.id===0)!.stack<2000)await c.topUp(DEFAULT_SETTINGS.buyIn);await c.nextHand();expect(c.error).toBe('');}
  }
  expect(straddles).toBeGreaterThan(5);expect(hero).toBeGreaterThan(0);
  for(const hand of c.data!.hands)expect(()=>validatePublicReplay(hand.frames)).not.toThrow();
  console.log(`straddle table: ${straddles} straddled hands of 70 (Hero ${hero})`);
 },240000);
});
