import {applyCommand,assertAccounting,legalActions,nextHand,observeBot,projectView,startHand,topUpTable} from '../../src/core/engine';
import {appendMoney,GENESIS,seal} from '../../src/storage/integrity';
import {auditSnapshot} from '../../src/storage/verified';
import {normalizeTableSettings,tableProfiles} from '../../src/session/configuration';
import {DEFAULT_SETTINGS,rules} from '../../src/session/controller';
import {newHandId} from '../../src/identity';
import type {AppData,StoredHand} from '../../src/session/types';
import type {Action} from '../../src/contracts';
import {chooseDecision} from '../../src/bots/policy';
import {seededRandom} from '../step4a/scenarios';
/** Isolated populated-results fixture, NOT 300 hands played through browser UI.
 * 150 Hero small-blind folds (-$150), 90 opponent small-blind folds (+$90),
 * and 60 opponent limp/folds (+$120), all executed through the actual engine.
 * Net +$60 / $2 = +30BB over300hands => +10BB/100, without edited results. */
export async function createStatsBrowserFixture(progress?:(hands:number)=>Promise<void>):Promise<AppData> {
 const settings=normalizeTableSettings({...DEFAULT_SETTINGS,seats:2,buyIn:20000,opponents:[{selection:'tag',personalitySeed:701}],tableMode:'live'},()=>701);
 const profile=rules(settings),profiles=tableProfiles(settings),sessionId=`stats-fixture:${newHandId()}`,base=Date.parse('2026-11-01T00:00:00Z'),at=new Date(base).toISOString();
 const data:AppData={schemaVersion:4,revision:0,epoch:0,wallet:0,initialBankroll:1000000,ledger:[],sessions:[],hands:[],active:null,importedHands:[]};
 await appendMoney(data,{id:'stats-fixture-initial',at,epoch:0,kind:'adjustment',walletDelta:1000000,tableDelta:0,pokerNet:0,note:'Isolated statistics fixture bankroll'});
 data.sessions=[{id:sessionId,epoch:0,startedAt:at,endedAt:null,settings,profile,buyIns:20000,cashOut:0,activeMs:3600000,lastActiveAt:null,handIds:[]}];
 await appendMoney(data,{id:`buy-in:${sessionId}`,at,epoch:0,kind:'buy-in',walletDelta:-20000,tableDelta:20000,pokerNet:0,sessionId,note:'Fixture wallet to table'});
 let game=startHand({handId:newHandId(),button:0,profile,seats:[{id:0,name:'You',stack:20000},{id:1,name:'Alex',stack:20000}]});let bigBlindHands=0;
 for(let number=1;number<=300;number++) {
  const frames=[projectView(game,0)],startedAt=new Date(base+(number-1)*12000).toISOString(),endedAt=new Date(base+number*12000).toISOString();
  const act=(seatId:number,action:Action)=>{if(game.actor!==seatId)throw Error('Fixture public action order changed');game=applyCommand(game,{handId:game.handId,revision:game.revision,seatId,decisionId:`${game.handId}:${game.revision}`,action});frames.push(projectView(game,0));};
  if(game.button===0)act(0,{type:'fold'});
  else if(++bigBlindHands<=60){act(1,{type:'call'});act(0,{type:'raise',to:600});act(1,{type:'fold'});}
  else act(1,{type:'fold'});
  if(game.street!=='complete')throw Error('Fixture hand did not settle');
  const hero=game.seats.find(s=>s.id===0)!,net=hero.stack-hero.startingStack;
  const record:StoredHand={id:game.handId,sessionId,epoch:0,number,startedAt,endedAt,view:projectView(game,0),frames,net,privateProfiles:profiles,previousHash:data.hands.at(-1)?.hash??GENESIS,hash:''};
  data.hands.push(await seal(record));data.sessions[0].handIds.push(record.id);
  await appendMoney(data,{id:`settle:${record.id}`,at:endedAt,epoch:0,kind:'hand-net',walletDelta:0,tableDelta:net,pokerNet:net,sessionId,handId:record.id,note:'Actual engine fixture settlement'});
  if(number<300)game=nextHand(game,newHandId());
  if(number%30===0)await progress?.(number);
 }
 const ending=game.seats.find(s=>s.id===0)!.stack,endedAt=new Date(base+3600000).toISOString();
 await appendMoney(data,{id:`cash-out:${sessionId}`,at:endedAt,epoch:0,kind:'cash-out',walletDelta:ending,tableDelta:-ending,pokerNet:0,sessionId,note:'Fixture full cashout'});
 data.sessions[0].cashOut=ending;data.sessions[0].endedAt=endedAt;
 if(data.hands.reduce((sum,h)=>sum+h.net,0)!==6000||data.wallet!==1006000||ending!==26000)throw Error('Independently specified fixture cash totals changed');
 return auditSnapshot(data);
}

