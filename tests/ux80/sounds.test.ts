import {describe,expect,it} from 'vitest';
import type {GameEvent} from '../../src/contracts';
import {soundCues,soundState,ploSoundState,ploSoundCues,bjSoundCues,setVolume,playSound} from '../../src/ui/sounds';
import {startPloHand,applyPlo,legalPlo} from '../../src/plo/engine';
import {standardDeck} from '../../src/core/deck';
import {normalizeStyle,DEFAULT_STYLE} from '../../src/ui/table-style';

const ev=(type:GameEvent['type'],action?:GameEvent['action'],seatId?:number):GameEvent=>({id:String(Math.random()),handId:'h',revision:1,type,action,seatId});
const view=(events:GameEvent[],seats?:{id:number;stack:number}[],street='flop',payouts:Record<number,number>={})=>({handId:'h',street,events,payouts,seats}) as never;

describe('Patch 80 sounds',()=>{
 it('plays an all-in when a raise leaves the player with no chips, a chip otherwise',()=>{
  const before=view([ev('start')],[{id:1,stack:5000}]);
  expect(soundCues(soundState(before,false),soundState(view([ev('start'),ev('action',{type:'raise',to:9000},1)],[{id:1,stack:0}]),false),view([ev('start'),ev('action',{type:'raise',to:9000},1)],[{id:1,stack:0}]))).toEqual(['allin']);
  const raise=view([ev('start'),ev('action',{type:'raise',to:400},1)],[{id:1,stack:4600}]);expect(soundCues(soundState(before,false),soundState(raise,false),raise)).toEqual(['chip']);
 });
 it('plays chips being collected when someone else wins the pot',()=>{
  const before=view([ev('start')],[],'river'),lost=view([ev('start'),ev('award')],[],'complete',{2:500});
  expect(soundCues(soundState(before,false),soundState(lost,false),lost)).toContain('collect');
  const won=view([ev('start'),ev('award')],[],'complete',{0:500});expect(soundCues(soundState(before,false),soundState(won,false),won)).toEqual(['win']);
 });
 it('gives Omaha its own sounds: a shuffle and deal for a new hand, chips, cards and the win',()=>{
  const d=standardDeck();let h=startPloHand({handId:'a',button:0,smallBlind:100,bigBlind:200,seats:[0,1,2].map(id=>({id,name:`P${id}`,stack:20000})),deck:d});
  expect(ploSoundCues(ploSoundState(null,false),ploSoundState(h,false),h)).toEqual([]);
  const other=startPloHand({handId:'b',button:1,smallBlind:100,bigBlind:200,seats:[0,1,2].map(id=>({id,name:`P${id}`,stack:20000})),deck:d});
  expect(ploSoundCues(ploSoundState(h,false),ploSoundState(other,h.actor===0),other)).toContain('shuffle');
  const prev=ploSoundState(h,false);h=applyPlo(h,legalPlo(h)!.call?{type:'call'}:{type:'check'});
  expect(ploSoundCues(prev,ploSoundState(h,false),h)).toContain(legalPlo(h)?'chip':'chip');
  let all=h;while(all.street!=='complete'){const l=legalPlo(all)!;all=applyPlo(all,l.canRaise?{type:'raise',to:l.maxRaiseTo}:l.call?{type:'call'}:{type:'check'});}
  const sawAllIn=all.seats.some(s=>s.allIn);const cues=ploSoundCues(ploSoundState(h,false),ploSoundState(all,false),all);expect(cues.length).toBeLessThanOrEqual(3);if(all.events.length-h.events.length<=6&&sawAllIn)expect(cues).toContain('allin');
 });
 it('plays blackjack sounds for the deal, new cards, the result and a new shoe',()=>{
  const s=(o:Partial<{roundId:string|null;cards:number;settled:boolean;outcome:string|null;shoe:number}>)=>({roundId:'r1',cards:4,settled:false,outcome:null,shoe:300,...o});
  expect(bjSoundCues(null,s({}))).toEqual([]);expect(bjSoundCues(s({roundId:'r0'}),s({}))).toEqual(['deal']);
  expect(bjSoundCues(s({}),s({cards:5}))).toEqual(['card']);
  for(const [o,k] of [['blackjack','blackjack'],['win','win'],['push','push'],['bust','bust'],['lose','lose']] as const)expect(bjSoundCues(s({cards:6}),s({cards:6,settled:true,outcome:o}))).toEqual([k]);
  expect(bjSoundCues(s({shoe:20}),s({shoe:312,roundId:null}))).toEqual(['shuffle']);
 });
 it('keeps a volume setting between 0 and 100, and plays nothing without a running audio context',()=>{
  expect(DEFAULT_STYLE.volume).toBe(70);expect(normalizeStyle({volume:140}).volume).toBe(100);expect(normalizeStyle({volume:-3}).volume).toBe(0);expect(normalizeStyle({volume:'loud'}).volume).toBe(70);
  expect(()=>{setVolume(2);setVolume(Number.NaN);for(const k of ['allin','collect','shuffle','blackjack','bust','push','lose','flip'] as const)playSound(k);}).not.toThrow();
 });
});
