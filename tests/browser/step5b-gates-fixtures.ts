import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {applyCommand,assertAccounting,legalActions,projectView} from '../../src/core/engine';
import {validateData} from '../../src/storage/integrity';
import type {Action} from '../../src/contracts';
import type {AppData,CashSettings,PersistencePort} from '../../src/session/types';

export type GateCase='layout-preflop'|'layout-flop'|'facing-raise'|'stake'|'short-jam'|'raise-closed'|'mixed-granularity'|'keyboard'|'side-pot';
export interface GateFixtureSpec {kind:GateCase;seats:number;smallBlind?:number;bigBlind?:number;buyIn?:number;chipUnit?:number;street?:'preflop'|'flop';}
export class GateMemoryPort implements PersistencePort {
 data:AppData|null=null;commits=0;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,next:AppData){if((this.data?.revision??null)!==expected)throw Error('Isolated gate revision conflict');this.data=structuredClone(next);this.commits++;}
 close(){}
}
function demand(condition:unknown,message:string):asserts condition {if(!condition)throw Error(message);}
/** Test-only: an ordinary CSPRNG hand followed exclusively by legal engine
 * commands. No cards, chips, pots, legal flags or payouts are assigned by UI. */
export async function buildGateFixture(spec:GateFixtureSpec){
 const port=new GateMemoryPort(),seed=new SessionController(port);await seed.init();
 await seed.adjustBankroll(10000000,'Isolated browser fixture capital; not poker winnings');
 const smallBlind=spec.smallBlind??100,bigBlind=spec.bigBlind??200,buyIn=spec.buyIn??30000;
 const settings:CashSettings={...DEFAULT_SETTINGS,seats:spec.seats,capacity:spec.seats,smallBlind,bigBlind,buyIn,stake:'custom',chipUnit:spec.chipUnit??1,opponents:Array.from({length:spec.seats-1},(_,i)=>({selection:'tag',personalitySeed:100+i}))};
 if(spec.kind==='short-jam')settings.seatStacks={0:700};
 if(spec.kind==='raise-closed')settings.seatStacks={1:700};
 if(spec.kind==='side-pot')settings.seatStacks={3:600,5:1800};
 await seed.startSession(settings);demand(!seed.error,seed.error);
 const data=structuredClone(seed.data!);seed.close();const active=data.active!;
 const starting=structuredClone(active.game),prefix:{seatId:number;street:string;action:Action}[]=[];
 const act=(action:Action)=>{const game=active.game,seatId=game.actor!;prefix.push({seatId,street:game.street,action});active.game=applyCommand(game,{handId:game.handId,revision:game.revision,seatId,decisionId:`gate:${game.revision}`,action});active.frames.push(projectView(active.game,0));};
 if(spec.kind==='short-jam'){act({type:'call'});act({type:'raise',to:600});act({type:'call'});}
 else if(spec.kind==='raise-closed'){act({type:'raise',to:600});act({type:'raise',to:700});act({type:'call'});}
 else if(spec.kind==='mixed-granularity'){act({type:'raise',to:900});act({type:'raise',to:2700});act({type:'call'});}
 else{
  if(spec.kind==='side-pot'){act({type:'raise',to:600});act({type:'raise',to:1800});}
  if(spec.kind==='facing-raise'||spec.kind==='keyboard'){demand(spec.seats===10,'Facing-raise fixture requires ten seats');act({type:'raise',to:bigBlind*3});}
  for(let i=0;i<100;i++){
   if(active.game.actor===0&&((spec.kind!=='layout-flop'&&spec.street!=='flop')||active.game.street==='flop'))break;
   const legal=legalActions(active.game);act(legal.check?{type:'check'}:{type:'call'});
  }
 }
 demand(active.game.actor===0,'Fixture must stop with Hero acting');assertAccounting(active.game);await validateData(data);port.data=data;
 return{port,data,starting,prefix,settings};
}
