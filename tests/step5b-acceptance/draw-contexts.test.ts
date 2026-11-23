import {describe,it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {Card,GameState} from '../../src/contracts';
import {applyCommand,assertAccounting,observeBot} from '../../src/core/engine';
import {analyzeDecision,chooseDecision,createProfile} from '../../src/bots/policy';
import {act,hand,rig} from '../verification/helpers';
import {seededRandom} from '../step4a/scenarios';
const profile=createProfile({selection:'stronger-reg'},0x707091,'neutral');
function prefix(own:Card[],board:Card[]){let g=rig(hand([20000,20000]),[own,['Ac','Ad']],board);g=act(g,{type:'raise',to:1000});g=act(g,{type:'call'});g=act(g,{type:'raise',to:1000});return g;}
function observation(g:GameState){return observeBot(g,g.actor!,profile.policyVersion,'independent-draw-context');}
function trap(object:object,key:string){Object.defineProperty(object,key,{enumerable:true,get(){throw Error(`Forbidden ${key}`);}});}
function sample(g:GameState){const o=observation(g),counts={fold:0,check:0,call:0,raise:0},seen=new Set<string>();for(let i=0;i<256;i++){const d=chooseDecision(o,profile,seededRandom(0x700000+i));counts[d.action.type]++;if(!seen.has(JSON.stringify(d.action))){seen.add(JSON.stringify(d.action));assertAccounting(applyCommand(g,d));}}return{eligibleOpportunities:256,counts};}
describe('R07 public dirty-draw conditioning and hidden-information boundary',()=>{
 it.each([['nut',['Ah','3h']],['low',['9h','3h']]] as const)('%s flush draws discount paired-board outs using only public information',(label,own)=>{
  const states=[prefix([...own],['Kh','7h','2c','8d','Qs']),prefix([...own],['Kh','7h','7c','8d','Qs'])];
  const observations=states.map(observation),analyses=observations.map(o=>analyzeDecision(o,profile));
  expect(observations[0].legal.callAmount).toBe(1000);expect(observations[1].legal).toEqual(observations[0].legal);expect(observations[1].pot).toBe(observations[0].pot);
  expect(analyses[0].features.pairedBoard).toBe(false);expect(analyses[1].features.pairedBoard).toBe(true);expect(analyses[1].features.cleanOuts).toBeLessThan(analyses[0].features.cleanOuts);
  // Four known hearts leave exactly nine unseen hearts. The synthetic model
  // explicitly discounts non-nut and paired-board outs; this is not solver EV.
  expect(analyses[0].features.cleanOuts).toBeCloseTo(9*(label==='nut'?.97:.76)+(label==='nut'?1.3:0));
  expect(analyses[1].features.cleanOuts).toBeCloseTo(9*(label==='nut'?.97:.76)*.76+(label==='nut'?.5:0));
  expect(analyses[1].postflop!.drawContinue).not.toBe(analyses[0].postflop!.drawContinue);expect(analyses[1].distribution).not.toEqual(analyses[0].distribution);
  for(const [i,g]of states.entries()){
   const hidden=structuredClone(g);for(const s of hidden.seats)if(s.id!==hidden.actor)trap(s,'hole');for(const key of ['deck','deckCursor','burned'])trap(hidden,key);
   const secretSafe=observation(hidden);expect(secretSafe).toEqual(observations[i]);expect(analyzeDecision(secretSafe,profile)).toEqual(analyses[i]);
   for(const key of ['futureBoard','heroCards','privateProfiles','futureDeck'])trap(secretSafe,key);
   expect(chooseDecision(secretSafe,profile,seededRandom(711))).toEqual(chooseDecision(observations[i],profile,seededRandom(711)));
  }
  const dir=resolve(process.env.STEP5B_ACCEPTANCE_EVIDENCE_DIR??'tests/step5b-acceptance/evidence/runtime');mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,`dirty-draw-${label}.json`),JSON.stringify({profile,claim:'Public conditional synthetic draw model; discounts are provisional, not measured human calibration or exact equity',rows:states.map((g,i)=>({board:g.board,ownCards:g.seats[g.actor!].hole,publicEvents:g.events,analysis:analyses[i],samples:sample(g)}))},null,2));
 });
});
