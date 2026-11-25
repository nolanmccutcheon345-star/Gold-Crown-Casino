import { BlackjackController } from './controller';
import { BLACKJACK_TABLES } from './presets';
import { blackjackLobbyMarkup, blackjackTableMarkup, dollars, type BlackjackLobbyState, type BlackjackTableOptions } from './screens';
import { liveBlackjackView, liveFullTable } from './live-view';
import { fullTableSetupMarkup, otherSeatsMarkup, PACE_LABELS, type TablePace, type FullTableState } from './full-table';
import { roundChatter, dealerTotal, type TalkLine } from './table-talk';
import { BJ_PHRASES, answerBlackjack, chimeIn, questionOf, reactTo, type BjPhrase } from '../bots/banter';
import { HERO_SAY_MS, answerRow, quickChatRow } from '../ui/table-talk';
import { maskTable, revealDelay, revealFrom, revealLabel, type DealOrder } from './deal-pace';
import { countState, countSystem, type CountSystemId } from './counting';
import { hintAsPlay, liveAdvice, playWords } from './live-coach';
import type { BlackjackPlay } from './engine';
import type { BlackjackView } from './view-model';

const escape = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

/** Owns display drafts only. Every card, wager and payout comes from the controller. */
export class BlackjackLiveUI {
 readonly controller: BlackjackController;
 private started = false;
 private draft = 0;
 /* Phase 9 (F-07): the draft starts as an untouched pre-fill (the table minimum).
    The first chip the player taps SETS the bet to that chip; later taps add. Only a
    programmatic pre-fill (sit, Change bet) leaves this false — typing, clearing,
    rebetting and any chip tap all count as the player building the bet. */
 private draftSet = false;
 private changingBet = false;
 private coach = false;
 private showHint = false;
 private count: BlackjackTableOptions['count'] = null;
 private notice = '';
 private downloadURL = '';
 private downloadName = '';
 private review = '';
 private testMe = false;
 private mistake: BlackjackView['lastMistake'] = null;
 private hintKey = '';
 private cachedHint: BlackjackView['hint'] = null;
 /* Paced dealing (full table only). `pending` is the deal order just before an action; once the action is saved
    the new cards are revealed one at a time from there. Display only: the round is already settled in the engine. */
 private pace: TablePace = 'casino';
 private beforeReveal: Pick<BlackjackView, 'balance' | 'session'> | undefined;
 private displayedSeen: readonly import('../contracts').Card[] = [];
 private closed = false;
 private pending: { roundId: string; length: number } | null | undefined = undefined;
 private reveal: { order: DealOrder; start: number; shown: number; timer: number } | null = null;
 private onRevealEnd: (() => void) | null = null;
 private syncReveal() {
  const c = this.controller;
  if (this.closed) return;
  if (this.pending === undefined || c.busy) return;
  const order = c.dealOrder, before = this.pending; this.pending = undefined;
  if (!c.publicState?.seating || !order) return;
  const start = revealFrom(before, order);
  if (start >= order.entries.length) return;
  this.reveal = { order, start, shown: start, timer: 0 }; window.setTimeout(() => this.tick(), 0);
 }
 private tick() {
  const r = this.reveal; if (!r || this.closed) return;
  if (r.shown >= r.order.entries.length) { this.reveal = null; this.render(); this.onRevealEnd?.(); return; }
  r.timer = window.setTimeout(() => { if (this.reveal !== r) return; r.shown++; this.render(); this.tick(); }, revealDelay(r.order.entries, r.shown, r.start, this.pace));
 }
 private finishReveal() { if (this.reveal) { window.clearTimeout(this.reveal.timer); this.reveal = null; this.render(); this.onRevealEnd?.(); } }
 constructor(private render: () => void, database: string, supplied?: BlackjackController) { this.controller = supplied ?? new BlackjackController(database); }
 init() { if (this.started) return; this.started = true; this.controller.subscribe(this.render); void this.controller.init(); }
 close() { this.closed=true;if(this.reveal)window.clearTimeout(this.reveal.timer);this.reveal=null;this.pending=undefined;this.onRevealEnd=null;if(this.downloadURL) URL.revokeObjectURL(this.downloadURL); this.controller.close(); }
 private hint(): BlackjackView['hint'] {
  return this.coach || this.showHint ? this.advice() : null;
 }
 /** What the model would play now. With Count coach on it applies that system's index plays.
     Computed for display (coach, hint) and, in Test me, silently for the after-the-fact note. */
 private advice(): BlackjackView['hint'] {
  const c = this.controller, state = c.publicState, table = c.table;
  if (!state?.round || !table) return null;
  const key = `${c.data?.revision}|${this.count?.system ?? ''}|${this.count?.reveal ?? ''}`;
  if (this.hintKey === key) return this.cachedHint;
  this.hintKey = key;
  return this.cachedHint = liveAdvice(state, table, c.seen, this.count ? { system: this.count.system, reveal: this.count.reveal } : null);
 }
 announcement(): string {
  const c=this.controller, state=c.publicState;
  if(c.status!=='ready') return c.status==='loading'?'Verifying blackjack balance and saved round.':`Blackjack paused: ${c.error}`;
  if(c.busy) return 'Saving blackjack action.';
  if(this.reveal) return 'Dealing cards.';
  if(!state) return `Blackjack balance ${dollars(c.data?.balance??0)}. Choose a table.`;
  const round=state.round;
  if(!round||this.changingBet) return `${c.table?.name}. Place your bet. Balance ${dollars(state.balance)}.`;
  if(round.phase==='settled'){ /* Phase 9 (F-07): name only the components that actually applied. */
   const parts:string[]=[];
   if(state.ante)parts.push(`after the ${dollars(state.ante)} ante`);
   if(round.insuranceBet)parts.push(`insurance: ${dollars(round.insuranceBet)} bet, ${dollars(round.insuranceReturn)} returned`);
   return `Round complete. Net ${dollars(round.net??0)}${parts.length?` — ${parts.join('; ')}`:''}. Balance ${dollars(state.balance)}.`;}
  return round.phase==='insurance'?'Dealer shows an ace. Choose insurance or decline.':`Your turn, hand ${round.actor+1} of ${round.hands.length}. Total ${round.hands[round.actor].total}. Dealer shows ${round.dealer[0]}.`;
 }
 /** Patch 80: what the sounds react to: cards shown so far, the shoe, and your result once the round is shown settled. */
 soundState():import('../ui/sounds').BjSoundState|null {
  const p=this.controller.publicState;if(!p)return null;const round=p.round,hand=round?.hands[0];
  const outcome=round&&round.phase==='settled'&&hand?(hand.result==='loss'?(hand.status==='busted'?'bust':'lose'):hand.result??null):null;
  return {roundId:round?.id??null,cards:this.displayedSeen.length,settled:!!round&&round.phase==='settled'&&!this.reveal,outcome,shoe:p.cardsRemaining};
 }
 /** Patch 76: what the other players say when a round settles, worked out once per round. */
 private talk:{roundId:string;lines:TalkLine[]}|null=null;private tableMood:boolean[]=[];
 private withTalk(full:FullTableState,state:NonNullable<BlackjackController['publicState']>):FullTableState {
  const round=state.round,seating=state.seating;if(!round||!seating||round.phase!=='settled')return full;
  if(this.talk?.roundId!==round.id){
   const seats=seating.seats.flatMap(s=>s.kind==='player'?[{seat:s.seat,name:s.name,style:s.style,hands:s.hands.map(h=>({cards:h.cards as string[],total:h.total,status:h.status,result:h.result,doubled:h.doubled}))}]:[]);
   const lines=roundChatter({id:round.id,dealer:round.dealer,hero:round.hands.map(h=>({cards:h.cards as string[],total:h.total,status:h.status,result:h.result,doubled:h.doubled})),seats,insurance:{bet:(round as {insuranceBet?:number}).insuranceBet??0,back:(round as {insuranceReturn?:number}).insuranceReturn??0}},this.tableMood);
   const dealer=round.dealer.filter((x):x is string=>!!x);if(dealer.length>=2)this.tableMood=[...this.tableMood,dealerTotal(dealer)>21].slice(-6);
   this.talk={roundId:round.id,lines};
  }
  const said=new Map(this.talk.lines.map(l=>[l.seat,l.text]));
  return {...full,seats:full.seats.map(s=>said.has(s.seat)?{...s,say:said.get(s.seat)}:s)};
 }
 /** Patch 95: something you said and who answered. Display only. */
 private heroSaid:{at:number;phrase:string;replies:TalkLine[]}|null=null;
 private sayNow(phrase:BjPhrase){
  const seating=this.controller.publicState?.seating;if(!BJ_PHRASES.includes(phrase)||!seating||(this.heroSaid&&Date.now()-this.heroSaid.at<1500))return;
  const seats=seating.seats.flatMap(s=>s.kind==='player'?[{id:s.seat,name:s.name}]:[]),at=Date.now(),seed=`${this.controller.publicState?.round?.id??'idle'}:${phrase}:${at}`;
  const first=answerBlackjack(phrase,seats,seed),chime=first?chimeIn(phrase,seats,first.seatId,seed):null;
  this.heroSaid={at,phrase,replies:[first,chime].flatMap(x=>x?[{seat:x.seatId,text:x.text}]:[])};
  this.render();window.setTimeout(()=>{if(this.heroSaid?.at===at){this.heroSaid=null;this.render();}},HERO_SAY_MS);
 }
 /** Patch 98: a question a player asked you this round, until you answer it. */
 private answeredRound='';
 private pendingQuestion(){
  const t=this.talk,seating=this.controller.publicState?.seating;if(!t||!seating||this.answeredRound===t.roundId||this.reveal)return null;
  for(const l of t.lines){const q=questionOf(l.text),seat=seating.seats.find(s=>s.seat===l.seat&&s.kind==='player');if(q&&seat)return {q,asker:{id:seat.seat,name:seat.name??'Player'},round:t.roundId};}
  return null;
 }
 private answer(index:number){
  const p=this.pendingQuestion();if(!p||!p.q.answers[index])return;
  this.answeredRound=p.round;const at=Date.now(),r=reactTo(p.q,index,p.asker,`${p.round}:${index}`);
  this.heroSaid={at,phrase:p.q.answers[index].label,replies:r?[{seat:r.seatId,text:r.text}]:[]};
  this.render();window.setTimeout(()=>{if(this.heroSaid?.at===at){this.heroSaid=null;this.render();}},HERO_SAY_MS);
 }
 private withHeroSaid(full:FullTableState):FullTableState {
  const said=this.heroSaid;if(!said||Date.now()-said.at>=HERO_SAY_MS)return full;
  const by=new Map(said.replies.map(r=>[r.seat,r.text]));
  return {...full,seats:full.seats.map(s=>by.has(s.seat)?{...s,say:by.get(s.seat)}:s)};
 }
 markup(lobby: BlackjackLobbyState): string {
  const c=this.controller, selected=BLACKJACK_TABLES.find(t=>t.id===lobby.tableId)!;
  const recovery=c.status==='error'||c.status==='readonly'?`<section class="panel" role="alert"><h2>Blackjack is paused</h2><p>${escape(c.error)}</p><p>Your records were preserved. Reload committed state or export a verified previous backup; it is never silently restored.</p><button id="bj-retry" class="button primary">Reload / retry saved action</button><button id="bj-backup" class="button secondary">Prepare private recovery backup</button></section>`:'';
  const downloads=this.downloadURL?`<a class="button secondary" href="${escape(this.downloadURL)}" download="${escape(this.downloadName)}">Download ${this.downloadName.includes('private')?'private recovery backup':'blackjack history'}</a>`:'';
  const notices=`${recovery}${c.error&&c.status==='ready'?`<p class="session-notice" role="alert">${escape(c.error)}</p>`:''}${this.notice?`<p class="session-notice" role="status">${escape(this.notice)}</p>`:''}${downloads}`;
  if(!c.data)return `${notices}<section class="panel" aria-busy="${c.status==='loading'}"><h2>Verifying your blackjack save…</h2><p>No bets can be placed until the separate balance and saved round are verified.</p></section>`;
  let body: string;
  if(c.publicState&&c.table){
   this.syncReveal();
   let vm=liveBlackjackView(c.publicState,c.table,c.session,c.seen,this.draft,this.changingBet,this.hint(),this.mistake);
   let full=liveFullTable(c.publicState),waiting:string|null=null;
   if(this.reveal){const masked=maskTable(vm,full,this.reveal.order.entries,this.reveal.shown,this.beforeReveal);vm=masked.view;full=masked.full;waiting=revealLabel(this.reveal.order.entries,this.reveal.shown,new Map((full?.seats??[]).map(s=>[s.seat,s.name])))||'Dealing';}
   if(full&&!this.reveal)full=this.withTalk(full,c.publicState);
   if(full)full=this.withHeroSaid(full);
   this.displayedSeen=vm.seen;
   const paceControl=full?`<label class="t-watch-result bj-pace-pick">Dealer pace <select id="bj-pace">${(Object.keys(PACE_LABELS) as TablePace[]).map(p=>`<option value="${p}" ${p===this.pace?'selected':''}>${PACE_LABELS[p].label}</option>`).join('')}</select></label>`:'';
   body=blackjackTableMarkup(vm,{coach:this.coach,hintOnce:this.showHint&&!this.reveal,testMe:this.testMe,count:this.count,liveClassic:true,...(full?{feltExtra:otherSeatsMarkup(full),toolbarExtra:paceControl}:{}),...(waiting?{waitingFor:waiting,skipReveal:true}:{})})+(full?((p)=>p?answerRow(p.q.answers.map(a=>a.label),'blackjack',p.asker.name.split(' ')[0]).replace(/data-answer=/g,'data-bj-answer='):'')(this.pendingQuestion())+quickChatRow(BJ_PHRASES,'data-bj-say',this.heroSaid&&Date.now()-this.heroSaid.at<HERO_SAY_MS?{...this.heroSaid,replies:[]}:null):'')+'<p class="lobby-note">Coach hints and count plays come from an approximate model; close plays and resplits are not independently verified. Test me keeps the coach quiet and tells you after each decision.</p><p class="lobby-note">Classic main game only. Side bets and Free Bet are not enabled. Ante is once per round, including every split hand. Saves stay in this browser; export records before clearing site data.</p>';
  }else{
   body=blackjackLobbyMarkup(lobby,{available:c.status==='ready'&&!c.busy&&selected.variant==='classic',balance:c.data.balance,reason:selected.variant==='classic'?'Classic main game is playable. Side-bet paytables are previews only. Your blackjack balance is separate from cash poker and tournaments.':'Free Bet settlement is not implemented. Choose a classic table to play.',...(selected.variant==='classic'?{company:fullTableSetupMarkup(lobby)}:{})});
   body+=`<details class="panel bj-account"><summary>Blackjack balance and records</summary><p>Separate virtual balance: <b>${dollars(c.data.balance)}</b>. Adjustments never transfer cash-poker or tournament funds.</p><form id="bj-adjust-form"><label>New virtual blackjack balance ($)<input id="bj-adjust-target" type="number" min="0" step="0.01" inputmode="decimal" value="${c.data.balance/100}"></label><label>Reason<input id="bj-adjust-note" maxlength="300" required placeholder="Practice bankroll adjustment"></label><button class="button secondary" type="submit">Adjust blackjack balance</button></form></details>`;
  }
  return notices+`<fieldset class="bj-live-fieldset" ${c.busy||c.status!=='ready'?'disabled':''}>${body}<div class="bj-record-actions"><button id="bj-history-export" class="button secondary" ${this.reveal?'disabled':''}>Export blackjack history</button><button id="bj-audit" class="button secondary">Audit saved rounds</button><button id="bj-review" class="button secondary" ${this.reveal?'disabled':''}>Review session decisions</button></div></fieldset>${this.review?`<section class="panel bj-review"><h2>Decision review</h2>${this.review}</section>`:''}`;
 }
 bind(root: HTMLElement, signal: AbortSignal, lobby: BlackjackLobbyState) {
  const c=this.controller, revision=c.data?.revision??-1;
  const on=(selector:string,fn:()=>void)=>root.querySelector(selector)?.addEventListener('click',fn,{signal});
  const focus=()=>root.querySelector<HTMLElement>('#bj-actions')?.focus({preventScroll:true});
  root.querySelectorAll<HTMLButtonElement>('[data-bj-answer]').forEach(b=>b.addEventListener('click',()=>this.answer(Number(b.dataset.bjAnswer)),{signal}));
  root.querySelectorAll<HTMLButtonElement>('[data-bj-say]').forEach(b=>b.addEventListener('click',()=>this.sayNow(b.dataset.bjSay as BjPhrase),{signal}));
  const run=async(fn:()=>Promise<unknown>)=>{this.notice='';try{await fn();}catch(error){this.notice=String(error);}this.render();focus();};
  const pacedFrom=()=>{this.beforeReveal={balance:c.data?.balance??0,session:structuredClone(c.session)};const order=c.dealOrder;return order?{roundId:order.roundId,length:order.entries.length}:null;};
  const act=(action:BlackjackPlay)=>{
   if(this.reveal||this.closed)return;
   /* Coach, a one-off hint and Test me all record the decision; only Test me reports it afterwards. */
   const shown=!!this.hint(),hint=shown||this.testMe?this.advice():null,suggested=hint?hintAsPlay(hint,c.publicState?.legalActions??[]):null;
   this.showHint=false;this.mistake=null;this.pending=pacedFrom();
   void run(async()=>{await c.act(action,revision,hint&&suggested?{suggested,reason:hint.reason}:undefined);if(!shown&&this.testMe&&suggested&&suggested!==action&&!c.error&&c.data&&c.data.revision>revision)this.mistake={played:playWords(action),better:`${playWords(suggested)}. ${hint!.reason.replace(/\.\s*$/,'')}`};});
  };
  /* When the cards come out (and on sitting down), bring the table status strip (balance, shoe, running count) and the
     felt into view: to the top of the screen where the controls are pinned to the bottom (phones and tablets), and
     just far enough on wide screens. If a tall row of seats would still leave your hand under the pinned controls,
     your hand wins: the page scrolls on until it clears them, even if the strip scrolls off the top. */
  const showFelt=()=>{const top=root.querySelector<HTMLElement>('.bj-strip')??root.querySelector<HTMLElement>('.bj-felt');if(!top)return;const behavior:ScrollBehavior=matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
   if(!matchMedia('(max-width: 1180px)').matches){top.scrollIntoView({block:'nearest',behavior});return;}
   let target=top.getBoundingClientRect().top+scrollY-6;const panel=root.querySelector<HTMLElement>('.t-action-panel'),hand=root.querySelector<HTMLElement>('.bj-hand.acting')??root.querySelector<HTMLElement>('.bj-hand');
   if(panel&&hand&&getComputedStyle(panel).position==='fixed'){const over=hand.getBoundingClientRect().bottom+scrollY-target-(panel.getBoundingClientRect().top-12);if(over>0)target+=over;}
   scrollTo({top:Math.max(0,target),behavior});};
  on('#blackjack-sit',()=>{this.pace=lobby.pace;this.draft=BLACKJACK_TABLES.find(t=>t.id===lobby.tableId)!.minBet;this.draftSet=false;this.changingBet=false;this.review='';void run(()=>c.sit(lobby.tableId,lobby.ante,{others:lobby.others,heroSeat:lobby.heroSeat})).then(showFelt);});
  on('#bj-leave',()=>{void run(()=>c.leave());});
  on('#bj-skip',()=>this.finishReveal());
  root.querySelector<HTMLSelectElement>('#bj-pace')?.addEventListener('change',event=>{this.pace=(event.currentTarget as HTMLSelectElement).value as TablePace;this.render();root.querySelector<HTMLElement>('#bj-pace')?.focus({preventScroll:true});},{signal});
  /* After a reveal, nudge the page only if your hand ended up under the pinned controls. */
  this.onRevealEnd=()=>{const panel=root.querySelector<HTMLElement>('.t-action-panel'),hand=root.querySelector<HTMLElement>('.bj-hand.acting')??root.querySelector<HTMLElement>('.bj-hand');if(panel&&hand&&getComputedStyle(panel).position==='fixed'&&hand.getBoundingClientRect().bottom>panel.getBoundingClientRect().top-12)showFelt();focus();};
  on('#bj-retry',()=>{void run(()=>c.retry());});
  on('#bj-clear',()=>{this.draft=0;this.draftSet=true;this.render();});
  on('#bj-rebet',()=>{const state=c.publicState;if(state&&c.table){this.draft=liveBlackjackView(state,c.table,c.session,c.seen,0,false).lastBet;this.draftSet=true;this.render();}});
  const deal=(rebet:boolean)=>{if(this.reveal||this.closed)return;const state=c.publicState;if(!state||!c.table)return;this.mistake=null;const amount=rebet?liveBlackjackView(state,c.table,c.session,c.seen,0,false).lastBet:this.draft;this.changingBet=false;this.showHint=false;this.pending=pacedFrom();void run(()=>c.deal(amount,revision)).then(showFelt);};
  on('#bj-deal',()=>deal(false));on('#bj-rebet-deal',()=>deal(true));
  on('#bj-new-bet',()=>{this.changingBet=true;this.draft=c.table?.minBet??0;this.draftSet=false;this.render();focus();});
  root.querySelectorAll<HTMLButtonElement>('[data-blackjack-chip]').forEach(el=>el.addEventListener('click',()=>{const chip=Number(el.dataset.blackjackChip);if(this.draftSet)this.draft+=chip;else{this.draft=chip;this.draftSet=true;}this.render();},{signal}));
  root.querySelector<HTMLInputElement>('#bj-bet-amount')?.addEventListener('input',event=>{const value=(event.currentTarget as HTMLInputElement).value;this.draft=value===''?0:Number(value)*100;this.draftSet=true;this.render();},{signal});
  root.querySelectorAll<HTMLButtonElement>('[data-blackjack-action]').forEach(el=>el.addEventListener('click',()=>act(el.dataset.blackjackAction as BlackjackPlay),{signal}));
  on('#bj-insurance-no',()=>act('decline-insurance'));on('#bj-insurance-yes',()=>act(c.publicState?.legalActions.includes('even-money')?'even-money':'insurance'));
  const refocus=(selector:string)=>root.querySelector<HTMLElement>(selector)?.focus({preventScroll:true});
  root.querySelector<HTMLInputElement>('#bj-coach')?.addEventListener('change',event=>{this.coach=(event.currentTarget as HTMLInputElement).checked;if(this.coach)this.testMe=false;this.showHint=false;this.mistake=null;this.render();refocus('#bj-coach');},{signal});
  root.querySelector<HTMLInputElement>('#bj-test-me')?.addEventListener('change',event=>{this.testMe=(event.currentTarget as HTMLInputElement).checked;if(this.testMe)this.coach=false;this.showHint=false;this.mistake=null;this.render();refocus('#bj-test-me');},{signal});
  on('#bj-hint',()=>{this.showHint=true;this.render();focus();});
  root.querySelector<HTMLInputElement>('#bj-count-on')?.addEventListener('change',event=>{this.count=(event.currentTarget as HTMLInputElement).checked?{system:'hi-lo',reveal:true}:null;this.render();},{signal});
  root.querySelector<HTMLSelectElement>('#bj-count-system')?.addEventListener('change',event=>{if(this.count){this.count={system:(event.currentTarget as HTMLSelectElement).value as CountSystemId,reveal:this.count.reveal};this.render();}},{signal});
  on('#bj-count-reveal',()=>{if(this.count){this.count={...this.count,reveal:!this.count.reveal,answer:null};this.render();}});
  const checkLiveCount=()=>{
   if(!this.count||!c.table)return;
   const text=root.querySelector<HTMLInputElement>('#bj-count-answer')?.value??'',aceText=root.querySelector<HTMLInputElement>('#bj-count-aces')?.value??'',given=Number(text.trim().replace('−','-')),acesGiven=Number(aceText);
   if(!text.trim()||!Number.isFinite(given)||!aceText.trim()||!Number.isInteger(acesGiven)||acesGiven<0||acesGiven>c.table.decks*4){this.notice='Enter a numeric running count and a whole-number ace tally (0 if none).';this.render();return;}
   const state=countState(countSystem(this.count.system),this.displayedSeen,c.table.decks);
   this.notice='';this.count={...this.count,answer:{given,correct:state.running,right:given===state.running,acesGiven,acesCorrect:state.acesSeen,acesRight:acesGiven===state.acesSeen,seenKey:this.displayedSeen.join('|')}};this.render();
  };
  on('#bj-count-check',checkLiveCount);
  root.querySelectorAll<HTMLInputElement>('#bj-count-answer, #bj-count-aces').forEach(input=>input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();checkLiveCount();}},{signal}));
  const download=async(privateBackup:boolean)=>{const text=await(privateBackup?c.exportRecoveryBackup():c.exportHistory());if(this.downloadURL)URL.revokeObjectURL(this.downloadURL);this.downloadURL=URL.createObjectURL(new Blob([text],{type:'application/json'}));this.downloadName=privateBackup?'blackjack-private-recovery.json':'blackjack-public-history.json';this.notice=privateBackup?'Private backup prepared. It may contain hidden cards and is not automatically restored.':'Public history prepared. Future shoe cards and hidden dealer cards are excluded.';};
  on('#bj-history-export',()=>{void run(()=>download(false));});on('#bj-backup',()=>{void run(()=>download(true));});
  on('#bj-audit',()=>{void run(async()=>{const count=await c.auditHistory();this.notice=`Full replay audit passed for ${count} saved rounds.`;});});
  on('#bj-review',()=>{void run(async()=>{const history=JSON.parse(await c.exportHistory()) as {segments:{sessionId:string;reviews:{played:string;suggested:string;reason:string;roundId:string}[]}[]};const latest=history.segments.at(-1)?.sessionId;const all=history.segments.filter(s=>s.sessionId===latest).flatMap(s=>s.reviews),different=all.filter(row=>row.played!==row.suggested);this.review=`<p>Approximate model comparison, not independently verified basic strategy. ${all.length} coached decisions; ${different.length} differed. Decisions are recorded while the coach, a hint or Test me is on.</p>${different.length?`<ol>${different.map(row=>`<li>${escape(row.played)} → model: ${escape(row.suggested)}. ${escape(row.reason)}</li>`).join('')}</ol>`:'<p>No recorded differences.</p>'}`;});});
  root.querySelector('#bj-adjust-form')?.addEventListener('submit',event=>{event.preventDefault();const input=root.querySelector<HTMLInputElement>('#bj-adjust-target')!.value;if(!/^\d+(?:\.\d{1,2})?$/.test(input)){this.notice='Enter dollars with at most two decimal places.';this.render();return;}const amount=Number(input)*100,note=root.querySelector<HTMLInputElement>('#bj-adjust-note')!.value;void run(()=>c.adjustBalance(Math.round(amount),note));},{signal});
 }
}
