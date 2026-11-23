import {afterEach,describe,expect,it,vi} from 'vitest';
import type {AppData,PersistencePort,StoredHand} from '../../src/session/types';
import type {HeroViewModel} from '../../src/contracts';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import * as decks from '../../src/core/deck';
import {appendMoney} from '../../src/storage/integrity';
import {auditSnapshot} from '../../src/storage/verified';
import {bothCardsRank,highHandQualifies,badBeatQualifies,highHandHours,badBeatIn,jackpotShares,jackpotBefore,roomHit,promoCredits,tokeFor,houseTake,highHandPrize,HIGH_HAND_HOUR,JACKPOT_BASE,JACKPOT_PER_HAND} from '../../src/session/promos';
import {promoBoard,houseTakeMarkup,tokeSelect} from '../../src/ui/promo-board';

class Memory implements PersistencePort {
 data:AppData|null=null;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,data:AppData){if(expected!==(this.data?.revision??null))throw Error('revision changed');this.data=structuredClone(data);}
 close(){}
}
const controllers:SessionController[]=[];
afterEach(()=>{controllers.splice(0).forEach(c=>c.close());});

type SeatSpec={id:number;name?:string;hole:string[];folded?:boolean;shown?:boolean};
function view(handId:string,board:string[],seats:SeatSpec[],payouts:Record<number,number>={},rake=0):HeroViewModel {
 return {handId,board,profile:{bigBlind:200,smallBlind:100} as HeroViewModel['profile'],payouts,rake,
  seats:seats.map(s=>({id:s.id,name:s.name??`Seat ${s.id}`,hole:s.hole,folded:!!s.folded,startingStack:20000,stack:20000})) as unknown as HeroViewModel['seats'],
  handLabels:Object.fromEntries(seats.filter(s=>s.shown).map(s=>[s.id,'shown'])) } as unknown as HeroViewModel;
}
function app(sessionHands:HeroViewModel[],ended=false,extraLedger:string[]=[]):AppData {
 const hands=sessionHands.map((v,i)=>({id:v.handId,sessionId:'s1',number:i+1,view:v,net:0} as unknown as StoredHand));
 return {sessions:[{id:'s1',endedAt:ended?'2026-11-21T00:00:00Z':null,settings:{bigBlind:200},handIds:hands.map(h=>h.id)}],hands,
  ledger:[...hands.map(h=>({id:`settle:${h.id}`,kind:'hand-net',handId:h.id,walletDelta:0})),...extraLedger.map(id=>({id,kind:'adjustment',walletDelta:100}))]} as unknown as AppData;
}
const blank=(n:number)=>view(`h${n}`,['2c','7d','9h','Js','4s'],[{id:0,hole:['3c','5d']},{id:1,hole:[]}]);

