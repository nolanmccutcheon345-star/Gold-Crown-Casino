import {describe,it,expect} from 'vitest';
import type {Action,BotObservation,Card,GameState,RuleProfile} from '../../src/contracts';
import {startHand,applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {rig} from '../verification/helpers';
import {handFeatures} from '../../src/bots/features';
import {completeProfile} from '../../src/bots/profiles';
import {regularProfile} from '../../src/bots/regulars';
import {multiwayPlay,multiwayProfile} from '../../src/bots/multiway';
import {applySizingTell,regularSizingForProfile,REGULAR_SIZING,sizingStyle,type SizingStyle} from '../../src/bots/sizing-tells';
const hiro=regularProfile('hiro','high'),earl=regularProfile('big-earl','low');
const rules:RuleProfile={id:'independent-multiway',version:'1',mode:'cash',smallBlind:25,bigBlind:50,chipUnit:25,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const act=(s:GameState,a:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d${s.revision}`,action:a});
function flop(own:Card[],board:Card[]=['Ac','Kd','7h','2s','9d'],ownSeat=1,count=4){
 let s=startHand({handId:'fixed',button:0,profile:rules,seats:Array.from({length:count},(_,id)=>({id,name:`Seat ${id}`,stack:10000}))});
 const used=new Set([...own,...board]),free=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(c=>!used.has(c));
 const holes=s.seats.map(seat=>seat.id===ownSeat?own:free.splice(0,2));s=rig(s,holes,board);
 while(s.street==='preflop')s=act(s,legalActions(s).check?{type:'check'}:{type:'call'});return s;
}
const view=(s:GameState):BotObservation=>observeBot(s,s.actor!,hiro.policyVersion,'independent');
const zero=()=>0;
describe('independent multiway and sizing boundaries',()=>{
 it('protects genuine two pair, without treating board-only pairs as private strength',()=>{
  const s=flop(['Ah','Ks']),o=view(s);expect(handFeatures(o.ownCards,o.board).handClass).toBe('two-pair');
  const proposed=multiwayPlay(o,hiro,{type:'check'},zero);expect(proposed.play).toBe('protect');expect(()=>act(s,proposed.action)).not.toThrow();
  const boardPair=flop(['Qh','Js'],['Ac','Ad','7h','2s','9d']),p=view(boardPair);expect(handFeatures(p.ownCards,p.board).handClass).toBe('board-pair');
  expect(multiwayPlay(p,hiro,{type:'check'},zero).play).toBeNull();
 });
 it('keeps open-ended semi-bluffs rather than classifying eight outs as air',()=>{
  for(const [board,kind] of [[['6c','7d','Kh','2s','Ad'],'open-ended'],[['6c','Td','Qh','2s','Ad'],'double-gutshot']] as [Card[],string][]){
   const s=flop(['8h','9s'],board),o=view(s);expect(handFeatures(o.ownCards,o.board).drawClass).toBe(kind);
   expect(multiwayPlay(o,hiro,{type:'raise',to:125},zero)).toEqual({action:{type:'raise',to:125},play:null});
  }
 });
 it('keeps a pair plus an open-ended draw when another player still owes the bet',()=>{
  let s=flop(['8h','9s'],['6c','7d','8c','2s','Ad'],2);s=act(s,{type:'raise',to:75});const o=view(s),f=handFeatures(o.ownCards,o.board);
  expect(f.handClass).toBe('top-pair');expect(f.drawClass).toBe('open-ended');expect(multiwayPlay(o,hiro,{type:'call'},zero).play).toBeNull();
 });
 it('does not discard a guaranteed shared royal-flush chop as a marginal bluff-catcher',()=>{
  let s=flop(['2h','3s'],['As','Ks','Qs','Js','Ts'],2);while(s.street!=='river')s=act(s,legalActions(s).check?{type:'check'}:{type:'call'});
  s=act(s,{type:'raise',to:75});const o=view(s);expect(handFeatures(o.ownCards,o.board).absoluteNuts).toBe(true);
  expect(multiwayPlay(o,hiro,{type:'call'},zero).play).toBeNull();
 });
 it('does not invent raising authority when every opponent is all-in',()=>{
  const o=view(flop(['Ah','Ks']));o.seats=o.seats.map(s=>s.id===o.actingSeat?s:{...s,stack:0,allIn:true});o.legal={...o.legal,canRaise:false,minRaiseTo:null,maxRaiseTo:null};
  expect(multiwayPlay(o,hiro,{type:'check'},zero).play).toBeNull();
 });
 it('does not count folded or inert all-in players as pending callers behind a marginal hand',()=>{
  let s=flop(['7s','Qh'],['Ac','7d','2h','4s','9d'],2);s=act(s,{type:'raise',to:75});const o=view(s);
  expect(multiwayPlay(o,hiro,{type:'call'},zero).play).toBe('fold-marginal');
  o.seats=o.seats.map(s=>s.id===0?{...s,folded:true}:s.id===3?{...s,stack:0,allIn:true}:s);
  expect(multiwayPlay(o,hiro,{type:'call'},zero).play).toBeNull();
 });
 it('rounds every applied tell to 25-chip denominations and passes the authoritative reducer',()=>{
  const styles:SizingStyle[]=['big-means-strong','small-means-strong','blocker-bets','polarized'];
  for(const cards of [['Ah','Ks'],['Jh','4s']] as Card[][]){
   const s=flop(cards),o=view(s);
   for(const style of styles){const result=applySizingTell(o,earl,{type:'raise',to:125},zero,style);expect(result.action.type).toBe('raise');
    if(result.action.type==='raise')expect(result.action.to%25).toBe(0);expect(()=>act(s,result.action)).not.toThrow();}
  }
  let s=flop(['Ah','Ks'],undefined,2);s=act(s,{type:'raise',to:75});
  for(const style of styles){const result=applySizingTell(view(s),earl,{type:'raise',to:200},zero,style);expect(()=>act(s,result.action)).not.toThrow();if(result.action.type==='raise')expect(result.action.to%25).toBe(0);}
 });
 it('leaves all-ins, short-all-in authority, non-raises and heads-up multiway behavior untouched without consuming RNG',()=>{
  const o=view(flop(['Ah','Ks'],undefined,1,2)),random=()=>{throw Error('no sampling expected');};
  expect(multiwayPlay(o,hiro,{type:'check'},random).play).toBeNull();expect(multiwayProfile(o,hiro).effect).toBeNull();
  for(const action of [{type:'call'},{type:'check'},{type:'fold'},{type:'raise',to:o.legal.maxRaiseTo!}] as Action[])expect(applySizingTell(o,earl,action,random).action).toEqual(action);
  expect(applySizingTell({...o,legal:{...o.legal,shortAllInTo:75}},earl,{type:'raise',to:75},random).action).toEqual({type:'raise',to:75});
 });
 it('applies every authored regular override, including regulars without explicit buy-in overrides, but drops edited-profile overrides',()=>{
  for(const [id,style] of Object.entries(REGULAR_SIZING)){
   const p=regularProfile(id,'neutral');expect(regularSizingForProfile(p),id).toBe(style);
   expect(regularSizingForProfile({...p,skill:.99}),id).toBeUndefined();
   expect(regularSizingForProfile({...p,traits:{...completeProfile(p).traits,slowPlay:.123456}}),id).toBeUndefined();
  }
  const tess=regularProfile('tess','mid');expect(regularSizingForProfile(tess)).toBe('small-means-strong');
  const edited={...tess,skill:.99};expect(sizingStyle(edited,regularSizingForProfile(edited))).toBe('balanced');
 });
 it('reads only the allowed observation, consumes no private seat cards and does not mutate inputs',()=>{
  const o=view(flop(['Ah','Ks'])),before=structuredClone(o),profile=structuredClone(earl);
  for(const s of o.seats)Object.defineProperty(s,'hole',{get(){throw Error('Forbidden private hole-card access');}});
  multiwayProfile(o,hiro);multiwayPlay(o,hiro,{type:'check'},zero);applySizingTell(o,earl,{type:'raise',to:125},zero,'big-means-strong');
  expect(o).toEqual(before);expect(earl).toEqual(profile);
 });
});
