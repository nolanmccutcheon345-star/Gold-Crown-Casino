import {describe,it,expect} from 'vitest';
import type {CashSettings} from '../../src/session/types';
import {startHand,applyCommand,observeBot,assertAccounting} from '../../src/core/engine';
import {chooseDecision} from '../../src/bots/policy';
import {createProfile,presetTraits,completeProfile,resolveConfig,seedStream,ARCHETYPES} from '../../src/bots/profiles';
import {REGULARS,regularConfig,regularFor,regularProfile,regularSeed,isRegularName} from '../../src/bots/regulars';
import {normalizeTableSettings,tableParticipants,tableProfiles} from '../../src/session/configuration';
import {initializeOpponentSettings,readOpponentSettings,seatRegulars} from '../../src/ui/opponent-setup';
import {tournamentStyle,bubbleAwareness} from '../../src/tournament/bot-policy-v2';
import {baseNames} from '../../src/tournament/field';

const base:CashSettings={seats:9,stake:'0',smallBlind:100,bigBlind:200,buyIn:20000,rakeMode:'none',rakeBasisPoints:500,rakeCap:300,noFlopNoDrop:true,archetypes:['tag','station','nit','lag','passive-reg','fit-or-fold','stronger-reg','maniac','tag'],minBuyInBB:1,maxBuyInBB:500,allowTopUp:true} as CashSettings;
const regular=(id:string)=>REGULARS.find(r=>r.id===id)!;