describe('Patch 70 promotion rules',()=>{
 it('needs both hole cards playing and the river dealt',()=>{
  expect(bothCardsRank(['Ah','Kd'],['Qs','Qd','Qc','Jh','Jd'])).toEqual([3,12,14,13]);// QQQ-A-K: with both cards playing it is only trips
  expect(highHandQualifies(bothCardsRank(['Ah','Kd'],['Qs','Qd','Qc','Jh','Jd']))).toBe(false);
  expect(highHandQualifies(bothCardsRank(['Ah','Ad'],['As','Kd','Kc','2h','7d']))).toBe(true);
  expect(bothCardsRank(['Ah','Ad'],['As','Kd','Kc','2h'])).toBeNull();
  expect(badBeatQualifies([6,14,10])).toBe(true);expect(badBeatQualifies([6,14,9])).toBe(false);expect(badBeatQualifies([7,2,3])).toBe(true);expect(badBeatQualifies([6,13,12])).toBe(false);
  expect(highHandPrize(200)).toBe(10000);expect(highHandPrize(1000)).toBe(50000);
 });
 it('picks the best shown hand of each hour, ignores hidden cards, keeps the first of equal hands, and closes hours',()=>{
  const hands=Array.from({length:HIGH_HAND_HOUR+3},(_,i)=>blank(i));
  hands[3]=view('h3',['Ks','Kd','7c','2h','9d'],[{id:0,hole:['Kh','7d']},{id:2,name:'Mike',hole:['9c','9h'],shown:true}]);// Hero kings full beats Mike's nines full
  hands[5]=view('h5',['Ks','Kd','7c','2h','9d'],[{id:0,hole:['Kh','7d'],folded:true},{id:3,name:'Ann',hole:['Kc','7s'],shown:true}]);// equal: Hero keeps it
  hands[8]=view('h8',['Qs','Qd','2c','2h','9d'],[{id:0,hole:['3c','4d']},{id:4,name:'Hidden',hole:['Qc','Qh']}]);// quads not shown: does not count
  const hours=highHandHours(app(hands),'s1');
  expect(hours).toHaveLength(2);expect(hours[0].closed).toBe(true);expect(hours[1].closed).toBe(false);
  expect(hours[0].leader).toMatchObject({seatId:0,name:'You',handId:'h3'});
  expect(highHandHours(app(hands,true),'s1')[1].closed).toBe(true);
  const credits=promoCredits(app(hands),'s1');
  expect(credits).toHaveLength(1);expect(credits[0]).toMatchObject({id:'promo:high-hand:s1:0',cents:10000});
  expect(promoCredits(app(hands,false,['promo:high-hand:s1:0']),'s1')).toEqual([]);
  hands[10]=view('h10',['Qs','Qd','2c','2h','9d'],[{id:0,hole:['3c','4d']},{id:4,name:'Mike',hole:['Qc','Qh'],shown:true}]);
  expect(highHandHours(app(hands),'s1')[0].leader).toMatchObject({name:'Mike',seatId:4});expect(promoCredits(app(hands),'s1')).toEqual([]);
 });
 it('finds a bad beat only at showdown and splits the jackpot half, quarter, quarter',()=>{
  const v=view('bb',['As','Ad','Th','9h','8h'],[{id:0,hole:['Ac','Ts'],shown:true},{id:1,name:'Lou',hole:['Qh','Jh'],shown:true},{id:2,hole:[]},{id:3,hole:[]}]);
  const beat=badBeatIn(v)!;expect(beat).not.toBeNull();expect(beat.loser.seatId).toBe(0);expect(beat.winner.seatId).toBe(1);
  const shares=jackpotShares(1_000_001,beat);expect(shares[0]).toBe(500000);expect(shares[1]).toBe(250000);expect(shares[2]).toBe(shares[3]);
  expect(Object.values(shares).reduce((a,b)=>a+b,0)).toBeLessThanOrEqual(1_000_001);
  expect(badBeatIn(view('nb',['As','Ad','Th','9h','8h'],[{id:0,hole:['Ac','Ts'],shown:true},{id:1,hole:['Qh','Jh']}]))).toBeNull();// winner not shown
 });
 it('grows the jackpot with every hand and resets after a hit here or in the room',()=>{
  const hands=Array.from({length:5},(_,i)=>blank(i));
  expect(jackpotBefore(app(hands)).amount).toBe(JACKPOT_BASE+5*JACKPOT_PER_HAND);
  expect(jackpotBefore(app(hands),'h2').amount).toBe(JACKPOT_BASE+2*JACKPOT_PER_HAND);
  expect(jackpotBefore(app(hands,false,['promo:bad-beat:h2'])).amount).toBe(JACKPOT_BASE+2*JACKPOT_PER_HAND);
  let id='';for(let i=0;!id&&i<400000;i++)if(roomHit(`r${i}`))id=`r${i}`;expect(id).not.toBe('');
  const withRoom=[blank(0),view(id,['2c','7d','9h','Js','4s'],[{id:0,hole:['3c','5d']}]),blank(2)];
  expect(jackpotBefore(app(withRoom))).toMatchObject({handsSinceHit:1,lastHit:{handId:id,where:'room'}});
 });
 it('tokes like a live player, never on tiny or lost pots',()=>{
  expect(tokeFor('off',100000,200)).toBe(0);expect(tokeFor('one',800,200)).toBe(100);expect(tokeFor('one',1000,200)).toBe(100);
  expect(tokeFor('regular',5000,200)).toBe(100);expect(tokeFor('regular',6000,200)).toBe(200);expect(tokeFor('regular',20000,200)).toBe(500);expect(tokeFor('regular',0,200)).toBe(0);
 });
 it('assigns main-pot rake only to its winners when Hero wins a side pot',()=>{
  const v=view('side',[],[{id:0,hole:[]},{id:1,hole:[]},{id:2,hole:[]}],{0:400,2:240},60);
  v.seats.forEach((s,i)=>{s.totalCommitted=i===2?100:300;});
  v.pots=[{amount:240,eligible:[0,1,2],winners:[2]},{amount:400,eligible:[0,1],winners:[0]}];
  expect(houseTake(app([v]).hands,[]).rake).toBe(0);
 });
 it('shows the board and what the house takes',()=>{
  const hands=Array.from({length:25},(_,i)=>{const v=blank(i);(v as {payouts:Record<number,number>}).payouts=i%2?{0:2000}:{1:2000};(v as {rake:number}).rake=100;return v;});
  const data=app(hands);(data.hands as StoredHand[]).forEach((h,i)=>{(h as {net:number}).net=i%2?1000:-1000;});
  const html=promoBoard(data,'s1','');expect(html).toContain('HIGH HAND $100');expect(html).toContain('5 hands left');expect(html).toContain('BAD BEAT $15,');
  const t=houseTake(data.hands,data.ledger);expect(t.potsWon).toBe(12);expect(t.rake).toBe(1200);expect(t.bbPer100Before-t.bbPer100After).toBeCloseTo(t.rakePer100,5);
  expect(houseTakeMarkup(data,'one')).toContain('Rake from pots you won (12)');expect(tokeSelect('regular')).toMatch(/value="regular" selected/);
 });
});

