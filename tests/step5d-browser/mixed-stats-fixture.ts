import {applyCommand,assertAccounting,nextHand,projectView,startHand,topUpTable} from '../../src/core/engine';
import {DEFAULT_SETTINGS,rules} from '../../src/session/controller';
import {normalizeTableSettings,tableProfiles} from '../../src/session/configuration';
import {appendMoney,canonical,digest,GENESIS,seal} from '../../src/storage/integrity';
import {auditSnapshot} from '../../src/storage/verified';
import type {AppData,StoredHand} from '../../src/session/types';
import type {Action} from '../../src/contracts';

/** Actual engine fixture hands, not browser-played hands or bot-performance evidence.
 * Hero calls from SB, opponent folds; alternating button yields 50*(SB+BB) per100.
 * Decks remain natural CSPRNG: payout arithmetic does not depend on private cards.
 */
export async function mixedStatsFixture(second:'2/5'|'5/10',progress?:(hands:number)=>Promise<void>){
 const base=Date.parse('2026-11-01T00:00:00Z'),at=(offset:number)=>new Date(base+offset).toISOString();
 const data:AppData={schemaVersion:4,revision:0,epoch:0,wallet:0,initialBankroll:1000000,ledger:[],sessions:[],hands:[],active:null,importedHands:[]};
 await appendMoney(data,{id:'mixed-initial',at:at(0),epoch:0,kind:'adjustment',walletDelta:1000000,tableDelta:0,pokerNet:0,note:'Isolated mixed-stakes fixture bankroll'});
 const stakes=[{smallBlind:100,bigBlind:200},second==='2/5'?{smallBlind:200,bigBlind:500}:{smallBlind:500,bigBlind:1000}];
 const originalCohorts:string[]=[],expectedGroups:Array<{smallBlind:number;bigBlind:number;hands:number;profit:number;bb100:number}>=[];
 for(let cohort=0;cohort<2;cohort++){
  const stake=stakes[cohort],buyIn=stake.bigBlind*150,sessionId=`mixed:${second}:session:${cohort}`,offset=cohort*3600000;
  const settings=normalizeTableSettings({...DEFAULT_SETTINGS,...stake,stake:'custom',seats:2,capacity:2,buyIn,maxBuyInBB:1000,opponents:[{selection:'tag',personalitySeed:7611+cohort}]},()=>7611+cohort),profile=rules(settings),profiles=tableProfiles(settings);
  const session={id:sessionId,epoch:data.epoch,startedAt:at(offset),endedAt:null as string|null,settings,profile,buyIns:buyIn,cashOut:0,activeMs:3600000,lastActiveAt:null,handIds:[] as string[]};data.sessions.push(session);
  await appendMoney(data,{id:`buy-in:${sessionId}`,at:at(offset),epoch:data.epoch,kind:'buy-in',walletDelta:-buyIn,tableDelta:buyIn,pokerNet:0,sessionId,note:'Fixture buy-in transfer; excluded from poker result'});
  let game=startHand({handId:`${sessionId}:hand:1`,button:0,profile,seats:[{id:0,name:'You',stack:buyIn},{id:1,name:'Alex',stack:buyIn}]});
  for(let number=1;number<=100;number++){
   const startedAt=at(offset+(number-1)*36000),endedAt=at(offset+number*36000),frames=[projectView(game,0)];
   if(cohort===0&&number===26){const unchanged=canonical(game);data.epoch++;data.initialBankroll=data.wallet+12345;await appendMoney(data,{id:'mixed-external-adjustment',at:startedAt,epoch:data.epoch,kind:'reset',walletDelta:12345,tableDelta:0,pokerNet:0,note:'Explicit external +$123.45'});if(canonical(game)!==unchanged)throw Error('Manual fixture edit changed game');}
   const act=(action:Action)=>{game=applyCommand(game,{handId:game.handId,revision:game.revision,seatId:game.actor!,decisionId:`${game.handId}:${game.revision}`,action});frames.push(projectView(game,0));assertAccounting(game);};
   if(game.actor===0)act({type:'call'});act({type:'fold'});
   if(game.street!=='complete')throw Error('Mixed fixture did not settle');
   const hero=game.seats.find(s=>s.id===0)!,net=hero.stack-hero.startingStack;
   // Match SessionController.settle: bankroll resets do not reassign an ongoing
   // session's hands to the new account epoch.
   const record:StoredHand={id:game.handId,sessionId,epoch:session.epoch,number,startedAt,endedAt,view:projectView(game,0),frames,net,privateProfiles:profiles,previousHash:data.hands.at(-1)?.hash??GENESIS,hash:''};
   data.hands.push(await seal(record));session.handIds.push(record.id);
   await appendMoney(data,{id:`settle:${record.id}`,at:endedAt,epoch:record.epoch,kind:'hand-net',walletDelta:0,tableDelta:net,pokerNet:net,sessionId,handId:record.id,note:'Actual engine fixture payout'});
   if(number===51){const id=`top-up:${sessionId}`;game=topUpTable(game,0,1234,id,1000*stake.bigBlind);session.buyIns+=1234;await appendMoney(data,{id,at:endedAt,epoch:data.epoch,kind:'top-up',walletDelta:-1234,tableDelta:1234,pokerNet:0,sessionId,note:'Fixture top-up; not poker profit'});}
   if(number<100)game=nextHand(game,`${sessionId}:hand:${number+1}`);
   if(number%20===0)await progress?.(cohort*100+number);
  }
  const expected=50*(stake.smallBlind+stake.bigBlind),group=data.hands.slice(cohort*100,(cohort+1)*100);
  if(group.reduce((n,h)=>n+h.net,0)!==expected)throw Error('Independent mixed cohort expected profit differs');
  originalCohorts.push(canonical(group));expectedGroups.push({...stake,hands:100,profit:expected,bb100:expected/stake.bigBlind});
  const ending=game.seats.find(s=>s.id===0)!.stack;session.cashOut=ending;session.endedAt=at(offset+3600000);
  await appendMoney(data,{id:`cash-out:${sessionId}`,at:session.endedAt,epoch:data.epoch,kind:'cash-out',walletDelta:ending,tableDelta:-ending,pokerNet:0,sessionId,note:'Fixture cashout; not poker profit'});
 }
 const profit=expectedGroups.reduce((n,g)=>n+g.profit,0),bb100=expectedGroups.reduce((n,g)=>n+g.bb100,0)/2;
 if(data.wallet!==1000000+12345+profit||data.ledger.reduce((n,e)=>n+e.tableDelta,0)!==0)throw Error('Independent fixture financial totals differ');
 if(originalCohorts.some((text,i)=>text!==canonical(data.hands.slice(i*100,(i+1)*100))))throw Error('Old canonical cohort changed');
 await auditSnapshot(data);
 return{data,metadata:{kind:'actual-engine-populated-display-fixture',fixtureHands:200,actualUIPlayedHands:0,second,expected:{hands:200,profit,bb100,wallet:data.wallet,groups:expectedGroups},manualAdjustmentCents:12345,topups:2,cashouts:2,settlements:200,seedDisclosure:'Unforced CSPRNG deck; private cards do not affect prescribed all-fold payout. Stable opponent personality seeds7611 and7612; no measured bot behavior claim.',ruleProfiles:data.sessions.map(s=>s.profile),policyVersions:[...new Set(data.hands.flatMap(h=>Object.values(h.privateProfiles).map(p=>p.policyVersion)))],canonicalHandsSHA256:await digest(data.hands),snapshotSHA256:await digest(data),cohortSHA256:await Promise.all(originalCohorts.map(text=>digest(JSON.parse(text))))}};
}
