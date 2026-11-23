import {expect,it} from 'vitest';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import type {Archetype,PublicMemoryHand} from '../../src/contracts';
import {assertAccounting,nextHand,startHand,topUpTable,ENGINE_VERSION} from '../../src/core/engine';
import {createProfile,POLICY_VERSION} from '../../src/bots/policy';
import {practiceProfile,rig} from '../verification/helpers';
import {runHand} from '../step4c/population';
import {rng,clusteredRate,DEFINITIONS,type Counters,type HandAudit} from '../step4c/audit';
interface EcologyRow {cell:string;block:number;seed:number;hands:number;metrics:Counters;flopHands:number;multiwayFlopHands:number;sidePotHands:number;topups:number;initialTable:number;initialWallet:number;endingTable:number;endingWallet:number;rake:number;stackStates:number;raiseCount:number;sizingBuckets:Record<string,number>;artifact:string;}
const full=process.env.STEP5C_ECOLOGY_FULL==='1',blocks=full?8:1,hands=full?50:2;
const cells=[{id:'loose-six',lineup:['station','passive-reg','station','nit','fit-or-fold','stronger-reg']},{id:'mixed-nine',lineup:['station','nit','stronger-reg','passive-reg','tag','station','lag','fit-or-fold','maniac']}] as const;
const depths=[25,40,65,100,150,200],base=0x5c900000;
function add(to:Counters,from:Counters){for(const[k,v]of Object.entries(from)){to[k]??={count:0,opportunities:0};to[k].count+=v.count;to[k].opportunities+=v.opportunities;}}
function out(){const p=resolve(process.env.STEP5C_GATE_EVIDENCE_DIR??'tests/step5c-gates/evidence');mkdirSync(p,{recursive:true});return p;}
it('Y10 continuous six/nine-seat mismatched stacks conserve wallet/table/rake without per-hand resets',async()=>{
 const start=Date.now(),rows:EcologyRow[]=[];let actions=0;
 for(const [cellIndex,cell]of cells.entries())for(let block=0;block<blocks;block++){
  const seed=base+cellIndex*100000+block*1000,count=cell.lineup.length,profiles=cell.lineup.map((selection,seat)=>createProfile({selection:selection as Archetype,skill:selection==='stronger-reg'?.9:selection==='station'?.25:.5},seed+seat*97,'neutral')),identity=JSON.stringify(profiles),rule=practiceProfile();rule.rake={basisPoints:500,cap:400,noFlopNoDrop:true};
  let game=startHand({handId:`5c:${cell.id}:${block}:0`,button:block%count,profile:rule,seats:profiles.map((_,id)=>({id,name:`Stable ${id}`,stack:depths[id%depths.length]*200}))}),wallet=count*2000000,rake=0;
  const initialTable=game.initialTotal,initialWallet=wallet,records=[],transfers=[],metrics:Counters={},sizes:HandAudit['sizing']=[],memory:PublicMemoryHand[]=[],stackSnapshots=[];let flopHands=0,multiwayFlopHands=0,sidePotHands=0;
  for(let hand=0;hand<hands;hand++){
   const random=rng(seed+hand),deck=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s));for(let i=51;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
   game=rig(game,profiles.map((_,i)=>deck.slice(i*2,i*2+2)),deck.slice(count*2,count*2+5));stackSnapshots.push({hand,starting:game.seats.map(s=>s.startingStack)});
   const result=runHand(game,profiles,seed+hand,memory);game=result.game;expect(game.street).toBe('complete');expect(JSON.stringify(profiles)).toBe(identity);rake+=game.rake;actions+=result.record.money.actions;records.push(result.record);sizes.push(...result.audit.sizing);for(const m of result.metrics.values())add(metrics,m);
   if(game.board.length>=3){flopHands++;const first=game.events.find(e=>e.type==='street'&&e.street==='flop')!,folds=new Set(game.events.filter(e=>e.type==='action'&&e.action?.type==='fold'&&e.revision<first.revision).map(e=>e.seatId));if(count-folds.size>=3)multiwayFlopHands++;}if(game.pots.length>1)sidePotHands++;
   memory.push({handId:game.handId,seats:game.seats.map(s=>({id:s.id,revealedCards:game.revealedSeats.includes(s.id)?s.hole:[]})),events:game.events});if(memory.length>120)memory.shift();
   if(hand<hands-1)for(const seat of game.seats)if(seat.stack<4000){const amount=depths[seat.id%depths.length]*200-seat.stack,id=`5c-topup:${cell.id}:${block}:${hand}:${seat.id}`;expect(wallet).toBeGreaterThanOrEqual(amount);game=topUpTable(game,seat.id,amount,id,40000);wallet-=amount;transfers.push({id,afterHand:hand,seat:seat.id,amount,walletAfter:wallet});}
   assertAccounting(game);expect(wallet+game.seats.reduce((n,s)=>n+s.stack,0)+rake).toBe(initialWallet+initialTable);
   if(hand<hands-1){const expected=game.seats.map(s=>s.stack),button=game.button;game=nextHand(game,`5c:${cell.id}:${block}:${hand+1}`);expect(game.seats.map(s=>s.startingStack)).toEqual(expected);expect(game.button).toBe((button+1)%count);}
  }
  const artifact=`Y10-${cell.id}-${block}.json.gz`;writeFileSync(resolve(out(),artifact),gzipSync(JSON.stringify({seed,cell,profiles,rule,records,transfers,stackSnapshots,sizes})));rows.push({cell:cell.id,block,seed,hands,metrics,flopHands,multiwayFlopHands,sidePotHands,topups:transfers.length,initialTable,initialWallet,endingTable:game.seats.reduce((n,s)=>n+s.stack,0),endingWallet:wallet,rake,stackStates:new Set(stackSnapshots.map(s=>JSON.stringify(s.starting))).size,raiseCount:sizes.length,sizingBuckets:Object.fromEntries(['le25','25to75','75to150','over150'].map((bucket,index)=>[bucket,sizes.filter(s=>index===0?s.incrementPot<=.25:index===1?s.incrementPot>.25&&s.incrementPot<=.75:index===2?s.incrementPot>.75&&s.incrementPot<=1.5:s.incrementPot>1.5).length])),artifact});await new Promise<void>(resolve=>setImmediate(resolve));
 }
 const summary=cells.map(cell=>{const group=rows.filter(r=>r.cell===cell.id),names=[...new Set(group.flatMap(g=>Object.keys(g.metrics)))];return{configuration:cell.id,hands:group.reduce((n,r)=>n+r.hands,0),blocks:group.length,topups:group.reduce((n,r)=>n+r.topups,0),flopHands:group.reduce((n,r)=>n+r.flopHands,0),multiwayFlopHands:group.reduce((n,r)=>n+r.multiwayFlopHands,0),sidePotHands:group.reduce((n,r)=>n+r.sidePotHands,0),rates:Object.fromEntries(names.map(k=>[k,clusteredRate(group.map(g=>g.metrics[k]??{count:0,opportunities:0}))])),sizingBuckets:group.map(g=>g.sizingBuckets)};});
 writeFileSync(resolve(out(),'Y10-ecology.json'),JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),at:new Date().toISOString(),runtime:{node:process.version,platform:process.platform,arch:process.arch},versions:{engine:ENGINE_VERSION,policy:POLICY_VERSION,rule:practiceProfile()},sourceHashes:Object.fromEntries(['tests/step5c-gates/PROTOCOL.md','tests/step5c-gates/ecology.test.ts'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),full,seedBase:base,blocks,handsPerBlock:hands,totalHands:rows.reduce((n,r)=>n+r.hands,0),actions,elapsedMs:Date.now()-start,expected:'Every hand completes with legal actions; stable profiles, dealer movement, carry-forward stacks, separate top-up wallet debit and exact table+wallet+rake conservation.',observed:'All executable assertions passed',definitions:DEFINITIONS,rows,summary,limitations:'Synthetic population only; no independent expert/human calibration. Automatic player churn deferred FUT032 is not implemented or validated. Whole Y10 criterion not claimed PASS from this cash-component evidence.'},null,2));expect(rows).toHaveLength(cells.length*blocks);
},600000);