/** G05:100 genuine completed engine hands against the current calling-station
 * policy. Hero checks/calls; the station uses its own legal observation and a
 * recorded seed per decision. Natural CSPRNG cards are not selected for wins. */
export async function createStationBrowserFixture(progress?:(hands:number)=>Promise<void>):Promise<AppData> {
 const settings=normalizeTableSettings({...DEFAULT_SETTINGS,seats:2,buyIn:20000,opponents:[{selection:'station',personalitySeed:1705}],tableMode:'live'},()=>1705);
 const profile=rules(settings),profiles=tableProfiles(settings),sessionId=`station-fixture:${newHandId()}`,base=Date.parse('2026-11-01T00:00:00Z'),at=new Date(base).toISOString();
 const data:AppData={schemaVersion:4,revision:0,epoch:0,wallet:0,initialBankroll:10000000,ledger:[],sessions:[],hands:[],active:null,importedHands:[]};
 await appendMoney(data,{id:'station-fixture-initial',at,epoch:0,kind:'adjustment',walletDelta:data.initialBankroll,tableDelta:0,pokerNet:0,note:'Isolated station-population fixture bankroll'});
 const session={id:sessionId,epoch:0,startedAt:at,endedAt:null as string|null,settings,profile,buyIns:20000,cashOut:0,activeMs:3600000,lastActiveAt:null,handIds:[] as string[]};data.sessions=[session];
 await appendMoney(data,{id:`buy-in:${sessionId}`,at,epoch:0,kind:'buy-in',walletDelta:-20000,tableDelta:20000,pokerNet:0,sessionId,note:'Fixture wallet to table'});
 let game=startHand({handId:newHandId(),button:0,profile,seats:[{id:0,name:'You',stack:20000},{id:1,name:'Station',stack:20000}]});
 for(let number=1;number<=100;number++) {
  const frames=[projectView(game,0)],startedAt=new Date(base+(number-1)*36000).toISOString(),endedAt=new Date(base+number*36000).toISOString();
  for(let guard=0;game.street!=='complete'&&guard<200;guard++) {
   const decisionId=`station-fixture:${number}:${game.revision}`,seatId=game.actor!;
   const command=seatId===0?{handId:game.handId,revision:game.revision,seatId,decisionId,action:{type:legalActions(game).check?'check':'call'} as Action}:
    chooseDecision(observeBot(game,seatId,profiles[seatId].policyVersion,decisionId),profiles[seatId],seededRandom(0x605000+number*997+game.revision));
   game=applyCommand(game,command);assertAccounting(game);frames.push(projectView(game,0));
  }
  if(game.street!=='complete')throw Error('Station fixture did not settle');
  const hero=game.seats.find(s=>s.id===0)!,net=hero.stack-hero.startingStack;
  const record:StoredHand={id:game.handId,sessionId,epoch:0,number,startedAt,endedAt,view:projectView(game,0),frames,net,privateProfiles:profiles,previousHash:data.hands.at(-1)?.hash??GENESIS,hash:''};
  data.hands.push(await seal(record));session.handIds.push(record.id);
  await appendMoney(data,{id:`settle:${record.id}`,at:endedAt,epoch:0,kind:'hand-net',walletDelta:0,tableDelta:net,pokerNet:net,sessionId,handId:record.id,note:'Actual station-policy fixture settlement'});
  if(number<100){
   for(const seat of game.seats)if(seat.stack<2000){
    const amount=20000-seat.stack,transferId=`station-fixture-topup:${number}:${seat.id}`;game=topUpTable(game,seat.id,amount,transferId,100000);
    if(seat.id===0){session.buyIns+=amount;await appendMoney(data,{id:transferId,at:endedAt,epoch:0,kind:'top-up',walletDelta:-amount,tableDelta:amount,pokerNet:0,sessionId,note:'Fixture Hero replenishment; excluded from poker profit'});}
   }
   game=nextHand(game,newHandId());
  }
  if(number%10===0)await progress?.(number);
 }
 const ending=game.seats.find(s=>s.id===0)!.stack,endedAt=new Date(base+3600000).toISOString();
 await appendMoney(data,{id:`cash-out:${sessionId}`,at:endedAt,epoch:0,kind:'cash-out',walletDelta:ending,tableDelta:-ending,pokerNet:0,sessionId,note:'Fixture full cashout'});session.cashOut=ending;session.endedAt=endedAt;
 if(data.wallet!==data.initialBankroll+data.hands.reduce((sum,h)=>sum+h.net,0))throw Error('Station fixture profits do not reconcile');
 return auditSnapshot(data);
}
