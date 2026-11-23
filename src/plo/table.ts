/** Patch 74: a Pot-Limit Omaha cash table. Its own virtual balance (like tournaments and blackjack), kept on this
 * device. Every step re-checks that chips are conserved; a save that fails its checks is set aside, never trusted. */
import {personaFor} from '../bots/personas';
import {gestureFor,heroQuestionLine,lineToHero,rivalPair,smallTalk} from '../bots/banter';
import type {Card} from '../contracts';
import {secureDeck,secureIndex} from '../core/deck';
import {applyPlo,assertChips,legalPlo,ploView,startPloHand,type PloAction,type PloHand} from './engine';
import {PLO_PLAYERS,ploDecide,ploDecideDetailed,ploPlayer,type PloPersonality} from './bots';
import {EMPTY_READS,line,nextMood,shownAtShowdown,thinkTime,updateReads,type PloMoodState,type PloReads,type Tempo} from './human';
import {omahaRank} from './engine';
import {actorLine} from '../ui/replayer';

export const PLO_KEY='poker-night-ai:plo';
export const PLO_START_BALANCE=500_000;
export interface PloStakes {id:string;label:string;smallBlind:number;bigBlind:number}
export const PLO_STAKES:readonly PloStakes[]=[{id:'1-2',label:'$1/$2 PLO',smallBlind:100,bigBlind:200},{id:'2-5',label:'$2/$5 PLO',smallBlind:200,bigBlind:500},{id:'5-10',label:'$5/$10 PLO',smallBlind:500,bigBlind:1000}];
export interface PloHandRecord {id:string;number:number;at:string;stakes:string;hole:Card[];board:Card[];net:number;won:number;summary:string[];shown:{name:string;hole:Card[];label:string}[]}
export interface PloSession {id:string;stakes:string;startedAt:string;endedAt:string|null;buyIns:number;cashOut:number;hands:number}
export interface PloTalk {seatId:number;text:string;hand:number}
export interface PloActive {sessionId:string;stakes:PloStakes;players:Record<number,string>;stacks:Record<number,number>;hand:PloHand;number:number;button:number;
 /** Patch 75: moods by seat, and the last few things said at the table. */
 moods?:Record<number,PloMoodState>;talk?:PloTalk[]}
export interface PloState {version:1;balance:number;sessions:PloSession[];hands:PloHandRecord[];active:PloActive|null;
 /** Patch 75: how the Omaha table has seen you play, across sessions. */
 reads?:PloReads}

const now=()=>new Date().toISOString();
const id=(p:string)=>`${p}-${Date.now().toString(36)}-${secureIndex(0x7fffffff).toString(36)}`;
const rnd=(n:number)=>secureIndex(n);

export function freshPlo():PloState {return {version:1,balance:PLO_START_BALANCE,sessions:[],hands:[],active:null};}
/** Checks a saved state. Throws a plain message when anything does not hold. */
export function checkPlo(v:unknown):PloState {
 const s=v as PloState;
 if(!s||s.version!==1||!Number.isSafeInteger(s.balance)||s.balance<0||!Array.isArray(s.sessions)||!Array.isArray(s.hands))throw new Error('The Omaha save is not valid.');
 if(s.active){
  const a=s.active;if(!PLO_STAKES.some(x=>x.id===a.stakes?.id))throw new Error('Unknown Omaha stakes.');
  assertChips(a.hand);
  for(const seat of a.hand.seats)if(seat.id!==0&&!ploPlayer(a.players[seat.id]))throw new Error('Unknown Omaha player.');
  if(a.hand.seats.some(x=>x.hole.length!==4))throw new Error('Omaha hands need four cards.');
  const cards=[...a.hand.deck,...a.hand.board,...a.hand.seats.flatMap(x=>x.hole)];if(new Set(cards).size!==cards.length)throw new Error('A card appears twice in the Omaha save.');
 }
 return s;
}
export function loadPlo():{state:PloState;notice:string} {
 let text:string|null=null;try{text=localStorage.getItem(PLO_KEY);}catch{/* storage off */}
 if(!text)return {state:freshPlo(),notice:''};
 try{return {state:checkPlo(JSON.parse(text)),notice:''};}
 catch(e){const keep=(()=>{try{const v=JSON.parse(text!);return Number.isSafeInteger(v?.balance)&&v.balance>=0?v.balance as number:PLO_START_BALANCE;}catch{return PLO_START_BALANCE;}})();
  return {state:{...freshPlo(),balance:keep},notice:`${(e as Error).message} The table was closed; your balance was kept.`};}
}
export function savePlo(state:PloState):void {try{localStorage.setItem(PLO_KEY,JSON.stringify(state));}catch{/* this visit only */}}

