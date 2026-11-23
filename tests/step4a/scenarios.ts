import type { Action, Card, GameState } from '../../src/contracts';
import { applyCommand, legalActions, startHand } from '../../src/core/engine';
import { rig, practiceProfile } from '../verification/helpers';

export interface Scenario {id:string;label:string;notes:string;state:GameState;}
export function seededRandom(seed:number):()=>number{
 // Avalanche adjacent scenario seeds before xorshift. A raw adjacent seed
 // would correlate the first policy draw with hand/seat order.
 let n=seed>>>0;n^=n>>>16;n=Math.imul(n,0x7feb352d);n^=n>>>15;n=Math.imul(n,0x846ca68b);n^=n>>>16;n=(n>>>0)||0x6d2b79f5;
 return()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return(n>>>0)/4294967296;};
}
export function archetypeAssignment(hand:number,seats:number):number[]{
 const identities=Array.from({length:seats},(_,seat)=>(hand+seat)%8);const random=seededRandom(0xa5519+hand+seats*100000);
 for(let i=identities.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[identities[i],identities[j]]=[identities[j],identities[i]];}
 return identities;
}
export function step(state:GameState,action:Action):GameState{
 if(state.actor===null)throw new Error('Scenario already ended');
 return applyCommand(state,{handId:state.handId,revision:state.revision,seatId:state.actor,decisionId:`fixture:${state.handId}:${state.revision}`,action});
}
function setup(id:string,count:number,target:number,own:Card[],board:Card[],stack=20000):GameState{
 const reserved=[...own,...board];if(new Set(reserved).size!==reserved.length)throw new Error('Bad scenario cards');
 const remaining=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(c=>!reserved.includes(c));
 const holes=Array.from({length:count},(_,seat)=>seat===target?own:remaining.splice(0,2));
 return rig(startHand({handId:`step4a:${id}`,seats:Array.from({length:count},(_,seat)=>({id:seat,name:`Player ${seat}`,stack})),button:0,profile:practiceProfile()}),holes,board);
}
function callsToFlop(state:GameState):GameState{
 let s=state;for(let n=0;s.street==='preflop'&&n<30;n++)s=step(s,legalActions(s).check?{type:'check'}:{type:'call'});
 if(s.street!=='flop')throw new Error('Scenario failed to reach flop');return s;
}
function unopened(id:string,own:Card[],late=false):GameState{
 let s=setup(id,6,late?0:3,own,['2c','6h','Qd','8s','3c']);
 if(late)for(let n=0;s.actor!==0&&n<6;n++)s=step(s,{type:'fold'});return s;
}
function facingOpen(id:string,own:Card[],stack=20000):GameState{
 let s=setup(id,6,4,own,['2c','6h','Qd','8s','3c'],stack);s=step(s,{type:'raise',to:600});return s;
}
function facingThreeBet(id:string,own:Card[]):GameState{
 let s=setup(id,6,3,own,['2c','6h','Qd','8s','3c']);s=step(s,{type:'raise',to:600});s=step(s,{type:'raise',to:1800});
 for(let n=0;s.actor!==3&&n<6;n++)s=step(s,{type:'fold'});return s;
}
function postflop(id:string,own:Card[],board:Card[],street:'flop'|'turn'|'river',bet:number,initiative=true,stack=20000):GameState{
 let s=setup(id,2,0,own,board,stack);
 if(initiative){s=step(s,{type:'raise',to:1000});s=step(s,{type:'call'});}
 else{s=step(s,{type:'call'});s=step(s,{type:'raise',to:1000});s=step(s,{type:'call'});}
 for(let n=0;s.street!==street&&n<8;n++)s=step(s,{type:'check'});
 if(s.street!==street||s.actor!==1)throw new Error('Postflop scenario order mismatch');
 return step(s,bet?{type:'raise',to:bet}:{type:'check'});
}
function multiway(id:string,count:number,own:Card[],bet:boolean):GameState{
 let s=callsToFlop(setup(id,count,1,own,['Ah','Kd','2s','7c','3d']));
 if(!bet)return s;
 for(let n=0;s.actor!==0&&n<count;n++)s=step(s,{type:'check'});
 return step(s,{type:'raise',to:Math.max(200,s.pot/2)});
}
export function scenarios():Scenario[]{
 const list:Scenario[]=[];const add=(id:string,label:string,state:GameState,notes='')=>list.push({id,label,state,notes});
 add('early-jto','JTo unopened early',unopened('early-jto',['Jh','Tc']));
 add('button-jto','JTo unopened button',unopened('button-jto',['Jh','Tc'],true),'Earlier players folded: position and remaining field size change together.');
 add('unopened-97s','97s unopened',unopened('unopened-97s',['9h','7h']));
 let limp=setup('limped-97s',6,4,['9h','7h'],['2c','6h','Qd','8s','3c']);limp=step(limp,{type:'call'});
 add('limped-97s','97s after one limp',limp);
 add('open-kjs','KJs faces 3BB open',facingOpen('open-kjs',['Kh','Jh']));
 add('threebet-kjs','KJs opener faces 9BB re-raise',facingThreeBet('threebet-kjs',['Kh','Jh']),'The opener has already invested3BB; opponents behind folded.');
 add('unopened-aa','AA unopened control',unopened('unopened-aa',['As','Ah']));
 add('threebet-aa','AA opener faces 9BB re-raise',facingThreeBet('threebet-aa',['As','Ah']));
 add('short-97s','97s faces open with20BB',facingOpen('short-97s',['9h','7h'],4000));
 add('deep-97s','97s faces open with200BB',facingOpen('deep-97s',['9h','7h'],40000));
 const marginal=['Qc','7h','2s','8c','3d'];const draw=['Qh','7h','2c','8d','3s'];const air=['Jh','7d','2c','8c','3h'];
 add('flop-marginal-cheap','Top pair faces10%-pot flop bet',postflop('flop-marginal-cheap',['Qd','Jc'],marginal,'flop',200));
 add('flop-marginal-overbet','Top pair faces200%-pot flop bet',postflop('flop-marginal-overbet',['Qd','Jc'],marginal,'flop',4000));
 add('flop-flushdraw','Nut flush draw faces half-pot',postflop('flop-flushdraw',['Ah','Kh'],draw,'flop',1000));
 add('flop-dry-acehigh','Ace-high without flush draw faces half-pot',postflop('flop-dry-acehigh',['As','Kd'],draw,'flop',1000));
 add('river-missed-flush','Missed nut flush draw faces half-pot river bet',postflop('river-missed-flush',['Ah','Kh'],draw,'river',1000));
 add('river-dry-acehigh','Ace-high dry hand faces half-pot river bet',postflop('river-dry-acehigh',['As','Kd'],draw,'river',1000));
 add('flop-cbet-air','Missed AK, preflop aggressor checked to',postflop('flop-cbet-air',['As','Kd'],air,'flop',0,true));
 add('flop-noinitiative-air','Missed AK, preflop caller checked to',postflop('flop-noinitiative-air',['As','Kd'],air,'flop',0,false));
 add('turn-delayed-cbet','Missed AK, checked-back flop, turn checked to',postflop('turn-delayed-cbet',['As','Kd'],air,'turn',0,true));
 add('turn-noinitiative','Missed AK caller, checked-through flop and turn',postflop('turn-noinitiative',['As','Kd'],air,'turn',0,false));
 add('river-nuts','Royal flush faces a river overbet',postflop('river-nuts',['As','Ks'],['Qs','Js','Ts','2d','3c'],'river',4000));
 add('river-marginal-halfpot','Top pair faces half-pot river bet',postflop('river-marginal-halfpot',['Qd','Jc'],marginal,'river',1000));
 add('river-marginal-overbet','Top pair faces two-pot river bet',postflop('river-marginal-overbet',['Qd','Jc'],marginal,'river',4000));
 add('heads-up-air','Heads-up air first to act on flop',multiway('heads-up-air',2,['9d','8c'],false));
 add('sixway-air','Six-way air first to act on flop',multiway('sixway-air',6,['9d','8c'],false),'Pot, SPR and field size change; these are full-context contrasts.');
 add('heads-up-checkraise','Heads-up air checked, faces half-pot',multiway('heads-up-checkraise',2,['9d','8c'],true));
 add('sixway-checkraise','Six-way air checked, faces half-pot',multiway('sixway-checkraise',6,['9d','8c'],true),'Pot-fraction price matched; SPR and field size differ.');
 add('turn-cheap-forced-flushdraw','Nut flush draw faces cheap all-in with no future cost',postflop('turn-cheap-forced-flushdraw',['Ah','Kh'],['Qh','7h','2c','3d','8s'],'turn',200,true,1200),'Call200 for final2400. Conservative independent winning-river bound applies; no full decision-EV claim.');
 add('river-dirty-flush','Low private heart on four-heart board faces overbet',postflop('river-dirty-flush',['4h','7d'],['Ah','Kh','8h','3h','2c'],'river',4000));
 add('river-nut-flush','Nut private heart on same four-heart board faces overbet',postflop('river-nut-flush',['Qh','7d'],['Ah','Kh','8h','3h','2c'],'river',4000));
 add('river-shared-fullhouse','Shared board full house with low private cards',postflop('river-shared-fullhouse',['2c','3d'],['As','Ah','Ad','Kc','Kd'],'river',4000));
 add('river-private-quads','Private ace makes quads on same shared full-house board',postflop('river-private-quads',['Ac','2d'],['As','Ah','Ad','Kc','Kd'],'river',4000));
 return list;
}

export function seededEngineHand(count:number,seed:number):GameState{
 const random=seededRandom(seed^0xd3c4a5);const deck=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s));
 for(let i=deck.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
 const holes=Array.from({length:count},(_,n)=>deck.slice(n*2,n*2+2));const board=deck.slice(count*2,count*2+5);
 const profile=practiceProfile();if(seed%2===0)profile.rake={basisPoints:500,cap:300,noFlopNoDrop:true};
 const stacks=[4000,10000,20000,40000];
 const button=Math.floor(seededRandom(seed^0xb0770)()*count);
 return rig(startHand({handId:`step4a-sim:${count}:${seed}`,seats:Array.from({length:count},(_,id)=>({id,name:`Seat ${id}`,stack:stacks[(seed+id)%stacks.length]})),button,profile}),holes,board);
}