describe('the regulars',()=>{
 it('are forty distinct named characters with fixed seeds and names no one else uses',()=>{
  expect(REGULARS.length).toBe(40);
  expect(new Set(REGULARS.map(r=>r.id)).size).toBe(40);expect(new Set(REGULARS.map(r=>r.name)).size).toBe(40);
  expect(new Set(REGULARS.map(r=>regularSeed(r.id))).size).toBe(40);
  for(const stake of ['low','mid','high'] as const)expect(REGULARS.filter(r=>r.stakes.includes(stake)).length,stake).toBeGreaterThanOrEqual(9);
  const others=new Set([...baseNames(108),'You','Sam']);for(const r of REGULARS){expect(others.has(r.name),r.name).toBe(false);expect(isRegularName(r.name)).toBe(true);expect(r.read.length).toBeGreaterThan(20);}
  expect(isRegularName('Alex')).toBe(false);
  for(const archetype of ARCHETYPES)expect(REGULARS.some(r=>r.base===archetype),archetype).toBe(true);
 });
 it('always have the same personality, distinct from their stock style',()=>{
  for(const r of REGULARS){
   const a=regularProfile(r.id,'mid'),b=regularProfile(r.id,'mid');expect(a).toEqual(b);
   expect(a.archetype).toBe(r.base);expect(a.personalityId).toContain(regularSeed(r.id).toString(16).padStart(8,'0'));
   const full=completeProfile(a),stock=presetTraits(r.base);
   for(const [key,value] of Object.entries(r.traits))expect(full.traits[key as keyof typeof stock]).toBe(value);
   const shaped=r.aggression!==undefined||r.looseness!==undefined||r.skill!==undefined||!!r.habits;
   if(Object.keys(r.traits).length)expect(shaped||Object.entries(r.traits).some(([key,value])=>Math.abs(value!-stock[key as keyof typeof stock])>.1),r.name).toBe(true);
  }
 });
 it('are recognised from their settings, and stop being recognised once edited',()=>{
  for(const r of REGULARS){const config=regularConfig(r.id);expect(regularFor(config)?.id).toBe(r.id);expect(regularFor(resolveConfig(config,config.personalitySeed!))?.id).toBe(r.id);}
  const earl=regularConfig('big-earl');
  expect(regularFor({...earl,traits:{...earl.traits!,riverCuriosity:.5}})).toBeUndefined();
  expect(regularFor({...earl,skill:.9})).toBeUndefined();expect(regularFor({...earl,personalitySeed:12345})).toBeUndefined();
  expect(regularFor({selection:'station',personalitySeed:regularSeed('big-earl')})).toBeUndefined();
 });
 it('play their own tournament styles under 2.2.0 personal quirks',()=>{
  const style=(id:string)=>tournamentStyle(regularProfile(id,'mid'),true),stock=(a:Parameters<typeof presetTraits>[0])=>tournamentStyle(createProfile({selection:'custom',baseArchetype:a,traits:presetTraits(a),aggression:completeProfile(createProfile({selection:a},1,'neutral')).aggression,looseness:completeProfile(createProfile({selection:a},1,'neutral')).looseness},1,'mid'),true);
  expect(style('gus').pushDepth).toBeGreaterThan(stock('passive-reg').pushDepth+2);
  expect(style('gus').callWidth).toBeGreaterThan(stock('passive-reg').callWidth);
  expect(bubbleAwareness(regularProfile('hank','mid'),true)).toBeGreaterThan(bubbleAwareness(regularProfile('hank','mid'),false));
  expect(bubbleAwareness(regularProfile('mei','mid'),true)).toBeGreaterThan(bubbleAwareness(regularProfile('ana','mid'),true));
  expect(bubbleAwareness(regularProfile('duke','mid'),true)).toBeLessThan(bubbleAwareness(regularProfile('duke','mid'),false));
  expect(style('lena').cbet).toBeGreaterThan(stock('tag').cbet);
  // Without personal quirks a regular's style only depends on its overall shape, as in 2.1.0.
  expect(tournamentStyle(regularProfile('gus','mid'),false).pushDepth).toBeLessThan(style('gus').pushDepth);
 });
 it('can be seated at a cash table, show their names, and go back to a default name when replaced',()=>{
  let settings=initializeOpponentSettings({...base});settings=seatRegulars(settings,_n=>0);
  const normalized=normalizeTableSettings(settings,()=>1);
  const seated=normalized.opponents!.map(c=>regularFor(c)?.name);expect(seated.length).toBe(8);expect(new Set(seated).size).toBe(8);expect(seated.every(Boolean)).toBe(true);
  const players=tableParticipants(normalized);expect(players[0].name).toBe('You');
  for(const p of players.slice(1))expect(p.name).toBe(regularFor(normalized.opponents![p.id-1])!.name);
  const profiles=tableProfiles(normalized);
  for(const p of players.slice(1))expect(profiles[p.id]).toEqual(regularProfile(regularFor(normalized.opponents![p.id-1])!.id,'neutral'));
  const game=startHand({handId:'regulars-cash',button:0,profile:{id:'cash',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'} as never,seats:players});
  const replaced={...normalized,opponents:normalized.opponents!.map((c,i)=>i===0?{selection:'tag' as const,personalitySeed:777}:c)};
  const after=tableParticipants(replaced,game);expect(after[1].name).toBe('Alex');expect(after[2].name).toBe(players[2].name);
 });
 it('are chosen from the style menu, and one regular cannot sit in two seats',()=>{
  const settings=initializeOpponentSettings({...base});
  const form=new FormData();form.set('population','neutral');form.set('opponent-1-selection','regular:big-earl');form.set('opponent-2-selection','tag');
  const read=readOpponentSettings(form,settings);expect(regularFor(read.opponents![0])?.name).toBe('Big Earl');expect(read.opponents![1].selection).toBe('tag');expect(read.archetypes[0]).toBe('station');
  form.set('opponent-2-selection','regular:big-earl');expect(()=>readOpponentSettings(form,settings)).toThrow(/Big Earl can only sit in one seat/);
  form.set('opponent-2-selection','regular:nobody');expect(()=>readOpponentSettings(form,settings)).toThrow(/listed regular/);
 });
 it('play complete legal cash hands',()=>{
  const ids=REGULARS.map(r=>r.id);
  for(let round=0;round<6;round++){
   const seated=Array.from({length:9},(_,i)=>ids[(round*9+i)%ids.length]);
   let s=startHand({handId:`cash-regulars:${round}`,button:round%9,profile:{id:'cash',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'} as never,seats:seated.map((id,seat)=>({id:seat,name:regular(id).name,stack:20000+seat*1000}))});
   for(let n=0;s.street!=='complete'&&n<300;n++){const id=seated[s.actor!],p=regularProfile(id,'neutral'),o=observeBot(s,s.actor!,p.policyVersion,`r:${n}`);s=applyCommand(s,chooseDecision(o,p,seedStream(round*1000+n)));assertAccounting(s);}
   expect(s.street).toBe('complete');
  }
 });
});
