import {applyCommand,assertAccounting,nextHand,projectView,startHand} from '../../src/core/engine';
import {appendMoney,GENESIS,seal} from '../../src/storage/integrity';
import {auditSnapshot} from '../../src/storage/verified';
import {normalizeTableSettings,tableProfiles} from '../../src/session/configuration';
import {DEFAULT_SETTINGS,rules} from '../../src/session/controller';
import {newHandId} from '../../src/identity';
import type {AppData,StoredHand} from '../../src/session/types';
import type {Action} from '../../src/contracts';
/** Eight legal engine hands, not UI-played hands. No stack/result edits.
 * Positive-small-N: +2BB each. High variance: alternating+75BB/-70BB.
 * Deliberately selected folds create diagnostic inputs, not realistic strategies. */
export async function warningFixture(kind:'small'|'variance'):Promise<AppData>{
 const settings=normalizeTableSettings({...DEFAULT_SETTINGS,seats:2,buyIn:100000,opponents:[{selection:'tag',personalitySeed:909}],tableMode:'live'},()=>909),profile=rules(settings),profiles=tableProfiles(settings),sessionId=`warning:${newHandId()}`,base=Date.parse('2026-11-01T00:00:00Z'),at=new Date(base).toISOString();
 const data:AppData={schemaVersion:4,revision:0,epoch:0,wallet:0,initialBankroll:1000000,ledger:[],sessions:[],hands:[],active:null,importedHands:[]};
 await appendMoney(data,{id:'warning:initial',at,epoch:0,kind:'adjustment',walletDelta:1000000,tableDelta:0,pokerNet:0,note:'Isolated uncertainty fixture; not poker winnings'});
 data.sessions=[{id:sessionId,epoch:0,startedAt:at,endedAt:null,settings,profile,buyIns:100000,cashOut:0,activeMs:240000,lastActiveAt:null,handIds:[]}];
 await appendMoney(data,{id:`buy-in:${sessionId}`,at,epoch:0,kind:'buy-in',walletDelta:-100000,tableDelta:100000,pokerNet:0,sessionId,note:'Fixture buy-in'});
 let game=startHand({handId:newHandId(),button:0,profile,seats:[{id:0,name:'You',stack:100000},{id:1,name:'Alex',stack:100000}]});
 for(let number=1;number<=8;number++){
  const winner=kind==='small'||number%2===1?0:1,commitment=kind==='small'?400:winner===0?15000:14000,frames=[projectView(game,0)],startedAt=new Date(base+(number-1)*30000).toISOString(),endedAt=new Date(base+number*30000).toISOString();
  const act=(action:Action)=>{game=applyCommand(game,{handId:game.handId,revision:game.revision,seatId:game.actor!,decisionId:`warning:${number}:${game.revision}`,action});frames.push(projectView(game,0));assertAccounting(game);};
  act({type:'raise',to:commitment});act({type:'call'});if(game.street!=='flop')throw Error('Fixture did not reach flop');
  if(game.actor!==winner)act({type:'check'});act({type:'raise',to:200});act({type:'fold'});
  if(String(game.street)!=='complete')throw Error('Fixture did not settle');const hero=game.seats.find(s=>s.id===0)!,net=hero.stack-hero.startingStack;if(net!==(winner===0?commitment:-commitment))throw Error('Independent target net differs');
  const record:StoredHand={id:game.handId,sessionId,epoch:0,number,startedAt,endedAt,view:projectView(game,0),frames,net,privateProfiles:profiles,previousHash:data.hands.at(-1)?.hash??GENESIS,hash:''};data.hands.push(await seal(record));data.sessions[0].handIds.push(record.id);
  await appendMoney(data,{id:`settle:${record.id}`,at:endedAt,epoch:0,kind:'hand-net',walletDelta:0,tableDelta:net,pokerNet:net,sessionId,handId:record.id,note:'Actual legal engine fixture settlement'});if(number<8)game=nextHand(game,newHandId());
 }
 const ending=game.seats.find(s=>s.id===0)!.stack,endedAt=new Date(base+240000).toISOString();await appendMoney(data,{id:`cash-out:${sessionId}`,at:endedAt,epoch:0,kind:'cash-out',walletDelta:ending,tableDelta:-ending,pokerNet:0,sessionId,note:'Fixture cashout'});data.sessions[0].cashOut=ending;data.sessions[0].endedAt=endedAt;
 const net=data.hands.reduce((sum,h)=>sum+h.net,0);if(net!==(kind==='small'?3200:4000)||data.wallet!==1000000+net)throw Error('Fixture money mismatch');return auditSnapshot(data);
}
