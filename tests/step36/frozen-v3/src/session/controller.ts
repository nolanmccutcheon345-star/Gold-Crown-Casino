import type { Action, BotProfile, RuleProfile } from '../contracts';
import { applyCommand, assertAccounting, nextHand as dealNextHand, observeBot, projectView, startHand, topUpTable } from '../core/engine';
import { chooseDecision, defaultProfile, POLICY_VERSION } from '../bots/policy';
import { newHandId } from '../identity';
import { BrowserPersistence } from '../storage/browser';
import { appendMoney, canonical, cents, GENESIS, parsePublicHistory, publicHistory, requireData, seal, validateData } from '../storage/integrity';
import type { AppData, CashSettings, PersistencePort, PublicHistory, StoredHand } from './types';
export const DEFAULT_SETTINGS:CashSettings={seats:6,stake:'0',smallBlind:100,bigBlind:200,buyIn:20000,archetypes:['tag','station','nit','lag','passive-reg','fit-or-fold','stronger-reg','maniac','tag'],rakeMode:'none',rakeBasisPoints:500,rakeCap:300,noFlopNoDrop:true,minBuyInBB:1,maxBuyInBB:500,allowTopUp:true};
const NAMES=['You','Alex','Morgan','Jordan','Riley','Casey','Taylor','Drew','Quinn','Sam'];
const id=(kind:string)=>`${kind}:${newHandId()}`;
const now=()=>new Date().toISOString();
function seeded(token:number):()=>number {let state=token>>>0;return()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
export function rules(settings:CashSettings):RuleProfile{return{id:'practice-cash',version:'0.3.0',mode:'cash',smallBlind:settings.smallBlind,bigBlind:settings.bigBlind,chipUnit:1,rake:{basisPoints:settings.rakeMode==='custom'?settings.rakeBasisPoints:0,cap:settings.rakeMode==='custom'?settings.rakeCap:0,noFlopNoDrop:settings.noFlopNoDrop},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};}
export class SessionController {
 data:AppData|null=null;
 status:'loading'|'ready'|'readonly'|'error'='loading';
 error='';busy=false;
 private listeners=new Set<()=>void>();
 private failed:{expected:number|null;next:AppData}|null=null;
 private clock:ReturnType<typeof setInterval>|null=null;
 private lastTick=Date.now();
 private visible=true;
 constructor(private port:PersistencePort=new BrowserPersistence()){}
 subscribe(fn:()=>void):()=>void{this.listeners.add(fn);return()=>this.listeners.delete(fn);}
 private emit(){this.listeners.forEach(fn=>fn());}
 private owns():boolean{return this.port.writable!==false;}
 async init():Promise<void>{
  this.busy=true;this.status='loading';this.emit();
  try{
   this.data=await this.port.load();
   if(!this.owns()){this.status='readonly';this.error='Another tab owns this session. Close it, then Retry to continue here.';return;}
   if(!this.data){
    const initial:AppData={schemaVersion:3,revision:0,epoch:0,wallet:0,initialBankroll:1000000,ledger:[],sessions:[],hands:[],active:null,importedHands:[]};
    await appendMoney(initial,{id:id('initial'),at:now(),epoch:0,kind:'adjustment',walletDelta:1000000,tableDelta:0,pokerNet:0,note:'Initial virtual bankroll'});
    await this.persist(null,initial);
   }else{await validateData(this.data);this.status='ready';}
   this.error='';this.startClock();
  }catch(e){this.error=(e as Error).message;this.status='error';}
  finally{this.busy=false;this.emit();}
 }
 private startClock():void{
  this.lastTick=Date.now();
  if(typeof document==='undefined')return;
  this.visible=document.visibilityState!=='hidden';
  document.addEventListener('visibilitychange',this.visibilityChanged);
  window.addEventListener('pagehide',this.pageHide);
  window.addEventListener('pageshow',this.pageShow);
  if(!this.clock)this.clock=setInterval(()=>{void this.tick();},5000);
 }
 private pageShow=(event:PageTransitionEvent)=>{if(event.persisted)window.location.reload();};
 private visibilityChanged=()=>{this.visible=document.visibilityState!=='hidden';this.lastTick=Date.now();};
 private pageHide=()=>{this.close();window.addEventListener('pageshow',this.pageShow,{once:true});};
 close():void{if(this.clock)clearInterval(this.clock);this.clock=null;if(typeof document!=='undefined'){document.removeEventListener('visibilitychange',this.visibilityChanged);window.removeEventListener('pagehide',this.pageHide);window.removeEventListener('pageshow',this.pageShow);}this.port.close();}
 private accountClock(d:AppData):void{
  const time=Date.now();const delta=Math.max(0,Math.min(time-this.lastTick,10000));this.lastTick=time;
  if(d.active){const session=d.sessions.find(s=>s.id===d.active!.sessionId)!;if(this.visible&&!d.active.paused)session.activeMs+=delta;session.lastActiveAt=null;}
 }
 async tick():Promise<void>{if(!this.data?.active||!this.visible||this.data.active.paused){this.lastTick=Date.now();return;}await this.mutate(async()=>{},true);}
 private async persist(expected:number|null,next:AppData):Promise<void>{
  await validateData(next);this.failed={expected,next:structuredClone(next)};
  try{await this.port.commit(expected,next);this.data=next;this.failed=null;this.status='ready';}
  catch(e){this.status=/another tab|revision changed|ownership/i.test((e as Error).message)?'readonly':'error';throw e;}
 }
 private async mutate(change:(candidate:AppData)=>Promise<void>,quiet=false):Promise<void>{
  if(this.busy||this.status!=='ready'||!this.data)return;
  this.busy=true;if(!quiet)this.emit();this.error='';
  try{const next=structuredClone(this.data);this.accountClock(next);await change(next);
   // A duplicate/no-op does not create a new financial event, even if clock time saves.
   next.revision=this.data.revision+1;await this.persist(this.data.revision,next);
  }catch(e){this.error=(e as Error).message;}
  finally{this.busy=false;if(!quiet||this.error)this.emit();}
 }
 async retry():Promise<void>{
  if(this.busy)return;this.busy=true;this.emit();
  try{
   const latest=await this.port.load();
   requireData(this.owns(),'Another tab owns this session. Close it before retrying.');
   if(this.failed){
    if(latest&&canonical(latest)===canonical(this.failed.next)){this.data=latest;this.failed=null;}
    else if((latest?.revision??null)===this.failed.expected){await this.persist(this.failed.expected,this.failed.next);}
    else{this.failed=null;this.data=latest;requireData(latest,'Saved state missing.');}
   }else{this.data=latest;}
   if(!this.data){this.busy=false;await this.init();return;}
   await validateData(this.data);this.startClock();this.status='ready';this.error='';
  }catch(e){this.error=(e as Error).message;this.status=/another tab|revision changed|ownership/i.test(this.error)?'readonly':'error';}
  finally{this.busy=false;this.emit();}
 }
 async takeOver():Promise<void>{
  if(this.busy)return;
  if(!this.port.takeOver){await this.retry();return;}
  this.busy=true;this.emit();
  try{await this.port.takeOver();this.failed=null;this.data=await this.port.load();requireData(this.data,'Saved state missing. Retry initialization.');await validateData(this.data);this.status='ready';this.error='';this.startClock();}
  catch(e){this.status='error';this.error=(e as Error).message;}
  finally{this.busy=false;this.emit();}
 }
 async adjustBankroll(targetCents:number,note:string,reset=false):Promise<void>{await this.mutate(async d=>{
  requireData(cents(targetCents)&&targetCents<=1e12,'Choose a virtual bankroll between $0 and $10 billion.');
  requireData(typeof note==='string'&&note.trim().length>0&&note.length<=200,'Enter a short adjustment reason.');
  if(reset){d.epoch++;d.initialBankroll=targetCents;}
  await appendMoney(d,{id:id(reset?'reset':'adjustment'),kind:reset?'reset':'adjustment',at:now(),epoch:d.epoch,walletDelta:targetCents-d.wallet,tableDelta:0,pokerNet:0,note:note.trim()});
 });}
 async startSession(settings:CashSettings):Promise<void>{await this.mutate(async d=>{
  requireData(!d.active,'Cash out the existing session before starting another.');
  requireData(Number.isInteger(settings.seats)&&settings.seats>=2&&settings.seats<=10,'Choose 2–10 seats.');
  requireData(cents(settings.minBuyInBB)&&settings.minBuyInBB>=1&&cents(settings.maxBuyInBB)&&settings.maxBuyInBB>=settings.minBuyInBB&&settings.maxBuyInBB<=10000,'Invalid table buy-in limits.');
  requireData(cents(settings.buyIn)&&settings.buyIn>=settings.minBuyInBB*settings.bigBlind&&settings.buyIn<=settings.maxBuyInBB*settings.bigBlind,'Buy-in is outside the configured table limits.');
  requireData(settings.buyIn<=d.wallet,'Insufficient wallet funds. Adjust your virtual bankroll in Cashier.');
  const sessionId=id('session');const timestamp=now();
  const profiles:Record<number,BotProfile>={};for(let seat=1;seat<settings.seats;seat++)profiles[seat]=defaultProfile(settings.archetypes[seat-1]??'tag');
  const profile=rules(settings);const game=startHand({handId:newHandId(),seats:Array.from({length:settings.seats},(_,seat)=>({id:seat,name:NAMES[seat],stack:settings.buyIn})),button:0,profile});
  d.sessions.push({id:sessionId,epoch:d.epoch,startedAt:timestamp,endedAt:null,settings:structuredClone(settings),profile,buyIns:settings.buyIn,cashOut:0,activeMs:0,lastActiveAt:null,handIds:[]});
  d.active={sessionId,game,profiles,number:1,startedAt:timestamp,frames:[projectView(game,0)],paused:false,pending:null};
  await appendMoney(d,{id:`buy-in:${sessionId}`,kind:'buy-in',at:timestamp,epoch:d.epoch,walletDelta:-settings.buyIn,tableDelta:settings.buyIn,pokerNet:0,sessionId,note:'Wallet to table'});
  await this.settle(d);
 });}
 async topUp(amount:number):Promise<void>{await this.mutate(async d=>{
  const a=d.active;requireData(a&&a.game.street==='complete','Finish the hand before adding chips.');const s=d.sessions.find(s=>s.id===a.sessionId)!;
  requireData(s.settings.allowTopUp,'Top-ups are disabled for this table.');requireData(cents(amount)&&amount>0&&amount<=d.wallet,'Choose a positive top-up within wallet funds.');
  const transferId=id('top-up');a.game=topUpTable(a.game,0,amount,transferId,s.settings.maxBuyInBB*s.profile.bigBlind);
  s.buyIns+=amount;
  await appendMoney(d,{id:transferId,kind:'top-up',at:now(),epoch:d.epoch,walletDelta:-amount,tableDelta:amount,pokerNet:0,sessionId:s.id,note:'Wallet to table; next-hand chips'});
 });}
 async cashOut():Promise<void>{await this.mutate(async d=>{
  if(!d.active)return;const a=d.active;requireData(a.game.street==='complete','Finish the active hand before cashing out.');
  const s=d.sessions.find(s=>s.id===a.sessionId)!;const amount=a.game.seats.find(s=>s.id===0)!.stack;
  await appendMoney(d,{id:`cash-out:${s.id}`,kind:'cash-out',at:now(),epoch:d.epoch,walletDelta:amount,tableDelta:-amount,pokerNet:0,sessionId:s.id,note:'Table to wallet'});
  s.cashOut=amount;s.endedAt=now();s.lastActiveAt=null;d.active=null;
 });}
 async nextHand():Promise<void>{await this.mutate(async d=>{
  const a=d.active;requireData(a&&a.game.street==='complete','Finish the current hand first.');requireData(a.game.seats.find(s=>s.id===0)!.stack>0,'Add chips or cash out before dealing.');
  a.game=dealNextHand(a.game,newHandId());a.number++;a.startedAt=now();a.frames=[projectView(a.game,0)];a.pending=null;a.paused=false;await this.settle(d);
 });}
 async act(action:Action,handId:string,revision:number):Promise<void>{await this.mutate(async d=>{
  const a=d.active;requireData(a&&!a.paused&&a.game.actor===0,'Action is not on Hero.');requireData(a.game.handId===handId&&a.game.revision===revision,'Obsolete action rejected.');
  a.game=applyCommand(a.game,{handId,revision,seatId:0,decisionId:`hero:${handId}:${revision}`,action});a.frames.push(projectView(a.game,0));await this.settle(d);
 });}
 async setPaused(paused:boolean):Promise<void>{await this.mutate(async d=>{if(d.active)d.active.paused=paused;});}
 async prepareBot():Promise<void>{
  await this.mutate(async d=>{
   const a=d.active;requireData(a&&!a.paused&&a.game.actor!==null&&a.game.actor!==0,'No bot action is pending.');
   if(a.pending)return;const actor=a.game.actor;const p=a.profiles[actor];requireData(p&&p.policyVersion===POLICY_VERSION,'This saved policy version is unavailable. The table has been preserved.');
   const drawToken=crypto.getRandomValues(new Uint32Array(1))[0];
   a.pending={handId:a.game.handId,revision:a.game.revision,seatId:actor,decisionId:`bot:${a.game.handId}:${a.game.revision}:${actor}`,policyVersion:p.policyVersion,drawToken,decision:null};
  });
  if(this.status!=='ready'||!this.data?.active?.pending||this.data.active.pending.decision)return;
  await this.mutate(async d=>{
   const a=d.active!;const p=a.pending!;
   const observation=observeBot(a.game,p.seatId,p.policyVersion,p.decisionId);
   p.decision=chooseDecision(observation,a.profiles[p.seatId],seeded(p.drawToken));
  });
 }
 async commitBot(handId:string,revision:number):Promise<void>{await this.mutate(async d=>{
  const a=d.active;requireData(a&&!a.paused&&a.game.handId===handId&&a.game.revision===revision,'Obsolete bot callback rejected.');
  const p=a.pending;requireData(p?.decision&&p.handId===handId&&p.revision===revision&&p.policyVersion===a.profiles[p.seatId]?.policyVersion,'Bot decision was not durably prepared.');
  a.game=applyCommand(a.game,p.decision);a.pending=null;a.frames.push(projectView(a.game,0));await this.settle(d);
 });}
 private async settle(d:AppData):Promise<void>{
  const a=d.active;if(!a||a.game.street!=='complete'||d.hands.some(h=>h.id===a.game.handId))return;
  assertAccounting(a.game);const view=projectView(a.game,0);const hero=view.seats.find(s=>s.id===0)!;const net=hero.stack-hero.startingStack;const endedAt=now();
  const record:StoredHand={id:a.game.handId,sessionId:a.sessionId,epoch:d.sessions.find(s=>s.id===a.sessionId)!.epoch,number:a.number,startedAt:a.startedAt,endedAt,view,frames:structuredClone(a.frames),net,privateProfiles:structuredClone(a.profiles),previousHash:d.hands.at(-1)?.hash??GENESIS,hash:''};
  d.hands.push(await seal(record));d.sessions.find(s=>s.id===a.sessionId)!.handIds.push(record.id);a.pending=null;
  await appendMoney(d,{id:`settle:${record.id}`,kind:'hand-net',at:endedAt,epoch:record.epoch,walletDelta:0,tableDelta:net,pokerNet:net,sessionId:a.sessionId,handId:record.id,note:'Settled hand net after rake; refunds included'});
 }
 async exportHistory():Promise<PublicHistory>{requireData(this.data,'No saved history available.');return publicHistory(this.data.hands);}
 async importHistory(text:string):Promise<void>{await this.mutate(async d=>{
  const imported=await parsePublicHistory(text);const known=new Set(d.importedHands.map(h=>h.handId));
  d.importedHands.push(...imported.filter(h=>!known.has(h.handId)));
 });}
 async protectStorage():Promise<boolean>{return this.port instanceof BrowserPersistence?this.port.requestProtection():false;}
}
