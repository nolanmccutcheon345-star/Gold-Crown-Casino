import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {AppData,CashSettings,PersistencePort} from '../../src/session/types';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {legalActions,projectView} from '../../src/core/engine';
import * as policy from '../../src/bots/policy';
import {createProfile} from '../../src/bots/profiles';
import {deriveCashStats} from '../../src/stats/cash';
import {publicMemoryHands} from '../../src/session/bot-observation';

class Port implements PersistencePort {
 data:AppData|null=null;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,next:AppData){expect(this.data?.revision??null).toBe(expected);this.data=structuredClone(next);}
 close(){}
}
const settings=(changes:Partial<CashSettings>={}):CashSettings=>({...DEFAULT_SETTINGS,seats:2,buyIn:30000,maxBuyInBB:1000,...changes});
let foldBots=true;
beforeEach(()=>{foldBots=true;const original=policy.chooseDecision;vi.spyOn(policy,'chooseDecision').mockImplementation((observation,profile,random)=>({...original(observation,profile,random),action:foldBots?{type:'fold'}:observation.legal.check?{type:'check'}:{type:'call'}}));});
afterEach(()=>vi.restoreAllMocks());
async function opened(port=new Port()){const c=new SessionController(port);await c.init();expect(c.status).toBe('ready');return{c,port};}
// These money fixtures prescribe every opponent action. Freeze their saved
// policy at the base layer so reads, depth and cumulative table churn cannot
// change the scripted calls/folds; behavioral layers have separate coverage.
async function controlledMoneySession(c:SessionController,port:Port,config:CashSettings){
 await c.startSession({...config,seatStacks:{0:config.buyIn,1:config.buyIn}});
 expect(c.error).toBe('');
 const fixture=structuredClone(port.data!);delete fixture.active!.humanLayer;
 port.data=fixture;
 return(await opened(port)).c;
}
async function finish(c:SessionController){
 for(let i=0;c.data!.active!.game.street!=='complete'&&i<100;i++){
  const g=c.data!.active!.game;
  if(g.actor===0)await c.act({type:legalActions(g).check?'check':'call'},g.handId,g.revision);
  else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}
  expect(c.error).toBe('');
 }
 expect(c.data!.active!.game.street).toBe('complete');
}
function reconcile(c:SessionController){
 const d=c.data!,g=d.active?.game,h=g?.seats.find(s=>s.id===0),table=h?h.stack+(g!.street==='complete'?0:h.totalCommitted):0;
 expect(d.wallet).toBe(d.ledger.reduce((sum,e)=>sum+e.walletDelta,0));expect(table).toBe(d.ledger.reduce((sum,e)=>sum+e.tableDelta,0));
 expect(d.ledger.reduce((sum,e)=>sum+e.pokerNet,0)).toBe(d.hands.reduce((sum,h)=>sum+h.net,0));
 expect(new Set(d.ledger.map(e=>e.id)).size).toBe(d.ledger.length);expect(d.ledger.filter(e=>e.kind!=='hand-net').every(e=>e.pokerNet===0)).toBe(true);
}