/** The table: you in seat 0 and five Omaha regulars. */
export class PloTable {
 state:PloState;notice:string;
 constructor(state?:PloState){const loaded=state?{state,notice:''}:loadPlo();this.state=loaded.state;this.notice=loaded.notice;}
 private save(){if(this.state.active)assertChips(this.state.active.hand);savePlo(this.state);}
 get hand():PloHand|null {return this.state.active?ploView(this.state.active.hand,0):null;}
 get heroTurn():boolean {const h=this.state.active?.hand;return !!h&&h.street!=='complete'&&h.actor===0;}
 get botTurn():boolean {const h=this.state.active?.hand;return !!h&&h.street!=='complete'&&h.actor!==null&&h.actor!==0;}
 sit(stakesId:string,buyInBB:number,players=5):void {
  if(this.state.active)throw new Error('You are already at the Omaha table.');
  const stakes=PLO_STAKES.find(s=>s.id===stakesId);if(!stakes)throw new Error('Choose Omaha stakes.');
  if(!Number.isInteger(buyInBB)||buyInBB<40||buyInBB>100)throw new Error('Buy in for 40 to 100 big blinds (pot-limit tables cap the buy-in).');
  const buyIn=buyInBB*stakes.bigBlind;if(this.state.balance<buyIn)throw new Error('Not enough in your Omaha balance.');
  const pool=[...PLO_PLAYERS];for(let i=pool.length-1;i>0;i--){const j=rnd(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}
  const chosen=pool.slice(0,Math.max(1,Math.min(5,players)));
  const names:Record<number,string>={},stacks:Record<number,number>={0:buyIn};chosen.forEach((p,i)=>{names[i+1]=p.id;stacks[i+1]=(60+rnd(41))*stakes.bigBlind;});
  this.state.balance-=buyIn;
  const session:PloSession={id:id('plo'),stakes:stakes.id,startedAt:now(),endedAt:null,buyIns:buyIn,cashOut:0,hands:0};
  this.state.sessions=[...this.state.sessions.slice(-49),session];
  this.state.active={sessionId:session.id,stakes,players:names,stacks,hand:this.deal(stakes,stacks,names,rnd(chosen.length+1),1),number:1,button:0};
  this.state.active.button=this.state.active.hand.button;
  const hello=chosen.filter(()=>rnd(100)<35).slice(0,2);for(const p of hello){const sid=Number(Object.keys(names).find(k=>names[Number(k)]===p.id));const text=line(p,'hello',rnd(1000)/1000);if(text)this.say(sid,text);}
  this.save();
 }
 private say(seatId:number,text:string){const a=this.state.active;if(!a)return;a.talk=[...(a.talk??[]).slice(-7),{seatId,text,hand:a.number}];}
 private personalities():Record<number,PloPersonality>{const a=this.state.active!;return Object.fromEntries(Object.entries(a.players).map(([k,v])=>[Number(k),ploPlayer(v)!]));}
 private deal(stakes:PloStakes,stacks:Record<number,number>,names:Record<number,string>,button:number,number:number):PloHand {
  const seats=Object.keys(stacks).map(Number).sort((a,b)=>a-b).map(sid=>({id:sid,name:sid===0?'You':ploPlayer(names[sid])!.name,stack:stacks[sid]}));
  return startPloHand({handId:id(`plo-hand-${number}`),button,smallBlind:stakes.smallBlind,bigBlind:stakes.bigBlind,seats,deck:secureDeck()});
 }
 act(action:PloAction):void {
  const a=this.state.active;if(!a||!this.heroTurn)throw new Error('It is not your turn.');
  const before=legalPlo(a.hand);a.hand=applyPlo(a.hand,action);
  if(action.type==='raise'&&before&&action.to===before.maxRaiseTo&&a.hand.street!=='complete'&&rnd(100)<25){const who=a.hand.seats.filter(s=>s.id!==0&&!s.folded);const s=who[rnd(Math.max(1,who.length))];const p=s&&ploPlayer(a.players[s.id]);const text=p&&line(p,'needle',rnd(1000)/1000);if(s&&text)this.say(s.id,text);}
  this.afterStep();
 }
 private plan:{key:string;action:PloAction;ms:number;tempo:Tempo}|null=null;
 private planKey(){const h=this.state.active?.hand;return h?`${h.handId}:${h.events.length}`:'';}
 /** Decides the next player's action now and says how long they will think about it. */
 planBot():number {
  const a=this.state.active;if(!a||!this.botTurn)return 0;
  const key=this.planKey();if(this.plan?.key===key)return this.plan.ms;
  const id=a.hand.actor!,p=ploPlayer(a.players[id])!;
  const d=ploDecideDetailed(a.hand,p,rnd,{mood:a.moods?.[id],reads:this.state.reads??EMPTY_READS});
  const t=thinkTime(p,d.action.type,d.strength,d.big,rnd(1000)/1000);
  this.plan={key,action:d.action,ms:t.ms,tempo:t.tempo};return t.ms;
 }
 /** One player decision; the screen calls this after the thinking pause from planBot. */
 botStep():void {
  const a=this.state.active;if(!a||!this.botTurn)return;
  if(this.plan?.key!==this.planKey())this.planBot();
  const plan=this.plan!;this.plan=null;const id=a.hand.actor!;
  a.hand=applyPlo(a.hand,plan.action);
  const last=[...a.hand.events].reverse().find(e=>e.kind==='action'&&e.seatId===id);if(last&&plan.tempo!=='normal')last.tempo=plan.tempo;
  if(plan.tempo==='tank'&&rnd(100)<30){const text=line(ploPlayer(a.players[id])!,'tank',rnd(1000)/1000);if(text)this.say(id,text);}
  this.afterStep();
 }
 private afterStep(){const a=this.state.active!;if(a.hand.street==='complete')this.record();this.save();}
 private record(){
  const a=this.state.active!,h=a.hand,hero=h.seats.find(s=>s.id===0);
  const session=this.state.sessions.find(s=>s.id===a.sessionId);if(session)session.hands++;
  for(const s of h.seats)a.stacks[s.id]=s.stack;
  this.humanAfterHand();
  if(!hero)return;
  const name=(sid?:number)=>sid===undefined?'':sid===0?'You':h.seats.find(s=>s.id===sid)?.name??'';
  const summary=h.events.filter(e=>e.kind!=='refund').map(e=>e.kind==='street'?`${e.text[0].toUpperCase()}${e.text.slice(1)}: ${e.cards!.join(' ')}`:actorLine(name(e.seatId),e.text.replace(/\d+/g,m=>`$${(Number(m)/100).toLocaleString('en-US',Number(m)%100?{minimumFractionDigits:2,maximumFractionDigits:2}:{maximumFractionDigits:0})}`)));
  const rec:PloHandRecord={id:h.handId,number:a.number,at:now(),stakes:a.stakes.label,hole:hero.hole,board:h.board,net:hero.stack-hero.startingStack,won:h.payouts[0]??0,summary,
   shown:h.showdown.filter(sid=>sid!==0).map(sid=>({name:name(sid),hole:h.seats.find(s=>s.id===sid)!.hole,label:h.labels[sid]}))};
  this.state.hands=[...this.state.hands.slice(-199),rec];
 }
 /** Deals the next hand. Players who went broke buy back in; you need chips (or rebuy) to play on. */
 nextHand():void {
  const a=this.state.active;if(!a||a.hand.street!=='complete')throw new Error('Finish the hand first.');
  if(a.stacks[0]<=0)throw new Error('You are out of chips. Rebuy or leave the table.');
  for(const sid of Object.keys(a.stacks).map(Number))if(sid!==0&&a.stacks[sid]<=0)a.stacks[sid]=(60+rnd(41))*a.stakes.bigBlind;
  const ids=Object.keys(a.stacks).map(Number).sort((x,y)=>x-y),next=ids[(ids.indexOf(a.hand.button)+1)%ids.length];
  a.number++;a.hand=this.deal(a.stakes,a.stacks,a.players,next,a.number);a.button=a.hand.button;this.save();
 }
 rebuy(buyInBB=100):void {
  const a=this.state.active;if(!a||a.hand.street!=='complete')throw new Error('Rebuy between hands.');
  const add=buyInBB*a.stakes.bigBlind-a.stacks[0];if(add<=0)throw new Error('You already have a full stack.');
  if(this.state.balance<add)throw new Error('Not enough in your Omaha balance.');
  this.state.balance-=add;a.stacks[0]+=add;
  const s=this.state.sessions.find(x=>x.id===a.sessionId);if(s)s.buyIns+=add;this.save();
 }
 /** Leave between hands. Mid-hand, you fold (or check) through to the end first. */
 leave():void {
  const a=this.state.active;if(!a)return;
  while(a.hand.street!=='complete'){
   if(a.hand.actor===0){const l=legalPlo(a.hand)!;a.hand=applyPlo(a.hand,l.check?{type:'check'}:{type:'fold'});}
   else{const p=ploPlayer(a.players[a.hand.actor!])!;a.hand=applyPlo(a.hand,ploDecide(a.hand,p,rnd));}
   if(a.hand.street==='complete')this.record();
  }
  const cash=a.stacks[0]??0;
  this.state.balance+=cash;const s=this.state.sessions.find(x=>x.id===a.sessionId);if(s){s.cashOut=cash;s.endedAt=now();}
  this.state.active=null;this.save();
 }
 /** Patch 75: who shows, how moods move, what is said, and what the table learned about you. */
 private humanAfterHand(){
  const a=this.state.active!,h=a.hand,players=this.personalities(),bb=a.stakes.bigBlind;
  const reached=[...h.showdown],ranks=new Map(reached.map(id=>[id,omahaRank(h.seats.find(s=>s.id===id)!.hole,h.board)]));
  h.showdown=shownAtShowdown(h,players,rnd);
  const moods={...(a.moods??{})};let spoke=0;
  for(const s of h.seats){if(s.id===0)continue;const p=players[s.id];if(!p)continue;
   const net=s.stack-s.startingStack,rank=ranks.get(s.id),lostStrong=!!rank&&rank[0]>=2&&net<0;
   const before=moods[s.id]?.mood,after=nextMood(moods[s.id],net,bb,lostStrong,rnd(1000)/1000);
   if(after)moods[s.id]=after;else delete moods[s.id];
   if(spoke<2){const kind=after?.mood==='tilt'&&before!=='tilt'?'tilt':lostStrong&&net<=-25*bb?'badBeat':net>=30*bb?'bigWin':null;
    if(kind&&rnd(100)<70){const text=line(p,kind,rnd(1000)/1000);if(text){this.say(s.id,text);spoke++;}}}
  }
  a.moods=moods;
  /* Patch 86: when nobody reacted to the hand, a little small talk now and then. */
  /* Patch 95: words to you after a big pot, a rivalry between two players at showdown, conversations and gestures. */
  const hero=h.seats.find(s=>s.id===0),heroNet=hero?hero.stack-hero.startingStack:0,live=h.seats.filter(s=>s.id!==0&&players[s.id]&&(a.stacks[s.id]??s.stack)>0);
  const named=live.map(s=>({id:s.id,name:s.name}));
  if(spoke<2&&hero&&Math.abs(heroNet)>=40*bb&&named.length&&rnd(100)<55){const w=named[rnd(named.length)],text=lineToHero(heroNet>0?'heroBigWin':hero.stack===0?'heroAllInLoss':'heroBigLoss',w.name,`${h.handId}:hero`);if(text){this.say(w.id,text);spoke++;}}
  if(spoke<2&&hero?.folded){const at=h.seats.filter(s=>s.id!==0&&!s.folded),won=at.filter(s=>(h.payouts[s.id]??0)>0),lost=at.filter(s=>!(h.payouts[s.id]??0));
   if(at.length>=2&&won.length===1&&lost.length&&rnd(100)<40){const [l,w]=rivalPair(lost[0].name,won[0].name,`${h.handId}:rival`);this.say(lost[0].id,l);spoke++;if(w&&rnd(100)<60){this.say(won[0].id,w);spoke++;}}}
  if(!spoke&&named.length>=2&&rnd(100)<18){for(const x of smallTalk(named,`${h.handId}:smalltalk`,false))this.say(x.seatId,x.text);spoke++;}
  if(spoke<2){const q=heroQuestionLine(named,`${h.handId}:question`,.08);if(q){this.say(q.line.seatId,q.line.text);spoke++;}}
  if(spoke<2&&named.length&&rnd(100)<22){const w=named[rnd(named.length)];this.say(w.id,gestureFor(w.name,`${h.handId}:gesture`));}
  const heroRank=ranks.get(0)??null;
  this.state.reads=updateReads(this.state.reads??EMPTY_READS,h,h.showdown,heroRank);
 }
 resetBalance():void {if(this.state.active)throw new Error('Leave the table first.');this.state.balance=PLO_START_BALANCE;this.save();}
}
