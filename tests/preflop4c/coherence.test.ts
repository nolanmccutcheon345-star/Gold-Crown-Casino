import {describe,expect,it} from 'vitest';
import {startHand,applyCommand,observeBot} from '../../src/core/engine';
import type {BotObservation,Card} from '../../src/contracts';
import {analyzePreflop,physicalPosition,rangeWeights} from '../../src/bots/preflop';
import {defaultProfile} from '../../src/bots/profiles';
import {practiceProfile} from '../verification/helpers';
function firstIn(n:number,seat:number,cards:Card[],depth=100):BotObservation{
 let g=startHand({handId:'independent-opening-shape',button:0,profile:practiceProfile(),seats:Array.from({length:n},(_,id)=>({id,name:`P${id}`,stack:200*depth}))});
 while(g.actor!==seat){if(g.actor===null)throw Error('Not first in');g=applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor,decisionId:`fold${g.revision}`,action:{type:'fold'}});}
 const o=observeBot(g,g.actor!,defaultProfile('tag').policyVersion,'shape');o.ownCards=cards;return o;
}
describe('Step4C preregistered opening structure guards',()=>{
 it('a technically competent first-in policy normally opens broadway, wheel-ace and middle-pair candidate classes in representative positions',()=>{
  // Independently published six-max100BB ART/GTO reference opens A5s UTG,
  // predominantly opens77 UTG, and QJo CO. The conservative >1/2 guard is a
  // declared qualitative design check, NOT a solver-frequency imitation.
  for(const archetype of ['tag','stronger-reg']as const)for(const [seat,cards]of [[3,['As','5s']],[3,['7h','7d']],[5,['Qh','Jd']]]as const){
   expect(analyzePreflop(firstIn(6,seat,[...cards]),defaultProfile(archetype)).distribution.raise,`${archetype} ${cards}`).toBeGreaterThan(.5);
  }
 });
 it('additional empty early seats do not tighten an identical folded-to-button contest against the same two blinds',()=>{
  for(const a of ['tag','stronger-reg','lag']as const){const p=defaultProfile(a);const rates=[6,9,10].map(n=>analyzePreflop(firstIn(n,0,['Kh','8h']),p).distribution.raise);expect(rates[1]).toBeCloseTo(rates[0],12);expect(rates[2]).toBeCloseTo(rates[0],12);}
 });
 it('early positions in full-ring have graduated response-player pressure rather than one identical coarse UTG bucket',()=>{
  const p=defaultProfile('tag'),rates=[3,4,5].map(seat=>analyzePreflop(firstIn(10,seat,['Ah','9h']),p).distribution.raise);
  expect(rates[0]).toBeLessThan(rates[1]);expect(rates[1]).toBeLessThan(rates[2]);
 });
 it('an extreme short-stack preflop call is priced against callable chips, excluding the opponents refundable excess',()=>{
  let g=startHand({handId:'short-preflop-price',button:0,profile:practiceProfile(),seats:[{id:0,name:'Deep',stack:20000},{id:1,name:'Short',stack:4000}]});
  g=applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:'shove',action:{type:'raise',to:20000}});
  const p=defaultProfile('tag'),o=observeBot(g,1,p.policyVersion,'short-response');o.ownCards=['Ad','Qh'];const a=analyzePreflop(o,p);
  expect(a.diagnostics.callPrice).toBeCloseTo(3800/8000,12);
 });
 it('reports explicit physical position names at every requested table size, independently of coarse model labels',()=>{
  expect(physicalPosition(firstIn(2,0,['As','Kd']))).toBe('BTN/SB');
  for(const [n,names] of [[6,['UTG/LJ','HJ','CO']],[9,['UTG','UTG+1','UTG+2','LJ','HJ','CO']],[10,['UTG','UTG+1','UTG+2','UTG+3','LJ','HJ','CO']]]as const){
   for(let i=0;i<names.length;i++)expect(physicalPosition(firstIn(n,3+i,['As','Kd']))).toBe(names[i]);
   expect(physicalPosition(firstIn(n,0,['As','Kd']))).toBe('BTN');expect(physicalPosition(firstIn(n,1,['As','Kd']))).toBe('SB');
  }
 });
 it('rejects invalid optional response-player counts instead of silently accepting impossible advisory contexts',()=>{
  const p=defaultProfile('tag');for(const playersBehind of [-1,6,.5,NaN])expect(()=>rangeWeights(p,'UTG','unopened',100,{seats:6,playersBehind})).toThrow(/modifiers/);
 });
});
