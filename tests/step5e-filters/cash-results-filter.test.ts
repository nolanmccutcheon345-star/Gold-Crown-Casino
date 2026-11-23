import {beforeAll,describe,expect,it} from 'vitest';
import {applyCommand,projectView,startHand} from '../../src/core/engine';
import {DEFAULT_SETTINGS,rules} from '../../src/session/controller';
import type {AppData,CashSession,CashSettings,StoredHand} from '../../src/session/types';
import {appendMoney,GENESIS,publicHistory,seal} from '../../src/storage/integrity';
import {auditSnapshot,prepareCompactSnapshot} from '../../src/storage/verified';
import {ALL_CASH_RESULTS_FILTER,cashResultsFilterMarkup,deriveFilteredCashStats} from '../../src/ui/cash-results-filter';

type Stake={smallBlind:number;bigBlind:number};
const low:Stake={smallBlind:100,bigBlind:200},high:Stake={smallBlind:200,bigBlind:500};
type SessionInput={id:string;hands:{stake:Stake;heroFolds:boolean}[];activeMs?:number;lastActiveAt?:number;pendingStake?:Stake};
const at='2026-11-01T00:00:00.000Z',endedAt='2026-11-01T01:00:00.000Z';
const settingsFor=(stake:Stake):CashSettings=>({...DEFAULT_SETTINGS,seats:2,archetypes:['tag'],stake:'custom',...stake,buyIn:20000,rakeMode:'none'});

/** Engine-produced, independently specified fold outcomes with a real sealed
 * financial ledger. All fixtures pass the complete canonical snapshot audit.
 * CSPRNG cards do not affect these preflop fold results. */
async function fixture(inputs:SessionInput[],extraMoney=0,imports=false):Promise<AppData> {
 const data:AppData={schemaVersion:4,revision:0,epoch:0,wallet:0,initialBankroll:1000000,ledger:[],sessions:[],hands:[],active:null,importedHands:[]};
 await appendMoney(data,{id:'initial',at,epoch:0,kind:'adjustment',walletDelta:data.initialBankroll,tableDelta:0,pokerNet:0,note:'Fixture initial virtual bankroll'});
 for(const input of inputs){
  const settings=settingsFor(input.hands[0]?.stake??low),session:CashSession={id:input.id,epoch:0,startedAt:at,endedAt:null,settings,profile:rules(settings),buyIns:20000,cashOut:0,activeMs:input.activeMs??3600000,lastActiveAt:input.lastActiveAt??null,handIds:[]};
  data.sessions.push(session);
  await appendMoney(data,{id:`buy:${input.id}`,at,epoch:0,kind:'buy-in',walletDelta:-20000,tableDelta:20000,pokerNet:0,sessionId:input.id,note:'Fixture buy-in'});
  let stacks=[20000,20000];
  for(const [index,hand] of input.hands.entries()){
   session.settings=settingsFor(hand.stake);session.profile=rules(session.settings);
   let game=startHand({handId:`${input.id}:${index+1}`,profile:session.profile,button:hand.heroFolds?0:1,seats:stacks.map((stack,id)=>({id,name:id===0?'You':'Opponent',stack}))});
   const frames=[projectView(game,0)];
   game=applyCommand(game,{handId:game.handId,revision:game.revision,seatId:game.actor!,decisionId:`fold:${game.handId}`,action:{type:'fold'}});frames.push(projectView(game,0));
   expect(game.street).toBe('complete');
   const net=hand.heroFolds?-hand.stake.smallBlind:hand.stake.smallBlind;
   expect(game.seats[0].stack-game.seats[0].startingStack).toBe(net);
   const record:StoredHand={id:game.handId,sessionId:input.id,epoch:0,number:index+1,startedAt:at,endedAt,view:projectView(game,0),frames,net,privateProfiles:{},previousHash:data.hands.at(-1)?.hash??GENESIS,hash:''};
   data.hands.push(await seal(record));session.handIds.push(record.id);
   await appendMoney(data,{id:`settle:${game.handId}`,at:endedAt,epoch:0,kind:'hand-net',walletDelta:0,tableDelta:net,pokerNet:net,sessionId:input.id,handId:game.handId,note:'Actual engine fold settlement'});
   stacks=game.seats.map(seat=>seat.stack);
   data.active={sessionId:input.id,game,profiles:{},number:index+1,startedAt:at,frames,paused:input.lastActiveAt===undefined,pending:null,exitMode:null};
  }
  if(input.pendingStake){
   session.settings=settingsFor(input.pendingStake);session.profile=rules(session.settings);
   const game=startHand({handId:`${input.id}:pending`,profile:session.profile,button:0,seats:stacks.map((stack,id)=>({id,name:id===0?'You':'Opponent',stack}))});
   data.active={sessionId:input.id,game,profiles:{},number:input.hands.length+1,startedAt:at,frames:[projectView(game,0)],paused:false,pending:null,exitMode:null};
  }
  if(input.lastActiveAt===undefined&&!input.pendingStake){
   session.endedAt=endedAt;session.cashOut=stacks[0];data.active=null;
   await appendMoney(data,{id:`out:${input.id}`,at:endedAt,epoch:0,kind:'cash-out',walletDelta:stacks[0],tableDelta:-stacks[0],pokerNet:0,sessionId:input.id,note:'Fixture cash-out'});
  }
 }
 if(extraMoney)await appendMoney(data,{id:'extra-adjustment',at:endedAt,epoch:0,kind:'adjustment',walletDelta:extraMoney,tableDelta:0,pokerNet:0,note:'Non-poker adjustment'});
 if(imports)data.importedHands=(await publicHistory(data.hands)).hands;
 return auditSnapshot(data);
}
const inputs:SessionInput[]=[{id:'mixed',hands:[{stake:low,heroFolds:true},{stake:high,heroFolds:false}]},{id:'low-only',hands:[{stake:low,heroFolds:false}]}];
let data:AppData;
beforeAll(async()=>{data=await fixture(inputs);});