describe('Patch 70 ledger: promotions and tokes are wallet money, never poker results',()=>{
 async function played(){const c=new SessionController(new Memory());controllers.push(c);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:2});
  for(let h=0;h<3;h++){for(let i=0;i<60&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;if(g.actor===0)await c.act({type:'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}}if(h<2)await c.nextHand();}
  expect(c.error).toBe('');return c;}
 it('records a session\'s tokes once, after the session, without touching poker results',async()=>{
  const order=['Ac','Qh','Ts','Jh','2c','As','Ad','Th','3c','9h','4c','8h'];
  const deck=[...order,...decks.standardDeck().filter(card=>!order.includes(card))];
  vi.spyOn(decks,'secureDeck').mockReturnValueOnce(deck);
  const port=new Memory(),c=new SessionController(port);controllers.push(c);await c.init();
  c.dealerTipPolicy='one';
  await c.startSession({...DEFAULT_SETTINGS,seats:2});const sid=c.data!.active!.sessionId;
  while(c.data!.active!.game.street!=='complete'){
   const g=c.data!.active!.game;
   if(g.actor===0)await c.act({type:g.currentBet>g.seats[0].streetCommitted?'call':'check'},g.handId,g.revision);
   else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}
   expect(c.error).toBe('');
  }
  const hand=c.data!.hands[0];expect(badBeatIn(hand.view)?.winner.seatId).toBe(0);
  expect(c.data!.ledger.find(e=>e.id==='promo:bad-beat:'+hand.id)?.walletDelta).toBe(JACKPOT_BASE/4);
  expect(c.data!.active!.dealerTips?.cents).toBe(100);
  c.close();const resumed=new SessionController(port);controllers.push(resumed);await resumed.init();expect(resumed.error).toBe('');
  const pre=resumed.data!,expected=pre.wallet+pre.active!.game.seats[0].stack+10000-100;
  await resumed.cashOut();expect(resumed.error).toBe('');expect(resumed.data!.wallet).toBe(expected);
  await resumed.cashOut();expect(resumed.data!.ledger.filter(e=>e.id==='toke:'+sid)).toHaveLength(1);
  expect(resumed.data!.ledger.filter(e=>e.id.startsWith('promo:'))).toHaveLength(2);
  expect(resumed.data!.ledger.filter(e=>e.id==='toke:'+sid||e.id.startsWith('promo:')).every(e=>e.pokerNet===0)).toBe(true);
  expect(resumed.data!.wallet).toBe(expected);await auditSnapshot(structuredClone(resumed.data!));
 },120000);
 it('a promotion payout with a fixed id passes the saved-data audit and cannot be paid twice',async()=>{
  const c=await played(),sid=c.data!.active!.sessionId;await c.cashOut();const d=structuredClone(c.data!);
  await appendMoney(d,{id:`promo:high-hand:${sid}:0`,kind:'adjustment',at:new Date().toISOString(),epoch:d.epoch,walletDelta:10000,tableDelta:0,pokerNet:0,sessionId:sid,note:'High-hand bonus'});
  await auditSnapshot(structuredClone(d));
  await expect(appendMoney(d,{id:`promo:high-hand:${sid}:0`,kind:'adjustment',at:new Date().toISOString(),epoch:d.epoch,walletDelta:10000,tableDelta:0,pokerNet:0,sessionId:sid,note:'again'})).rejects.toThrow(/Duplicate/);
 },120000);
});
