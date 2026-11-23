import {describe,it,expect} from 'vitest';
import type {BotProfile,GameState} from '../../src/contracts';
import {regularProfile} from '../../src/bots/regulars';
import {handChatter,type Chatter} from '../../src/bots/talk';
import {GRUDGE_LINES} from '../../src/bots/rivalry';
import {chatterFor} from '../../src/ui/table-talk';
import {hand,rig,act} from '../verification/helpers';
const vince=regularProfile('vince','mid');
const persona={1:{name:'Vince',profile:vince,regular:'vince'}};
const profileAt=(seat:number):BotProfile|undefined=>seat===1?vince:undefined;
const isGrudge=(chatter:Chatter)=>chatter.lines.some(l=>[...GRUDGE_LINES.lost,...GRUDGE_LINES.won].includes(l.text));
function settled(winner:0|2=0,sidePot=false):GameState {
 let s=rig(hand(sidePot?[10000,20000,20000]:[20000,20000,20000]),winner===0?[['As','Ad'],['Qc','Qd'],['Kc','Kd']]:[['Kc','Kd'],['Qc','Qd'],['As','Ad']],['2c','4h','7s','9d','Tc']);
 s=act(s,{type:'raise',to:sidePot?10000:20000});
 if(sidePot)s=act(s,{type:'raise',to:20000});
 while(s.street!=='complete')s=act(s,{type:'call'});
 return s;
}
function chattyHand(prefix:string):GameState {
 const base=settled();
 // Fixed deterministic hand IDs select an eligible talk draw; the game/cards never change.
 for(let i=0;i<100;i++){const s={...base,handId:`${prefix}-${i}`};if(isGrudge(handChatter(s,persona,{grudgeAt:()=>1})))return s;}
 throw Error('No deterministic eligible grudge line');
}
describe('independent rivalry chatter evidence and cache',()=>{
 it('requires an existing grudge before the current big loss, while an actual repeat is eligible',()=>{
  const game=chattyHand('talk59-repeat');expect(game.payouts[0]).toBe(60000);
  expect(isGrudge(chatterFor(game,profileAt,false,true,()=>0))).toBe(false);
  expect(isGrudge(chatterFor(game,profileAt,false,true,()=>1))).toBe(true);
 });
 it('keys exact numeric levels rather than hand ID or coarse presence',()=>{
  const game=chattyHand('talk59-levels');
  const low=chatterFor(game,profileAt,false,true,()=>.39),high=chatterFor(game,profileAt,false,true,()=>.41);
  expect(isGrudge(low)).toBe(false);expect(isGrudge(high)).toBe(true);
  expect(chatterFor(game,profileAt,false,true,()=>.39)).toEqual(low);
 });
 it('does not reuse a same-ID/revision result for a different public winner',()=>{
  const game=chattyHand('talk59-winner'),first=chatterFor(game,profileAt,false,true,()=>1);
  expect(isGrudge(first)).toBe(true);
  const other={...settled(2),handId:game.handId};expect(other.revision).toBe(game.revision);expect(other.payouts[2]).toBe(60000);
  expect(isGrudge(chatterFor(other,profileAt,false,true,()=>1))).toBe(false);
 });
 it('does not attribute an unrelated side-pot loss to Hero even when Hero profits',()=>{
  const base=settled(0,true);expect(base.payouts[0]).toBe(30000);expect(base.payouts[2]).toBe(20000);
  for(let i=0;i<30;i++)expect(isGrudge(handChatter({...base,handId:`talk59-side-${i}`},persona,{grudgeAt:()=>1}))).toBe(false);
 });
 it('includes the persona context in new grudge-cache entries and respects the toggle',()=>{
  const game=chattyHand('talk59-profile');expect(isGrudge(chatterFor(game,profileAt,false,true,()=>1))).toBe(true);
  expect(chatterFor(game,()=>undefined,false,true,()=>1)).toEqual({lines:[],shows:[]});
  expect(chatterFor(game,profileAt,false,false,()=>1)).toEqual({lines:[],shows:[]});
 });
});
