import type { Action, Card, GameState, BotMemory } from '../../src/contracts';
import { applyCommand, legalActions, startHand } from '../../src/core/engine';
import { practiceProfile, rig } from '../verification/helpers';
import { seededRandom } from '../step4a/scenarios';

export interface SequenceFixture {id:string;subset:'development'|'evaluation';focusSeat:number;initial:GameState;state:GameState;prefix:Action[];memory?:BotMemory;description:string;}
function begin(id:string,seed:number,seats:number,stackBB:number,focus:number,own:Card[],board:Card[]):SequenceFixture{
 const blocked=[...own,...board];if(new Set(blocked).size!==blocked.length)throw new Error(`Duplicate fixture card in${id}`);
 const rest=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(c=>!blocked.includes(c));const random=seededRandom(seed^0x4bdec);
 for(let i=rest.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[rest[i],rest[j]]=[rest[j],rest[i]];}
 const holes=Array.from({length:seats},(_,seat)=>seat===focus?own:rest.splice(0,2));
 const initial=rig(startHand({handId:`step4b-sequence:${id}:${seed}`,seats:Array.from({length:seats},(_,id)=>({id,name:`Seat${id}`,stack:stackBB*200})),button:0,profile:practiceProfile()}),holes,board);
 return{id,subset:'development',focusSeat:focus,initial:structuredClone(initial),state:initial,prefix:[],description:''};
}
function act(f:SequenceFixture,action:Action){const s=f.state;if(s.actor===null)throw new Error(`Prefix ended prematurely:${f.id}`);f.prefix.push(action);
 f.state=applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor,decisionId:`prefix:${s.handId}:${s.revision}`,action});}
function checkTo(f:SequenceFixture,street:'flop'|'turn'|'river'){for(let n=0;f.state.street!==street&&n<30;n++)act(f,{type:'check'});if(f.state.street!==street)throw new Error(`Missingstreet:${f.id}`);}
function singleRaised(id:string,seed:number,own:Card[],board:Card[],stack=100){const f=begin(id,seed,2,stack,0,own,board);act(f,{type:'raise',to:600});act(f,{type:'call'});return f;}
function observedStyle(seat:number,aggressive:boolean):BotMemory{return{windowHands:60,opponents:[{seatId:seat,hands:60,vpip:{count:aggressive?42:13,opportunities:60},pfr:{count:aggressive?29:9,opportunities:60},aggression:{count:aggressive?51:8,opportunities:70},foldToBet:{count:aggressive?12:31,opportunities:45},showdowns:[]}]};}
export function sequenceFixtures(seed=0x4b101):SequenceFixture[]{
 const out:SequenceFixture[]=[];
 const limped=begin('limped-sixway',seed,6,100,1,['Ts','9s'],['8h','7d','2c','Qs','3d']);while(limped.state.street==='preflop')act(limped,legalActions(limped.state).check?{type:'check'}:{type:'call'});limped.description='Six legal preflop limps/check, speculative draw in multiway flop.';out.push(limped);
 const srp=singleRaised('single-raised-headsup',seed,['As','Kd'],['Jh','7d','2c','8c','3h']);act(srp,{type:'check'});srp.description='Preflop aggressor checked to with missed AK.';out.push(srp);
 const three=begin('three-bet-headsup',seed,2,100,1,['Qs','Qh'],['Jc','7h','2d','8s','3c']);act(three,{type:'raise',to:600});act(three,{type:'raise',to:1800});act(three,{type:'call'});three.description='Three-bettor QQ first to act after legal3-bet/call.';out.push(three);
 const short=begin('short-stack-allin',seed,2,20,1,['As','Kh'],['Qc','7h','2d','8s','3c']);act(short,{type:'raise',to:4000});short.description='20BB AK faces a genuine full-stack shove.';out.push(short);
 const deep=singleRaised('deep-river-pressure',seed,['Qh','Jc'],['Qs','Jh','Td','2c','3s'],250);act(deep,{type:'check'});act(deep,{type:'raise',to:1500});act(deep,{type:'call'});act(deep,{type:'check'});act(deep,{type:'raise',to:4000});act(deep,{type:'call'});act(deep,{type:'raise',to:18000});deep.description='250BB two-pair hand faces large river lead after bet/call on flop and turn.';out.push(deep);
 const completed=singleRaised('draw-completes-turn',seed,['Ah','Kh'],['Qh','7h','2c','8h','3s']);act(completed,{type:'raise',to:600});act(completed,{type:'call'});act(completed,{type:'check'});completed.description='Called flop draw, nut flush completes on turn and opponent checks.';out.push(completed);
 const missed=singleRaised('missed-draw-river',seed,['Ah','Kh'],['Qh','7h','2c','8d','3s']);act(missed,{type:'check'});act(missed,{type:'raise',to:600});act(missed,{type:'call'});act(missed,{type:'check'});act(missed,{type:'raise',to:1200});act(missed,{type:'call'});act(missed,{type:'check'});missed.description='Flop/turn semi-bluff line misses river; opponent has called twice and checks.';out.push(missed);
 const thin=singleRaised('thin-river-value',seed,['Kd','Jc'],['Ks','8h','2c','3d','9s']);checkTo(thin,'river');act(thin,{type:'check'});thin.description='Top pair/J kicker after checked-through flop/turn.';out.push(thin);
 for(const aggressive of [false,true]){const catchHand=singleRaised(`bluffcatch-${aggressive?'observed-aggressive':'observed-passive'}`,seed,['Qd','Jh'],['Qc','7h','2s','8c','3d']);act(catchHand,{type:'raise',to:400});act(catchHand,{type:'call'});act(catchHand,{type:'raise',to:1000});act(catchHand,{type:'call'});act(catchHand,{type:'raise',to:3000});catchHand.memory=observedStyle(1,aggressive);catchHand.description='Top-pair bluffcatch after three public bets; assumed public60-hand summary differs, not true latent archetype.';out.push(catchHand);}
 const trap=singleRaised('dry-set-trap',seed,['9c','9d'],['9h','7s','2c','3d','Jc']);act(trap,{type:'check'});trap.description='Private set checked to on dry flop, later streets remain live.';out.push(trap);
 const iso=begin('multiple-limper-isolation',seed,6,100,0,['As','Qs'],['Ac','7h','2c','Th','8d']);act(iso,{type:'call'});act(iso,{type:'call'});act(iso,{type:'fold'});iso.description='Button AQs follows two limpers and one fold.';out.push(iso);
 for(const [fraction,own,board]of [[.35,['Kc','Ts'],['Kh','9h','2h','9s','3c']],[.8,['9c','9d'],['Ks','Qd','4c','4h','2s']],[1.8,['As','4s'],['Ah','8h','7h','3c','2d']]] as [number,Card[],Card[]][]){
  const f=singleRaised(`evaluation-river-${fraction}`,seed,own,board,150);checkTo(f,'river');act(f,{type:'raise',to:Math.round(1200*fraction)});f.subset='evaluation';f.description='Reserved paired/monotone texture and nonstandard river price; no human-holdout claim.';out.push(f);
 }
 return out;
}
