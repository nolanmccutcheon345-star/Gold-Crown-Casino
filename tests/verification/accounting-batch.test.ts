import {describe,it} from 'vitest';
import type {Action,GameState} from '../../src/contracts';
import {applyCommand,legalActions,projectView} from '../../src/core/engine';
import {act,practiceProfile,seededHand} from './helpers';

const batch=process.env.RUN_ACCOUNTING_BATCH==='1'?describe:describe.skip;
const assert=(ok:unknown,message:string):void=>{if(!ok)throw new Error(message);};
function invariant(s:GameState,seed:number,step:number):void{
 const context=`seed=${seed} step=${step} ${s.street}`;
 assert(s.seats.reduce((t,p)=>t+p.stack,0)+s.pot+s.rake===s.initialTotal,`Chip conservation ${context}`);
 assert(s.seats.every(p=>Number.isSafeInteger(p.stack)&&p.stack>=0),`Invalid stack ${context}`);
 const dealt=[...s.seats.flatMap(p=>p.hole),...s.burned,...s.board];
 assert(new Set(dealt).size===dealt.length,`Duplicate dealt cards ${context}`);
 assert(s.deckCursor===dealt.length,`Deck cursor mismatch ${context}`);
 const view=projectView(s,0);
 if(s.street!=='complete'){
  assert(view.pots.reduce((t,p)=>t+p.amount,0)+(view.uncalledBet?.amount??0)===s.pot,`Provisional pot decomposition ${context}`);
  assert(s.actor!==null&&s.seats.some(p=>p.id===s.actor&&!p.folded&&!p.allIn),`Invalid actor ${context}`);
 }else{
  assert(s.actor===null&&s.pot===0,`Settlement pending ${context}`);
  assert(s.events.filter(e=>e.type==='rake').length<2,`Double rake ${context}`);
 }
}
batch('Explicit 10,000-hand-per-profile accounting batch (not 20,000 acceptance tests)',()=>{
 for(const rakeOn of [false,true])it(`${rakeOn?'rake-on':'rake-free'} — 10,000 seeded mixed-stack 2–10-seat hands`,()=>{
  const hands=10000,firstSeed=rakeOn?710000:610000;let actions=0,showdowns=0,rakeTaken=0;
  const profile=practiceProfile();if(rakeOn)profile.rake={basisPoints:500,cap:500,noFlopNoDrop:true};
  for(let index=0;index<hands;index++){
   const seed=firstSeed+index;let cursor=seed;
   const draw=()=>{cursor^=cursor<<13;cursor^=cursor>>>17;cursor^=cursor<<5;return cursor>>>0;};
   const count=2+draw()%9;const stacks=Array.from({length:count},()=>200+draw()%29801);
   let s=seededHand(stacks,seed,profile);let steps=0;invariant(s,seed,steps);
   while(s.street!=='complete'){
    const legal=legalActions(s),choice=draw()%10;let action:Action=legal.check?{type:'check'}:{type:'call'};
    if(choice<2&&legal.fold)action={type:'fold'};
    else if(choice<4&&legal.canRaise)action={type:'raise',to:legal.shortAllInTo??legal.minRaiseTo!};
    else if(choice===4&&legal.canRaise)action={type:'raise',to:legal.maxRaiseTo!};
    const before=s;const command={handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`fixture-${s.revision}`,action};
    s=act(s,action);steps++;actions++;assert(steps<2000,`Hand did not terminate seed=${seed}`);invariant(s,seed,steps);
    assert(before.revision+1===s.revision,`Invalid revision seed=${seed}`);
    assert(applyCommand(s,command)===s,`Duplicate action changed state seed=${seed}`);
   }
   if(s.revealedSeats.length)showdowns++;rakeTaken+=s.rake;
   assert(new Set(s.events.map(e=>e.id)).size===s.events.length,`Duplicate events seed=${seed}`);
   assert(s.pots.every(p=>p.winners.every(w=>p.eligible.includes(w))),`Ineligible winner seed=${seed}`);
   if(!rakeOn||s.board.length<3)assert(s.rake===0,`Unexpected rake seed=${seed}`);
   else assert(s.rake<=500,`Rake exceeded cap seed=${seed}`);
  }
  console.log(JSON.stringify({kind:'accounting-batch',status:'PASS',hands,firstSeed,lastSeed:firstSeed+hands-1,profile:rakeOn?'practice-5pct-cap500':'practice-zero-rake',actions,showdowns,rakeTaken}));
 },180000);
});
