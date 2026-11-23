import type {Archetype,BotProfile,GameState,OpponentConfig,PopulationPreset,PublicMemoryHand} from '../../src/contracts';
import {createProfile,POLICY_VERSION} from '../../src/bots/policy';
import {nextHand,startHand,topUpTable,assertAccounting} from '../../src/core/engine';
import {rig,practiceProfile} from '../verification/helpers';
import {runHand} from '../step4c/population';
import {clusteredRate,rng,type Counters,DEFINITIONS} from '../step4c/audit';

/** Pre-registered synthetic configurations. Stakes never select skill. */
export const CONFIGURATIONS:{id:string;blinds:[number,number];environment:PopulationPreset;lineup:Archetype[];skills:number[]}[]=[
 {id:'loose-passive-1-2',blinds:[100,200],environment:'low',lineup:['station','passive-reg','station','nit','fit-or-fold','stronger-reg'],skills:[.2,.3,.3,.5,.35,.9]},
 {id:'recreational-1-3',blinds:[100,300],environment:'low',lineup:['passive-reg','station','maniac','passive-reg','tag','fit-or-fold'],skills:[.3,.25,.25,.4,.8,.3]},
 {id:'mixed-2-5',blinds:[200,500],environment:'mid',lineup:['tag','station','stronger-reg','nit','lag','passive-reg'],skills:[.7,.2,.85,.55,.65,.35]},
 {id:'aggressive-5-10',blinds:[500,1000],environment:'high',lineup:['lag','tag','stronger-reg','maniac','lag','station'],skills:[.8,.75,.9,.3,.7,.25]},
 {id:'tough-six-max',blinds:[200,500],environment:'high',lineup:['stronger-reg','tag','lag','stronger-reg','tag','lag'],skills:[.9,.85,.8,.95,.8,.85]},
 {id:'heads-up',blinds:[100,200],environment:'neutral',lineup:['stronger-reg','lag'],skills:[.85,.75]},
 {id:'nine-handed',blinds:[100,200],environment:'mid',lineup:['station','nit','stronger-reg','passive-reg','tag','station','lag','fit-or-fold','maniac'],skills:[.2,.5,.9,.3,.75,.35,.7,.4,.25]},
 {id:'ten-handed',blinds:[100,300],environment:'mid',lineup:['station','nit','stronger-reg','passive-reg','tag','station','lag','fit-or-fold','maniac','stronger-reg'],skills:[.2,.5,.9,.3,.75,.35,.7,.4,.25,.85]},
];
export const PLAN={version:'step5a-continuous-session-v1',blocksPerConfiguration:8,handsPerBlock:25,startingBB:100,refillBelowBB:40,refillToBB:100,externalWalletBB:10000,seed:0x5a710000,
 notes:'Eight fixed lineups; eight independent deck/personality blocks each. Within each block chips, identities, public memory and dealer advance persist across 25 hands. Between-hand top-ups use the authoritative engine and a separate debited simulation wallet; they are not poker profit or a claim that opponent rebuy controls exist in the UI. No profiles or frequencies fitted to these samples.'};
