import {describe,expect,it} from 'vitest';
import type {Action,GameState,RuleProfile} from '../../src/contracts';
import {applyCommand,legalActions,nextHand,projectView,startHand} from '../../src/core/engine';
import {evaluate} from '../../src/core/evaluator';
import {act,checkDown,hand,lexCompare,practiceProfile,rig,seededHand} from './helpers';

const centsProfile=():RuleProfile=>({...practiceProfile(),smallBlind:1,bigBlind:2});
function flop(stacks:number[]):GameState {
 let s=hand(stacks,0,centsProfile());
 for(let count=0;s.street==='preflop'&&count<20;count++)s=act(s,legalActions(s).check?{type:'check'}:{type:'call'});
 expect(s.street).toBe('flop');return s;
}
function exactFourWay():GameState {
 let s=rig(hand([50,120,300,300],0,centsProfile()),[['As','Ad'],['Ks','Kd'],['Qs','Qd'],['Jh','Jd']],['2c','4h','7s','9d','Tc']);
 s=act(s,{type:'call'});s=act(s,{type:'raise',to:50});s=act(s,{type:'raise',to:120});
 s=act(s,{type:'raise',to:300});return act(s,{type:'call'});
}

describe('Step 2 exact cash acceptance scenarios; mapping requires integration review',()=>{
 it('A01 — New hand, 10 active seats',()=>{
  let s=seededHand(Array(10).fill(20000),3020101);
  expect(s.seats.flatMap(x=>x.hole)).toHaveLength(20);
  const seenStreets:string[]=[];
  while(s.street!=='complete'){
   const dealt=[...s.seats.flatMap(x=>x.hole),...s.board,...s.burned];
   expect(new Set(dealt).size).toBe(dealt.length);expect(new Set(s.deck).size).toBe(52);
   expect(s.deckCursor).toBe(dealt.length);expect(s.board.length).toBeLessThanOrEqual(5);
   seenStreets.push(s.street);s=act(s,legalActions(s).check?{type:'check'}:{type:'call'});
  }
  expect(new Set(seenStreets)).toEqual(new Set(['preflop','flop','turn','river']));
  expect(s.board).toHaveLength(5);expect(s.burned).toHaveLength(3);expect(s.deckCursor).toBe(28);
  expect(new Set([...s.seats.flatMap(x=>x.hole),...s.board,...s.burned]).size).toBe(28);
 });
 it('A03 — Tests with same deterministic seed and same actions',()=>{
  const first=seededHand([15000,6000,30000,22000,9000,25000],30303);
  let a=first;let b=seededHand([15000,6000,30000,22000,9000,25000],30303);
  expect(a).toEqual(b);const commands:Action[]=[];
  while(a.street!=='complete'){
   const legal=legalActions(a);
   const action:Action=commands.length%7===0&&legal.canRaise?{type:'raise',to:legal.shortAllInTo??legal.minRaiseTo!}:legal.check?{type:'check'}:{type:'call'};
   commands.push(action);a=act(a,action);b=act(b,action);expect(a).toEqual(b);
  }
  expect(commands.length).toBeGreaterThan(5);expect(a.payouts).toEqual(b.payouts);expect(a.deck).toEqual(first.deck);
 });
 it('A06 — Four cards of one suit on board plus qualifying own suit',()=>{
  const board=['Ac','9c','7c','2c','Kd'];
  expect(evaluate(['Qc','3h',...board])).toEqual([5,14,12,9,7,2]);
  expect(lexCompare(evaluate(['Qc','3h',...board]),evaluate(['Ah','Ad',...board]))).toBe(1);
  let s=rig(hand([100,100],0,centsProfile()),[['Qc','3h'],['Ah','Ad']],board);
  s=act(s,{type:'raise',to:100});s=act(s,{type:'call'});
  expect(s.payouts).toEqual({0:200});expect(s.seats.map(x=>x.stack)).toEqual([200,0]);
 });
 it('A07 — Same top pair but different kicker',()=>{
  const board=['Ad','9c','7h','4d','2s'];
  let s=rig(hand([100,100],0,centsProfile()),[['As','Kh'],['Ah','Qd']],board);
  s=act(s,{type:'raise',to:100});s=act(s,{type:'call'});
  expect(s.payouts).toEqual({0:200});expect(s.pots[0].winners).toEqual([0]);
 });
 it('A08 — Board makes best five-card hand for two players',()=>{
  let s=rig(hand([100,100,100],0,centsProfile()),[['2c','3d'],['4c','5d'],['6c','7d']],['As','Ks','Qs','Js','Ts']);
  s=act(s,{type:'call'});s=act(s,{type:'fold'});s=checkDown(s);
  expect(s.pots).toEqual([{amount:5,eligible:[0,2],winners:[0,2]}]);
  expect(s.payouts).toEqual({0:2,2:3});expect(s.seats.map(x=>x.stack)).toEqual([100,99,101]);
 });
 it('B03 — Several physical seats empty',()=>{
  const s=startHand({handId:'sparse',button:5,profile:centsProfile(),seats:[{id:8,name:'C',stack:100},{id:1,name:'A',stack:100},{id:5,name:'B',stack:100}]});
  expect(s.seats.map(x=>x.id)).toEqual([1,5,8]);expect([s.button,s.smallBlindSeat,s.bigBlindSeat,s.actor]).toEqual([5,8,1,5]);
  const n=nextHand(checkDown(s),'sparse-next');expect([n.button,n.smallBlindSeat,n.bigBlindSeat,n.actor]).toEqual([8,1,5,8]);
 });
 it('B04 — Big blind offered option after limpers/calls',()=>{
  let s=hand([100,100],0,centsProfile());s=act(s,{type:'call'});
  expect([s.street,s.actor]).toEqual(['preflop',1]);expect(legalActions(s).check).toBe(true);expect(legalActions(s).minRaiseTo).toBe(4);
  const raised=act(s,{type:'raise',to:4});expect([raised.street,raised.actor]).toEqual(['preflop',0]);
  s=act(s,{type:'check'});expect([s.street,s.actor]).toEqual(['flop',1]);
  let multi=hand([100,100,100],0,centsProfile());multi=act(multi,{type:'call'});multi=act(multi,{type:'call'});
  expect(multi.actor).toBe(2);expect(legalActions(multi)).toMatchObject({check:true,canRaise:true,minRaiseTo:4});
 });
 it('B05 — Bet 100 → opponent raises to 260',()=>{
  let s=flop([1000,1000]);s=act(s,{type:'raise',to:100});s=act(s,{type:'raise',to:260});
  expect(s.minFullRaiseIncrement).toBe(160);expect(legalActions(s).minRaiseTo).toBe(420);
  expect(()=>act(s,{type:'raise',to:419})).toThrow();expect(act(s,{type:'raise',to:420}).currentBet).toBe(420);
 });
 it('B06 — A bet 100 → B short all-in 150',()=>{
  let s=flop([1000,1000,152]);s=act(s,{type:'raise',to:100});s=act(s,{type:'raise',to:150});
  const justCalled=act(s,{type:'call'});expect(justCalled.actor).toBe(1);expect(legalActions(justCalled).canRaise).toBe(false);
  expect(()=>act(justCalled,{type:'raise',to:250})).toThrow();
  const fullRaise=act(s,{type:'raise',to:250});expect(fullRaise.actor).toBe(1);expect(legalActions(fullRaise)).toMatchObject({canRaise:true,minRaiseTo:350});
 });
 it('B07 — A bet 100 → B all-in 140 → C all-in 180',()=>{
  let s=flop([1000,1000,142,182]);s=act(s,{type:'raise',to:100});s=act(s,{type:'raise',to:140});s=act(s,{type:'raise',to:180});s=act(s,{type:'call'});
  expect(s.actor).toBe(1);expect(legalActions(s).reopened).toBe(false);expect(legalActions(s).canRaise).toBe(false);
  expect(()=>act(s,{type:'raise',to:280})).toThrow();
 });
 it('B08 — A bet 100 → B all-in 150 → C all-in 200',()=>{
  let s=flop([1000,1000,152,202]);s=act(s,{type:'raise',to:100});s=act(s,{type:'raise',to:150});s=act(s,{type:'raise',to:200});s=act(s,{type:'call'});
  expect(s.actor).toBe(1);expect(legalActions(s)).toMatchObject({reopened:true,canRaise:true,minRaiseTo:300});
  expect(act(s,{type:'raise',to:300}).currentBet).toBe(300);
 });
 it('B09 — Hero owes 20 and has 13 remaining',()=>{
  let s=rig(hand([15,100,100],0,centsProfile()),[['As','Ad'],['Ks','Kd'],['Qs','Qd']],['2c','4h','7s','9d','Jc']);
  s=act(s,{type:'call'});s=act(s,{type:'call'});s=act(s,{type:'check'});s=act(s,{type:'raise',to:20});s=act(s,{type:'call'});
  expect(s.actor).toBe(0);expect(s.seats[0].stack).toBe(13);expect(s.currentBet-s.seats[0].streetCommitted).toBe(20);expect(legalActions(s).callAmount).toBe(13);
  s=act(s,{type:'call'});expect(s.seats[0]).toMatchObject({stack:0,allIn:true,totalCommitted:15});s=checkDown(s);
  expect(s.pots.map(p=>({amount:p.amount,eligible:p.eligible,winners:p.winners}))).toEqual([{amount:45,eligible:[0,1,2],winners:[0]},{amount:14,eligible:[1,2],winners:[1]}]);
  expect(s.seats.map(x=>x.stack)).toEqual([45,92,78]);
 });
 it('B14 — End of street',()=>{
  let s=hand([100,100,100],0,centsProfile());s=act(s,{type:'call'});s=act(s,{type:'call'});expect(s.street).toBe('preflop');
  const cmd={handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:'B14-final-preflop',action:{type:'check'} as Action};
  s=applyCommand(s,cmd);expect([s.street,s.actor,s.currentBet]).toEqual(['flop',1,0]);expect(s.seats.map(x=>x.streetCommitted)).toEqual([0,0,0]);
  expect(s.events.filter(e=>e.type==='street'&&e.street==='flop')).toHaveLength(1);expect(applyCommand(s,cmd)).toEqual(s);
  s=act(s,{type:'raise',to:10});s=act(s,{type:'call'});expect(s.street).toBe('flop');s=act(s,{type:'call'});
  expect([s.street,s.actor,s.currentBet]).toEqual(['turn',1,0]);expect(s.seats.map(x=>x.streetCommitted)).toEqual([0,0,0]);
  expect(s.events.filter(e=>e.type==='street'&&e.street==='turn')).toHaveLength(1);
 });
 it('B17 — No-limit raise sequence',()=>{
  let s=hand([100,100],0,centsProfile());
  for(let i=0;i<30;i++){const legal=legalActions(s);expect(legal.canRaise).toBe(true);s=act(s,{type:'raise',to:legal.minRaiseTo!});}
  expect(s.events.filter(e=>e.type==='action'&&e.action?.type==='raise')).toHaveLength(30);
  s=act(s,{type:'raise',to:legalActions(s).maxRaiseTo!});expect(legalActions(s).canRaise).toBe(false);s=act(s,{type:'call'});
  expect(s.street).toBe('complete');expect(s.seats.reduce((t,x)=>t+x.stack,0)).toBe(200);
 });
 it('B18 — Invalid inputs NaN, negatives, fractions below chip unit, huge amounts',()=>{
  const s=hand([100,100],0,centsProfile());const before=structuredClone(s);
  for(const to of [NaN,-1,0.01,4.5,Infinity,-Infinity,Number.MAX_SAFE_INTEGER,1e100]){
   expect(()=>act(s,{type:'raise',to})).toThrow();expect(s).toEqual(before);
  }
 });
 it('C01 — Four active players all-in for 50, 120, 300, 300',()=>{
  const s=exactFourWay();expect(s.street).toBe('complete');
  expect(s.pots.map(({amount,eligible})=>({amount,eligible}))).toEqual([{amount:200,eligible:[0,1,2,3]},{amount:210,eligible:[1,2,3]},{amount:360,eligible:[2,3]}]);
  expect(s.rake).toBe(0);expect(s.events.some(e=>e.type==='refund')).toBe(false);
 });
 it('C02 — One all-in player loses main, wins separate side?',()=>{
  const s=exactFourWay();expect(s.pots.map(p=>p.winners)).toEqual([[0],[1],[2]]);
  expect(s.payouts).toEqual({0:200,1:210,2:360});expect(s.seats.map(x=>x.stack)).toEqual([200,210,360,0]);
  for(const p of s.pots)expect(p.winners.every(w=>p.eligible.includes(w))).toBe(true);
 });
 it('C03 — Player folds after putting chips in',()=>{
  let s=hand([100,100,100],0,centsProfile());s=act(s,{type:'raise',to:10});s=act(s,{type:'call'});s=act(s,{type:'fold'});
  s=act(s,{type:'raise',to:10});s=act(s,{type:'fold'});
  expect(s.seats.map(x=>x.stack)).toEqual([90,112,98]);expect(s.pots.map(p=>p.amount)).toEqual([22]);
  expect(s.events.filter(e=>e.type==='refund').every(e=>e.seatId===1)).toBe(true);expect(s.payouts).toEqual({1:22});
 });
 it('C04 — Uncalled excess raise',()=>{
  const p=centsProfile();p.rake={basisPoints:500,cap:500,noFlopNoDrop:true};
  let s=rig(hand([30000,10000],0,p),[['As','Ad'],['Ks','Kd']],['2c','4h','7s','9d','Jc']);
  s=act(s,{type:'raise',to:30000});const active=projectView(s,0);
  expect(active.uncalledBet).toEqual({seatId:0,amount:29998});expect(active.pots.reduce((t,p)=>t+p.amount,0)+active.uncalledBet!.amount).toBe(s.pot);
  s=act(s,{type:'call'});expect(s.events.find(e=>e.type==='refund')).toMatchObject({seatId:0,amount:20000});
  expect(s.events.findIndex(e=>e.type==='refund')).toBeLessThan(s.events.findIndex(e=>e.type==='rake'));
  expect(s.rake).toBe(500);expect(s.pots[0].amount).toBe(19500);expect(s.seats.map(x=>x.stack)).toEqual([39500,0]);
 });
 it('C09 — Rake 5% capped $5 on postflop $200 pot',()=>{
  const p=centsProfile();p.rake={basisPoints:500,cap:500,noFlopNoDrop:true};
  let s=rig(hand([10000,10000],0,p),[['As','Ad'],['Ks','Kd']],['2c','4h','7s','9d','Jc']);
  s=act(s,{type:'call'});s=act(s,{type:'check'});expect(s.street).toBe('flop');s=act(s,{type:'raise',to:9998});s=act(s,{type:'call'});
  expect(s.initialTotal).toBe(20000);expect(s.rake).toBe(500);expect(s.pots.map(p=>p.amount)).toEqual([19500]);
  expect(s.events.filter(e=>e.type==='rake')).toHaveLength(1);expect(s.seats.reduce((t,x)=>t+x.stack,0)+s.rake).toBe(20000);
 });
 it('D03 — Heads-up button position on rotating deals',()=>{
  let s=hand([20000,20000],0,centsProfile());const buttons:number[]=[];
  for(let i=0;i<20;i++){
   buttons.push(s.button);expect([s.button,s.smallBlindSeat,s.bigBlindSeat,s.actor]).toEqual([i%2,i%2,1-i%2,i%2]);
   s=act(s,{type:'call'});s=act(s,{type:'check'});expect(s.actor).toBe(1-i%2);s=checkDown(s);
   if(i<19){const stacks=s.seats.map(p=>p.stack);s=nextHand(s,`D03-${i+1}`);expect(s.seats.map(p=>p.startingStack)).toEqual(stacks);}
  }
  expect(buttons).toHaveLength(20);expect(new Set(buttons).size).toBe(2);expect(s.initialTotal).toBe(40000);
 });
 it('practice-profile nine-funded-seat to heads-up transition preserves funded chips and avoids repeat BB',()=>{
  const holes=[['As','Ah'],['Kd','Kh'],['Qd','Qh'],['Td','Th'],['Ac','Ad'],['8d','8h'],['6d','6h'],['5d','5h'],['4d','4h']];
  let s=rig(hand(Array(9).fill(10),0,centsProfile()),holes,['2c','3d','7h','9s','Jc']);
  while(s.street!=='complete'){const legal=legalActions(s);s=act(s,legal.canRaise?{type:'raise',to:legal.maxRaiseTo!}:legal.check?{type:'check'}:{type:'call'});}
  expect(s.seats.filter(p=>p.stack>0).map(p=>p.id)).toEqual([0,4]);
  const n=nextHand(s,'HU-transition');expect([n.button,n.smallBlindSeat,n.bigBlindSeat,n.actor]).toEqual([0,0,4,0]);
  expect(n.seats.map(p=>p.startingStack)).toEqual([45,45]);expect(n.initialTotal).toBe(90);
 });
});