describe('Step5E filterable canonical cash results',()=>{
 it('combines dollars and per-hand big blinds independently at mixed stakes',()=>{
  const result=deriveFilteredCashStats(data,ALL_CASH_RESULTS_FILTER,0),stats=result.stats;
  expect(stats.hands).toBe(3);expect(stats.profit).toBe(200);
  expect(stats.bb100).toBeCloseTo(100*((-100/200)+(200/500)+(100/200))/3);
  expect(stats.mixedStakes).toBe(true);expect(stats.activeMs).toBe(7200000);expect(stats.perHour).toBe(100);
  expect(result.hoursAvailable).toBe(true);expect(stats.namespace).toBe('cash');
 });
 it('filters a whole session while preserving its complete active clock',()=>{
  const result=deriveFilteredCashStats(data,{sessionId:'mixed',stake:'all'},0);
  expect(result.stats).toMatchObject({hands:2,profit:100,bb100:expect.closeTo(-5),activeMs:3600000,perHour:100});
  expect(result.stats.sessions.map(session=>session.id)).toEqual(['mixed']);expect(result.hoursAvailable).toBe(true);
 });
 it('does not allocate a mixed session clock to its selected stake hands',()=>{
  const result=deriveFilteredCashStats(data,{sessionId:'all',stake:'100/200'},0);
  expect(result.stats).toMatchObject({hands:2,profit:0,bb100:0,mixedStakes:false,activeMs:0,perHour:null});
  expect(result.hoursAvailable).toBe(false);expect(result.unavailableSessionIds).toEqual(['mixed']);
  expect(result.stats.sessions.find(session=>session.id==='mixed')).toMatchObject({hands:1,profit:-100,activeMs:0,perHour:null});
  expect(result.stats.sessions.find(session=>session.id==='low-only')).toMatchObject({hands:1,profit:100,activeMs:3600000,perHour:100});
  expect(result.disclosure).toContain('whole clock cannot be allocated');
 });
 it('intersects session and stake and retains selected opportunity uncertainty',()=>{
  const full=deriveFilteredCashStats(data,{sessionId:'low-only',stake:'100/200'},0);
  expect(full.hoursAvailable).toBe(true);expect(full.stats).toMatchObject({hands:1,profit:100,bb100:50,perHour:100});
  const partial=deriveFilteredCashStats(data,{sessionId:'mixed',stake:'100/200'},0);
  expect(partial.stats.metrics.vpip).toMatchObject({numerator:0,denominator:1,percent:0,status:'INSUFFICIENT_SAMPLE'});
  expect(partial.stats.metrics.vpip.ci95?.[1]).toBeGreaterThan(70);
  expect(partial.stats.disclosure).toContain('not a calibrated skill estimate');
  expect(partial.stats.opportunityCoverage).toEqual({completeHands:1,missingFrames:0});
 });
 it('returns an empty selection without inventing rates or selected session time',()=>{
  for(const filter of [{sessionId:'missing',stake:'all'},{sessionId:'low-only',stake:'200/500'}]){
   const result=deriveFilteredCashStats(data,filter,0);
   expect(result.stats).toMatchObject({hands:0,profit:0,bb100:null,perHour:null,activeMs:0,sessions:[],stakes:[]});
   expect(result.stats.metrics.vpip).toMatchObject({denominator:0,percent:null,ci95:null,status:'NO_OPPORTUNITIES'});
  }
 });
 it('excludes manual changes, buy-ins, cash-outs, imports and unfinished hands',async()=>{
  const before=JSON.stringify(data),withExtras=await fixture(inputs,543210,true);
  expect(withExtras.wallet-data.wallet).toBe(543210);expect(withExtras.importedHands).toHaveLength(3);
  expect(deriveFilteredCashStats(withExtras,ALL_CASH_RESULTS_FILTER,0)).toEqual(deriveFilteredCashStats(data,ALL_CASH_RESULTS_FILTER,0));
  const active=await fixture([{id:'active',hands:[{stake:low,heroFolds:true}],activeMs:1000,lastActiveAt:5000,pendingStake:low}],20000,true);
  expect(active.active?.game.street).not.toBe('complete');
  expect(deriveFilteredCashStats(active,ALL_CASH_RESULTS_FILTER,6000).stats).toMatchObject({hands:1,profit:-100});
  expect(JSON.stringify(data)).toBe(before);
 });
 it('uses a live session clock without counting paused or closed elapsed time',async()=>{
  const active=await fixture([{id:'active',hands:[{stake:low,heroFolds:true}],activeMs:1000,lastActiveAt:5000}]);
  const result=deriveFilteredCashStats(active,{sessionId:'active',stake:'all'},6000);
  expect(result.stats).toMatchObject({activeMs:2000,perHour:-180000});expect(result.stats.activeSession?.activeMs).toBe(2000);
  expect(deriveFilteredCashStats(active,ALL_CASH_RESULTS_FILTER,4000).stats.activeMs).toBe(1000);
  const paused=structuredClone(active);paused.sessions[0].lastActiveAt=null;paused.active!.paused=true;
  expect(deriveFilteredCashStats(await auditSnapshot(paused),ALL_CASH_RESULTS_FILTER,999999).stats.activeMs).toBe(1000);
  expect(deriveFilteredCashStats(data,ALL_CASH_RESULTS_FILTER,9999999999999).stats.activeMs).toBe(7200000);
 });
 it('withholds subset time when another stake is active but has no completed hand yet',async()=>{
  const active=await fixture([{id:'active',hands:[{stake:low,heroFolds:true}],activeMs:1000,lastActiveAt:5000,pendingStake:high}]);
  const selected=deriveFilteredCashStats(active,{sessionId:'active',stake:'100/200'},6000);
  expect(selected.stats).toMatchObject({hands:1,profit:-100,activeMs:0,perHour:null});expect(selected.hoursAvailable).toBe(false);
  expect(selected.stats.activeSession?.perHour).toBeNull();
 });
 it('renders escaped controls, selected values and explicit cash-only scope',async()=>{
  const hostileId='s"><svg onload="bad">&\'',hostile=await fixture([{id:hostileId,hands:[{stake:low,heroFolds:true}]}]);
  const markup=cashResultsFilterMarkup(hostile,{sessionId:hostileId,stake:'100/200'},true);
  expect(markup).toContain('id="results-filter-session"');expect(markup).toContain('id="results-filter-stake"');
  expect(markup).toContain('data-testid="results-filter-disclosure"');expect(markup).toContain('s&quot;&gt;&lt;svg onload=&quot;bad&quot;&gt;&amp;&#39;');
  expect(markup).not.toContain('<svg');expect(markup).toContain('value="100/200" selected');expect(markup.match(/ disabled/g)).toHaveLength(2);
  expect(markup).toContain('Tournament ROI, ITM, finish and fees are unsupported');
  expect(markup).not.toMatch(/privateProfiles|personality|archetype|deck|hole|traits/);
 });
 it('rejects unverified objects without reading them and preserves archived stake choices on compact views',async()=>{
  const forged=structuredClone(data);let reads=0;Object.defineProperty(forged,'hands',{get(){reads++;throw Error('must not execute');}});
  expect(()=>deriveFilteredCashStats(forged,ALL_CASH_RESULTS_FILTER,0)).toThrow('verified canonical');
  expect(()=>cashResultsFilterMarkup(forged,ALL_CASH_RESULTS_FILTER)).toThrow('verified canonical');expect(reads).toBe(0);
  const full=await fixture([{id:'archive',hands:[{stake:high,heroFolds:false},...Array.from({length:120},(_,index)=>({stake:low,heroFolds:index%2===0}))]}]);
  const compact=await prepareCompactSnapshot(full);
  expect(compact.context.handOffset).toBe(1);expect(compact.data.hands.every(hand=>hand.view.profile.bigBlind===200)).toBe(true);
  expect(cashResultsFilterMarkup(compact.data,ALL_CASH_RESULTS_FILTER)).toContain('value="200/500"');
  expect(()=>deriveFilteredCashStats(compact.data,ALL_CASH_RESULTS_FILTER,0)).toThrow('full canonical archive');
  expect(deriveFilteredCashStats(full,{sessionId:'archive',stake:'200/500'},0).stats).toMatchObject({hands:1,profit:200,bb100:40});
 });
});