function add(target:Counters,source:Counters){for(const [key,c]of Object.entries(source)){target[key]??={count:0,opportunities:0};target[key].count+=c.count;target[key].opportunities+=c.opportunities;}}
function deal(game:GameState,seed:number){const random=rng(seed^0x7137ab11),deck=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s));for(let i=deck.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}return rig(game,game.seats.map((_,i)=>deck.slice(i*2,i*2+2)),deck.slice(game.seats.length*2,game.seats.length*2+5));}
function memory(g:GameState):PublicMemoryHand{return{handId:g.handId,seats:g.seats.map(s=>({id:s.id,revealedCards:g.revealedSeats.includes(s.id)?s.hole:[]})),events:g.events};}
export function sessionBlock(configIndex:number,block:number,hands=PLAN.handsPerBlock){
 const config=CONFIGURATIONS[configIndex],bb=config.blinds[1],count=config.lineup.length,seed=PLAN.seed+configIndex*100000+block*1000;
 const profiles:BotProfile[]=config.lineup.map((selection,i)=>{const c:OpponentConfig={selection,skill:config.skills[i]};return createProfile(c,seed^Math.imul(i+1,0x9143),'neutral');});
 // Profile selection and skill are explicit; population is metadata, not a stake
 // inference. Fixed styles retain their own designed profile at every stake.
 for(const p of profiles)p.environment=config.environment;
 const profile=practiceProfile();profile.smallBlind=config.blinds[0];profile.bigBlind=bb;profile.rake={basisPoints:500,cap:bb*2,noFlopNoDrop:true};
 const initialTable=count*PLAN.startingBB*bb,initialWallet=count*PLAN.externalWalletBB*bb;
 let wallet=initialWallet,game=startHand({handId:`5a:${config.id}:${block}:0`,button:block%count,profile,seats:profiles.map((_,id)=>({id,name:`Stable ${id}`,stack:PLAN.startingBB*bb}))}),rake=0;
 const out={configuration:config.id,block,seed,policyVersion:POLICY_VERSION,profiles,metrics:{} as Counters,archetypes:{} as Record<string,Counters>,transfers:[] as {id:string;afterHand:number;seatId:number;amount:number;walletAfter:number}[],hands:[] as ReturnType<typeof runHand>['record'][],times:[] as number[],flopHands:0,multiwayFlopHands:0,sidePotHands:0,initialTable,initialWallet,endingTable:0,endingWallet:0,rake:0};
 const history:PublicMemoryHand[]=[];const stable=JSON.stringify(profiles);
 for(let hand=0;hand<hands;hand++){
  game=deal(game,seed+hand);const result=runHand(game,profiles,seed+hand,history);game=result.game;
  if(game.street!=='complete')throw Error('Stalled simulation hand');if(JSON.stringify(profiles)!==stable)throw Error('Profile mutation');
  history.push(memory(game));out.hands.push(result.record);out.times.push(...result.times);rake+=game.rake;
  for(const [id,m]of result.metrics){add(out.metrics,m);out.archetypes[profiles[id].archetype]??={};add(out.archetypes[profiles[id].archetype],m);}
  if(game.board.length>=3){out.flopHands++;const event=game.events.find(e=>e.type==='street'&&e.street==='flop')!;const folded=new Set(game.events.filter(e=>e.type==='action'&&e.action?.type==='fold'&&e.revision<event.revision).map(e=>e.seatId));if(count-folded.size>=3)out.multiwayFlopHands++;}
  if(game.pots.length>1)out.sidePotHands++;
  // Immutable completed records are captured before transfers. Simulation funds
  // are explicit debits; the engine remains the only writer of table chips.
  if(hand<hands-1){for(const seat of game.seats)if(seat.stack<PLAN.refillBelowBB*bb){
   const amount=PLAN.refillToBB*bb-seat.stack,id=`5a-transfer:${config.id}:${block}:${hand}:${seat.id}`;
   if(wallet<amount)throw Error('Simulation wallet exhausted');game=topUpTable(game,seat.id,amount,id,PLAN.refillToBB*bb);wallet-=amount;out.transfers.push({id,afterHand:hand,seatId:seat.id,amount,walletAfter:wallet});
  }}
  assertAccounting(game);const table=game.seats.reduce((n,s)=>n+s.stack,0);
  if(wallet+table+rake!==initialWallet+initialTable)throw Error('Continuous-session wallet/table/rake conservation failed');
  if(hand<hands-1)game=nextHand(game,`5a:${config.id}:${block}:${hand+1}`);
 }
 out.endingTable=game.seats.reduce((n,s)=>n+s.stack,0);out.endingWallet=wallet;out.rake=rake;return out;
}
export function summarize(blocks:ReturnType<typeof sessionBlock>[]){
 return{policyVersion:POLICY_VERSION,plan:PLAN,definitions:DEFINITIONS,blocks:blocks.length,hands:blocks.reduce((n,b)=>n+b.hands.length,0),actions:blocks.reduce((n,b)=>n+b.hands.reduce((s,h)=>s+h.money.actions,0),0),configurations:CONFIGURATIONS.map(config=>{
  const rows=blocks.filter(b=>b.configuration===config.id),times=rows.flatMap(b=>b.times).sort((a,b)=>a-b),metrics=[...new Set(rows.flatMap(b=>Object.keys(b.metrics)))];
  return{...config,blocks:rows.length,hands:rows.reduce((n,b)=>n+b.hands.length,0),flopHands:rows.reduce((n,b)=>n+b.flopHands,0),multiwayFlopHands:rows.reduce((n,b)=>n+b.multiwayFlopHands,0),sidePotHands:rows.reduce((n,b)=>n+b.sidePotHands,0),topupEvents:rows.reduce((n,b)=>n+b.transfers.length,0),rakeCents:rows.reduce((n,b)=>n+b.rake,0),rates:Object.fromEntries(metrics.map(m=>[m,clusteredRate(rows.map(b=>b.metrics[m]??{count:0,opportunities:0}))])),decisionComputeMs:{n:times.length,p50:times[Math.floor(times.length*.5)]??null,p95:times[Math.floor(times.length*.95)]??null,max:times.at(-1)??null}};
 }),limitations:'Synthetic controlled sessions; no human calibration, expert review, solver guarantee or real-money prediction. Session dependence handled descriptively by whole-block bootstrap. Rare river/draw/overbet cells may be too sparse. Timing measures engine-side decision compute, not device UI latency. Explicit simulation top-ups are not UI bot rebuy functionality.'};
}