describe('Additional exact R1 persistent-session obligations',()=>{
 it('V404: Unknown and Random resolve once at seat assignment, survive hand succession/reload, and expose only observations',async()=>{
  const {c,port}=await opened();await c.startSession(settings({seats:3,population:'low',opponents:[{selection:'unknown',personalitySeed:8021},{selection:'random',personalitySeed:8022}]}));
  expect(c.error).toBe('');const original=structuredClone(c.data!.active!.profiles);
  expect(original[1]).toEqual(createProfile({selection:'unknown',personalitySeed:8021},8021,'low'));
  expect(original[2]).toEqual(createProfile({selection:'random',personalitySeed:8022},8022,'low'));
  expect(original[1].unknown).toBe(true);await finish(c);await c.nextHand();
  const restored=(await opened(port)).c;expect(restored.data!.active!.profiles).toEqual(original);await finish(restored);
  expect(restored.data!.hands.every(hand=>JSON.stringify(hand.privateProfiles)===JSON.stringify(original))).toBe(true);
  const view=projectView(restored.data!.active!.game,0),memory=publicMemoryHands(restored.data!.hands,restored.data!.active!.sessionId,0);
  expect(JSON.stringify([view,memory,await restored.exportHistory()])).not.toMatch(/archetype|traits|personalitySeed|personalityId|privateProfiles/);
 });

 it.each([{smallBlind:200,bigBlind:500},{smallBlind:500,bigBlind:1000}])('X05/X11/V611:100 hands at1/2 then100 at$smallBlind/$bigBlind cents preserve exact P&L through wallet edit, topup, resume and cashout',async({smallBlind,bigBlind})=>{
  const setup=await opened();let c=setup.c;const {port}=setup;const oldRecords:string[]=[];
  const stakes=[{smallBlind:100,bigBlind:200},{smallBlind,bigBlind}];
  for(let cohort=0;cohort<2;cohort++){
   const stake=stakes[cohort];c=await controlledMoneySession(c,port,settings({...stake,buyIn:stake.bigBlind*150}));
   for(let number=0;number<100;number++){
    if(cohort===0&&number===25){const game=structuredClone(c.data!.active!.game);await c.adjustBankroll(c.data!.wallet+12345,'Explicit external +$123.45',true);expect(c.data!.active!.game).toEqual(game);expect(c.data!.epoch).toBe(1);}
    if(number===32){const game=structuredClone(c.data!.active!.game);c=(await opened(port)).c;expect(c.data!.active!.game).toEqual(game);}
    await finish(c);reconcile(c);
    if(number===50){const before=c.data!.hands.reduce((sum,h)=>sum+h.net,0);await c.topUp(1234);expect(c.error).toBe('');expect(c.data!.hands.reduce((sum,h)=>sum+h.net,0)).toBe(before);reconcile(c);}
    if(number<99){await c.nextHand();expect(c.error).toBe('');}
    // Persistence uses promises but its in-memory work is synchronous. Yield so
    // the runner can deliver heartbeats during this deliberately populated run.
    if(number%10===9)await new Promise<void>(resolve=>setTimeout(resolve,0));
   }
   const expected=50*(stake.smallBlind+stake.bigBlind),group=c.data!.hands.slice(cohort*100,(cohort+1)*100);
   expect(group).toHaveLength(100);expect(group.reduce((sum,h)=>sum+h.net,0)).toBe(expected);
   oldRecords.push(JSON.stringify(group));await c.cashOut();expect(c.error).toBe('');reconcile(c);
  }
  const data=c.data!,stats=deriveCashStats(data.hands,data.sessions),expectedProfit=stakes.reduce((sum,s)=>sum+50*(s.smallBlind+s.bigBlind),0);
  expect(stats.profit).toBe(expectedProfit);expect(data.wallet).toBe(1000000+12345+expectedProfit);expect(stats.hands).toBe(200);
  expect(stats.bb100).toBeCloseTo(stakes.reduce((sum,s)=>sum+50*(s.smallBlind+s.bigBlind)/s.bigBlind,0)/2,12);
  expect(stats.mixedStakes).toBe(true);expect(stats.stakes).toHaveLength(2);
  for(let i=0;i<2;i++){expect(stats.stakes[i].hands).toBe(100);expect(stats.stakes[i].profit).toBe(50*(stakes[i].smallBlind+stakes[i].bigBlind));expect(JSON.stringify(data.hands.slice(i*100,(i+1)*100))).toBe(oldRecords[i]);}
  expect(data.ledger.filter(e=>e.kind==='top-up')).toHaveLength(2);expect(data.ledger.filter(e=>e.kind==='cash-out')).toHaveLength(2);expect(data.ledger.filter(e=>e.kind==='reset')).toHaveLength(1);
  expect(data.ledger.find(e=>e.kind==='reset')!.note).toBe('Explicit external +$123.45');expect(data.active).toBeNull();
 },120000);

 it('C10: switching from no rake to5%-cap stores both historical profiles and nets unchanged after subsequent reload',async()=>{
  foldBots=false;const setup=await opened();let c=setup.c;const {port}=setup;c=await controlledMoneySession(c,port,settings());await finish(c);await c.cashOut();
  const first=JSON.stringify(c.data!.hands[0]),priorStats=deriveCashStats(c.data!.hands,c.data!.sessions);
  c=await controlledMoneySession(c,port,settings({rakeMode:'custom',rakeBasisPoints:500,rakeCap:500}));await finish(c);expect(c.data!.hands[1].view.rake).toBe(20);
  expect(c.data!.hands[0].view.profile.rake.basisPoints).toBe(0);expect(c.data!.hands[1].view.profile.rake).toEqual({basisPoints:500,cap:500,noFlopNoDrop:true});
  await c.cashOut();const restored=(await opened(port)).c;expect(JSON.stringify(restored.data!.hands[0])).toBe(first);
  expect(deriveCashStats(restored.data!.hands.slice(0,1),restored.data!.sessions.slice(0,1)).profit).toBe(priorStats.profit);
  expect(restored.data!.hands.every(h=>/^0\.3\.0\+cfg\.[0-9a-f]{64}$/.test(h.view.profile.version))).toBe(true);expect(restored.data!.hands[0].view.profile.version).not.toBe(restored.data!.hands[1].view.profile.version);reconcile(restored);
 });
});
