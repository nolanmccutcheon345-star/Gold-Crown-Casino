/** Test-only fixture writer. Runs the exact previously published controller,
 * engine and storage validation; never imports the production UI or database. */
import { vi } from 'vitest';
import { SessionController } from './frozen-v3/src/session/controller';
import type { AppData, CashSettings, PersistencePort } from './frozen-v3/src/session/types';
import type { Action, Card, GameState } from './frozen-v3/src/contracts';
import { legalActions, projectView } from './frozen-v3/src/core/engine';
import * as policy from './frozen-v3/src/bots/policy';

export type Street = 'preflop'|'flop'|'turn'|'river';
export type PopulatedFixture = {format:'test-only-private-device-fixture';sourceCommit:string;expected:{wallet:number;pokerNet:number;rake:number};streets:Record<Street,AppData>};
class OldMemory implements PersistencePort {
 data:AppData|null=null;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,next:AppData){
  if((this.data?.revision??null)!==expected)throw new Error('Fixture revision mismatch');
  this.data=structuredClone(next);
 }
 close(){}
}
const settings=(patch:Partial<CashSettings>={}):CashSettings=>({seats:2,stake:'0',smallBlind:100,bigBlind:200,buyIn:20000,
 archetypes:['station'],rakeMode:'none',rakeBasisPoints:500,rakeCap:500,noFlopNoDrop:true,minBuyInBB:1,maxBuyInBB:1000,allowTopUp:true,...patch});
function ready(c:SessionController):void{if(c.error||c.status!=='ready')throw new Error(c.error||`Fixture ${c.status}`);}
async function hero(c:SessionController,action:Action){const g=c.data!.active!.game;await c.act(action,g.handId,g.revision);ready(c);}
async function bot(c:SessionController){const g=c.data!.active!.game;await c.prepareBot();ready(c);await c.commitBot(g.handId,g.revision);ready(c);}
async function finish(c:SessionController){
 for(let n=0;c.data!.active!.game.street!=='complete'&&n<50;n++){
  const g=c.data!.active!.game;if(g.actor===0)await hero(c,legalActions(g).check?{type:'check'}:{type:'call'});else await bot(c);
 }
 if(c.data!.active!.game.street!=='complete')throw new Error('Fixture failed to terminate');
}
function rigKnownWinner(state:GameState):GameState {
 const copy=structuredClone(state);const holes:Card[][]=[['As','Ah'],['Ks','Kh']];const board=['2c','3d','7s','8c','9h'];
 const reserved=[...holes.flat(),...board];const unused=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(c=>!reserved.includes(c));
 const burns=unused.splice(0,3);copy.seats.forEach((seat,i)=>{seat.hole=holes[i];});
 copy.deck=[...holes.flat(),burns[0],...board.slice(0,3),burns[1],board[3],burns[2],board[4],...unused];copy.deckCursor=4;return copy;
}

export async function buildPopulatedV3Fixture():Promise<PopulatedFixture>{
 // Seeded entropy is confined to this test writer. The application retains CSPRNG.
 let seed=0x36ab91;
 const draw=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;};
 vi.stubGlobal('crypto',{getRandomValues:(array:Uint8Array|Uint32Array)=>{for(let n=0;n<array.length;n++)array[n]=draw();return array;}});
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-31T12:00:00.000Z'));
 const original=policy.chooseDecision;
 const spy=vi.spyOn(policy,'chooseDecision').mockImplementation((obs,profile,random)=>({...original(obs,profile,random),action:obs.legal.check?{type:'check'}:{type:'call'}}));
 const port=new OldMemory();let c=new SessionController(port);
 try{
  await c.init();ready(c);await c.adjustBankroll(150000,'Fixture baseline $1500');ready(c);
  await c.startSession(settings());ready(c);await hero(c,{type:'fold'});
  await c.topUp(100);ready(c);await c.nextHand();ready(c);await bot(c);await hero(c,{type:'fold'});
  await c.cashOut();ready(c);if(c.data!.wallet!==149700)throw new Error('Session 1 reference mismatch');
  await c.adjustBankroll(199700,'External +$500');ready(c);
  await c.startSession(settings({stake:'2',smallBlind:200,bigBlind:500,buyIn:50000,rakeMode:'custom'}));ready(c);
  // Sealed-state fixture rig is strictly test-only, before any voluntary action.
  port.data!.active!.game=rigKnownWinner(port.data!.active!.game);port.data!.active!.frames=[projectView(port.data!.active!.game,0)];
  c.close();c=new SessionController(port);await c.init();ready(c);await finish(c);
  if(c.data!.hands.at(-1)!.net!==450||c.data!.hands.at(-1)!.view.rake!==50)throw new Error('Raked hand reference mismatch');
  await c.topUp(550);ready(c);await c.cashOut();ready(c);
  if(Number(c.data!.wallet)!==200150)throw new Error('Session 2 reference mismatch');
  await c.adjustBankroll(200000,'External -$1.50');ready(c);
  // Existing public study shelf must survive v3 migration without entering P&L.
  await c.importHistory(JSON.stringify(await c.exportHistory()));ready(c);
  await c.startSession(settings({buyIn:10000}));ready(c);await hero(c,{type:'call'});
  const streets={} as Record<Street,AppData>;
  for(const street of ['preflop','flop','turn','river'] as const){
   if(c.data!.active!.game.street!==street||c.data!.active!.game.actor!==1)throw new Error(`Fixture expected ${street} bot turn`);
   await c.prepareBot();ready(c);streets[street]=structuredClone(c.data!);
   if(street!=='river'){
    await bot(c);
    if(street!=='preflop')await hero(c,{type:'check'});
   }
  }
  return {format:'test-only-private-device-fixture',sourceCommit:'e5653b557225d57b392625487066c116adccd05c',expected:{wallet:190000,pokerNet:150,rake:50},streets};
 }finally{c.close();spy.mockRestore();vi.unstubAllGlobals();vi.useRealTimers();}
}
