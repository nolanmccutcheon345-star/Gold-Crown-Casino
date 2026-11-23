import {describe,it,expect} from 'vitest';
import type {Action,Card,GameEvent,GameState,RuleProfile} from '../../src/contracts';
import {startHand,applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {rig} from '../verification/helpers';
import {regularProfile} from '../../src/bots/regulars';
import {handFeatures} from '../../src/bots/features';
import {imageFrom,imagePlay,showdownImages,type ShowdownHand} from '../../src/bots/image';
import {texturePlay} from '../../src/bots/texture';
const hiro=regularProfile('hiro','high'),zero=()=>0;
const rules:RuleProfile={id:'independent-image',version:'1',mode:'cash',smallBlind:25,bigBlind:50,chipUnit:25,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const act=(s:GameState,action:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d${s.revision}`,action});
const view=(s:GameState)=>observeBot(s,s.actor!,hiro.policyVersion,'independent');
function flop(own:Card[],board:Card[],seat=0){
 let s=startHand({handId:'fixture',button:0,profile:rules,seats:[{id:0,name:'A',stack:10000},{id:1,name:'B',stack:10000}]});
 const used=new Set([...own,...board]),free=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(c=>!used.has(c)) as Card[];
 s=rig(s,seat===0?[own,free.slice(0,2)]:[free.slice(0,2),own],board);
 s=act(s,{type:'raise',to:150});return act(s,{type:'call'});
}
const event=(street:string,seatId=0):GameEvent=>({id:`${street}:${seatId}`,handId:'showdown',revision:1,type:'action',street,seatId,action:{type:'raise',to:100}} as GameEvent);
const shown=():ShowdownHand=>({events:[event('river')],board:['Kd','8c','4h','8s','Jc'],payouts:{1:500},revealed:[{id:0,hole:['7d','6d']},{id:1,hole:['Kh','Ks']}]});
describe('independent image and texture boundaries',()=>{
 it('requires a river bet rather than an earlier street bet to call a loser a caught river bluffer',()=>{
  for(const street of ['preflop','flop','turn'])expect(showdownImages({...shown(),events:[event(street)]}).get(0)?.bluff).toBe(false);
  expect(showdownImages(shown()).get(0)?.bluff).toBe(true);
  expect(showdownImages({...shown(),events:[event('river'),event('river',1)]}).get(0)?.bluff).toBe(false);
 });
 it('uses only revealed cards and does not credit a board-only monster to its bettor',()=>{
  expect(showdownImages({...shown(),revealed:[shown().revealed[1]]}).has(0)).toBe(false);
  const boardOnly={...shown(),board:['As','Ks','Qs','Js','Ts'],revealed:[{id:0,hole:['2h','3d']}],payouts:{0:250,1:250}};
  expect(showdownImages(boardOnly).get(0)).toEqual({bluff:false,monster:false});
  expect(showdownImages({...shown(),events:[event('flop',1)]}).get(1)?.monster).toBe(true);
 });
 it('invalidates cached classifications when a restored DTO is mutated and fades at the specified hand ages',()=>{
  const hand=shown();expect(imageFrom([hand],()=>0).bluff).toBe(1);
  (hand.events as GameEvent[])[0]=event('turn');expect(imageFrom([hand],()=>0).bluff).toBe(0);
  (hand.events as GameEvent[])[0]=event('river');expect(imageFrom([hand],()=>0).bluff).toBe(1);
  const empty:ShowdownHand={events:[],board:[],payouts:{},revealed:[]};
  expect(imageFrom([hand,...Array<ShowdownHand>(30).fill(empty)],()=>0).bluff).toBeCloseTo(Math.exp(-1));
  expect(imageFrom([hand],()=>null)).toEqual({bluff:0,monster:0});
 });
 it('never folds an unbeatable shared royal flush because of an opponent image',()=>{
  let s=flop(['2h','3s'],['As','Ks','Qs','Js','Ts']);while(s.street!=='river')s=act(s,legalActions(s).check?{type:'check'}:{type:'call'});
  s=act(s,{type:'raise',to:100});const o=view(s);expect(handFeatures(o.ownCards,o.board).absoluteNuts).toBe(true);
  expect(imagePlay(o,hiro,{type:'call'},{1:{bluff:0,monster:1}},zero)).toEqual({action:{type:'call'},play:null});
  expect(texturePlay(o,hiro,{type:'call'},zero).play).toBeNull();
 });
 it('keeps eight-out straight semi-bluffs on wet flops and blank turns',()=>{
  for(const [board,kind] of [[['6h','7h','Kc','2s','Ad'],'open-ended'],[['6c','Td','Qh','2s','Ad'],'double-gutshot']] as [Card[],string][]){
   let s=flop(['8h','9s'],board);s=act(s,{type:'check'});expect(handFeatures(view(s).ownCards,view(s).board).drawClass).toBe(kind);
   expect(texturePlay(view(s),hiro,{type:'raise',to:100},zero).play).toBeNull();
   s=act(s,{type:'raise',to:100});s=act(s,{type:'call'});s=act(s,{type:'check'});
   expect(texturePlay(view(s),hiro,{type:'raise',to:150},zero).play).toBeNull();
  }
 });
 it('sizes an authored dry c-bet in legal denominations and never invents raising permission',()=>{
  let s=flop(['5d','4c'],['Ks','7d','2c','9h','Ad']);s=act(s,{type:'check'});const o=view(s),before=structuredClone(o);
  const result=texturePlay(o,hiro,{type:'check'},zero);expect(result.play).toBe('dry-cbet');expect(result.action.type).toBe('raise');
  if(result.action.type==='raise')expect(result.action.to%25).toBe(0);expect(()=>act(s,result.action)).not.toThrow();expect(o).toEqual(before);
  o.legal={...o.legal,canRaise:false,minRaiseTo:null,maxRaiseTo:null};expect(texturePlay(o,hiro,{type:'check'},zero).play).toBeNull();
 });
 it('changes only a genuine one-pair bluff catcher on a flush scare and returns a legal fold',()=>{
  let s=flop(['Kc','9d'],['Kh','7h','2c','5h','3s'],1);s=act(s,{type:'check'});s=act(s,{type:'raise',to:100});s=act(s,{type:'call'});s=act(s,{type:'check'});s=act(s,{type:'raise',to:200});
  const o=view(s);expect(handFeatures(o.ownCards,o.board).handClass).toBe('top-pair');const r=texturePlay(o,hiro,{type:'call'},zero);expect(r.play).toBe('scare-fold');expect(()=>act(s,r.action)).not.toThrow();
  // Three board kings are not a private one-pair hand, even though their heuristic strength is modest.
  o.board=['Kh','Kd','Kc','5h','3h'];o.ownCards=['Qd','9s'];o.street='river';expect(handFeatures(o.ownCards,o.board).handClass).toBe('board-trips');
  expect(texturePlay(o,hiro,{type:'call'},zero).play).toBeNull();
 });
});
