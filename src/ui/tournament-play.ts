/** Tournament presentation consumes only public hand projections. No chip movement lives here. */
import {facesFor,type TableFace} from './face-hook';
import {emoteMarkup,handMoment,momentMarkup,seatEmote} from './moments';
import {allInSpotlight} from './recap';
import {chipStackMarkup,heroHandLabel} from './table-style';
import {avatarSvg} from './avatars';
import {dealClass} from './motion';
import type {Action,Card,GameState,HeroViewModel} from '../contracts';
import {tournamentGameView} from '../tournament/runtime';
import type {TournamentView} from '../tournament/view-model';
import {levelStripMarkup,moveNoticeMarkup,ordinal,standingsMarkup,tournamentBannerMarkup} from '../tournament/screens';
import {cardName} from './accessibility';
import {perimeterLayout,shortPerimeterLayout} from './table-layout';
import {raiseBounds,stepRaise,tournamentSizes} from './tournament-sizing';
import './tournament-play.css';

export interface TournamentPlaySource {
 status:string;busy:boolean;error:string;
 /** Multi-table: the other tables are playing their hands before the round is saved. */
 otherTables?:boolean;
 data:{active:{entrants:number;handNumber:number;paused:boolean;status:'running'|'hero-out'|'complete';history:readonly {number:number;frames:readonly HeroViewModel[];finalView?:HeroViewModel;state?:GameState}[];finishes:readonly {seatId:number;name:string}[]}|null}|null;
 view:TournamentView|null;gameView:HeroViewModel|null;
 act(action:Action,handId:string,revision:number,tempo?:'snap'|'tank'|null):Promise<void>;
 nextHand():Promise<void>;setPaused(paused:boolean):Promise<void>;finishEvent():Promise<void>;
 /** Multi-table events with late registration (patch 46). */reEnter?():Promise<void>;
}
import {QUIET,type Chatter,type TalkLine} from '../bots/talk';
import {heroSaidMarkup,quipMarkup,shownHand,talkMarkup,type HeroSaid} from './table-talk';
const CHIPS=new Intl.NumberFormat('en-US',{maximumFractionDigits:0});
const chips=(value:number)=>CHIPS.format(value);
const dollars=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value/100);
const escape=(value:unknown)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
const disabled=(value:boolean)=>value?'disabled':'';
function card(value?:Card,small=false):string {
 if(!value)return `<span class="playing-card card-back${small?' small-card':''}" role="img" aria-label="Hidden card"><span aria-hidden="true">♠</span></span>`;
 const suits:Record<string,string>={c:'♣',d:'♦',h:'♥',s:'♠'};
 return `<span class="playing-card${'dh'.includes(value[1])?' red-card':''} suit-${value[1]}${small?' small-card':''}" role="img" aria-label="${escape(cardName(value))}"><b aria-hidden="true">${value[0]==='T'?'10':escape(value[0])}</b><span aria-hidden="true">${suits[value[1]]}</span></span>`;
}
function seatStyle(id:number,count:number):string {
 return [perimeterLayout(count,true),perimeterLayout(count,false),shortPerimeterLayout(count)].map((layout,index)=>{const prefix=['compact','wide','short'][index],point=layout.points[id];return `--${prefix}-x:${point.x};--${prefix}-y:${point.y}`;}).join(';');
}
function seatMarkup(shown:HeroViewModel,id:number,count:number,eliminatedName?:string,heroId=0,emptyWhenUnnamed=false,chatter:Chatter=QUIET,deal='',drawnAvatars=false,emote='',cue='',quip='',faces:TableFace|null=null,side?:{text:string;kind:string},idle=''):string {
 const seat=shown.seats.find(row=>row.id===id),name=seat?.name??eliminatedName??`Seat ${id+1}`;
 const markers=`${shown.button===id?'<span class="dealer-button" aria-label="Dealer button">D</span>':''}${shown.smallBlindSeat===id?'<span class="blind-tag" aria-label="Small blind">SB</span>':''}${shown.bigBlindSeat===id?'<span class="blind-tag" aria-label="Big blind">BB</span>':''}`;
 /* Only this street's actions label a seat, in the same words as the cash table. */
 const streetEvents=shown.events.slice(shown.events.map(event=>event.type).lastIndexOf('street')+1).filter(event=>event.type==='action');
 if(!seat)return `<article class="seat empty-seat${id===heroId?' hero-seat':''}" style="${seatStyle(id,count)}" aria-label="${escape(name)}, ${emptyWhenUnnamed&&!eliminatedName?'empty':'eliminated'}" data-t-seat="${id}"><div class="seat-cards"><span class="seat-markers">${markers}</span></div><div class="seat-label"><div><b>${escape(name)}</b><strong>${emptyWhenUnnamed&&!eliminatedName?'Empty':'Out'}</strong></div></div><div class="seat-status"></div></article>`;
 const acting=shown.street!=='complete'&&shown.actor===id,award=shown.street==='complete'?(shown.payouts[id]??0):0;
 const last=streetEvents.filter(event=>event.seatId===id).at(-1),firstRaise=streetEvents.find(event=>event.action?.type==='raise');
 const did=last?.action?.type==='raise'?(shown.street!=='preflop'&&last===firstRaise?'Bet':'Raised'):last?.action?.type==='call'?'Called':last?.action?.type==='check'?'Checked':null;
 const blind=shown.street==='preflop'&&!last&&seat.streetCommitted>0&&(shown.smallBlindSeat===id||shown.bigBlindSeat===id);
 const label=award?'Won':seat.folded?'Folded':shown.street==='complete'?'':seat.allIn?'All-in':acting?(id===heroId?'Your turn':cue?`${cue[0].toUpperCase()}${cue.slice(1)}…`:'Thinking…'):did??(blind?'Blind':'Waiting');
 const bet=award?chipStackMarkup(award,shown.profile.bigBlind)+'+'+chips(award):
  shown.street!=='complete'&&seat.streetCommitted?chipStackMarkup(seat.streetCommitted,shown.profile.bigBlind)+chips(seat.streetCommitted):'';
 return `<article class="seat${id===heroId?' hero-seat':''}${acting?' acting':''}${seat.folded?' folded':''}${award?' winner':''}" style="${seatStyle(id,count)}" aria-label="${escape(name)}, ${chips(seat.stack)} chips${acting?', acting player':''}" data-t-seat="${id}">${drawnAvatars?`<span class="face-badge" aria-hidden="true">${avatarSvg(name)}</span>`:''}${emote}${faces?`<span class="face-badge" aria-hidden="true">${faces(name,id===heroId,award?'happy':seat.folded&&shown.street==='complete'?'sigh':'neutral')}</span>`:''}<div class="seat-cards"><div class="hole-cards${deal?' '+deal:''}${shownHand(chatter,id)?' shown-hand':''}">${(shownHand(chatter,id)?.cards??(seat.hole.length?seat.hole:null))?.map(value=>card(value,true)).join('')??card(undefined,true)+card(undefined,true)}</div><div class="seat-markers">${markers}</div></div><div class="seat-label"><div><b>${escape(name)}</b><strong>${chips(seat.stack)}</strong></div></div><div class="seat-status"><span class="seat-action${cue&&acting&&id!==heroId?' tell-cue':''}">${escape(shownHand(chatter,id)?'Showed':label)}</span>${side?`<span class="side-tell side-${side.kind}" data-testid="side-tell">${escape(side.text)}</span>`:''}${talkMarkup(chatter,id)}${quip}${seat.folded&&id!==heroId&&shown.street!=='complete'&&idle?`<span class="idle-act" data-testid="idle-act">${escape(idle)}</span>`:''}${shown.handLabels[id]?`<span class="seat-hand-label">${escape(shown.handLabels[id])}</span>`:''}</div><span class="seat-bet${bet?'':' empty-bet'}">${bet}</span></article>`;
}
function actionText(shown:HeroViewModel,event:HeroViewModel['events'][number]):string {
 const name=shown.seats.find(seat=>seat.id===event.seatId)?.name??`Seat ${(event.seatId??0)+1}`;
 if(event.type==='street')return `${event.street}: ${(event.cards??[]).map(cardName).join(', ')}`;
 if(event.type==='action')return `${name}: ${event.action?.type==='raise'?`raise to ${chips(event.action.to)}`:event.action?.type??''}${event.action?.type==='call'?` ${chips(event.amount??0)}`:''}`;
 return `${event.seatId===undefined?'':name+': '}${event.type}${event.amount===undefined?'':' '+chips(event.amount)}${event.detail?' · '+event.detail:''}`;
}
export function tournamentAnnouncement(c:TournamentPlaySource):string {
 const game=c.gameView,active=c.data?.active;
 if(!game||!active)return 'No tournament hand is loaded.';
 const board=game.board.length?` Board: ${game.board.map(cardName).join(', ')}.`:'';
 const last=game.events.filter(event=>event.type==='action').at(-1);
 const turn=game.street==='complete'?`Hand settled. ${Object.entries(game.payouts).map(([id,value])=>`${game.seats.find(seat=>seat.id===Number(id))?.name??'Player'} awarded ${chips(value)} chips`).join('. ')}.`:active.paused?'Tournament paused.':active.status==='running'&&game.actor===0?`Your turn. ${game.legal.check?'You can check.':`Call ${chips(game.legal.callAmount)} chips.`}`:`${game.seats.find(seat=>seat.id===game.actor)?.name??'Opponent'} to act.`;
 return `Tournament hand ${active.handNumber}. ${game.street}. ${last?actionText(game,last)+'. ':''}${turn}${board} Pot ${chips(game.pot)} chips.`;
}
const historicalViews=new WeakMap<GameState,HeroViewModel>();
function historicalView(record:{frames:readonly HeroViewModel[];finalView?:HeroViewModel;state?:GameState}):HeroViewModel|undefined {
 if(record.finalView)return record.finalView;
 const final=record.frames.at(-1);if(final)return final;
 if(!record.state)return undefined;
 let view=historicalViews.get(record.state);if(!view){view=tournamentGameView(record.state);historicalViews.set(record.state,view);}return view;
}
function historyMarkup(c:TournamentPlaySource):string {
 const event=c.data?.active,history=event?.history??[],recent=history.slice(-20).reverse(),total=history.length+((event as {mtt?:{blocks:readonly {heroHands:readonly unknown[]}[]}}|undefined)?.mtt?.blocks.reduce((n,block)=>n+block.heroHands.length,0)??0);
 return `<details class="panel t-history" id="t-history"><summary>Saved tournament hands · ${total}</summary><p>Public showdown information only. ${total>20?'Showing the latest 20; all canonical hands remain saved.':''}</p>${recent.map(record=>{const shown=historicalView(record);return !shown?'':`<details class="t-hand"><summary>Hand ${record.number} · ${chips(Object.values(shown.payouts).reduce((sum,value)=>sum+value,0))} chips awarded</summary><p>Board: ${shown.board.map(cardName).join(', ')||'No community cards'}</p><p>${shown.seats.filter(seat=>seat.hole.length).map(seat=>`${escape(seat.name)}: ${seat.hole.map(cardName).map(escape).join(', ')}${shown.handLabels[seat.id]?' · '+escape(shown.handLabels[seat.id]):''}`).join(' · ')}</p><ol>${shown.events.map(event=>`<li>${escape(actionText(shown,event))}</li>`).join('')}</ol></details>`;}).join('')}</details>`;
}
export interface TournamentPlayOptions {motion?:boolean;/** Patch 103: the odds helper panel, already drawn. */oddsHelper?:string;/** Patch 87: tells from players who are not acting. */sideTells?:ReadonlyMap<number,{text:string;kind:string}>;watchToResult?:boolean;externalAnnouncement?:boolean;fastForward?:boolean;pace?:'normal'|'fast';
 /** Hero has asked to check, or fold if there is a bet, at their next decision in this hand. */
 preCheckFold?:boolean;
 /** Deal the next hand automatically while Hero is still in the event. */
 autoDeal?:boolean;autoDealSeconds?:number;autoDealHeld?:boolean;
 /** Hero has dismissed the notice for their latest table move. */
 moveAcked?:boolean;
 /** Table talk and shown hands for the completed hand (empty when talk is off). */
 chatter?:Chatter;talkOn?:boolean;
 /** Patch 52: name Hero's own best hand (Hero's cards and the board only). */
 handLabel?:boolean;
 /** Patch 54: an event moment (in the money, final table, champion) prepared by the app. */
 moment?:string;
 /** Use the same on-device avatar preference as the cash table. */ drawnAvatars?:boolean;
 /** Patch 66: tells. The acting player's body cue while deciding, and a word said mid-hand. */
 cue?:{seatId:number;text:string}|null;quip?:TalkLine|null;
 /** Patch 95: what you said, and the quick-chat row. */
 heroSaid?:HeroSaid|null;quickChat?:string;
 /** Patch 96: what a folded player is doing, by seat. */
 idleAt?:(seatId:number)=>string|null;}
/** Hero can queue Check/Fold while waiting for the action in a hand they are still in. */
export function canPreCheckFold(c:TournamentPlaySource):boolean {
 const active=c.data?.active,shown=c.gameView,hero=shown?.seats.find(seat=>seat.id===0);
 return !!active&&!!shown&&!!hero&&c.status==='ready'&&active.status==='running'&&!active.paused&&shown.street!=='complete'&&shown.actor!==0&&shown.actor!==null&&!hero.folded&&!hero.allIn;
}
/* Phase 10 (P10-F03): the tournament action panel's peek state, mirroring the cash
 * panel: the player's choice is kept per decision; with no choice the panel peeks
 * while waiting and opens on the hero's turn. The bind handler toggles the live
 * node's class directly; this module state makes the next render agree. */
let tPeekChoice:boolean|null=null;
let tPeekKey='';
export function tournamentPlayMarkup(c:TournamentPlaySource,raiseDraft='',options:TournamentPlayOptions={}):string {
 const active=c.data?.active,shown=c.gameView,view=c.view;if(!active||!shown||!view)return '';
 /* A multi-table event is always dealt at a nine-seat table; once Hero is out the watched table has no Hero seat. */
 const multi=active.entrants>9,tableSize=multi?9:active.entrants,heroId=multi&&active.status!=='running'?-1:0;
 const layoutStyle=[perimeterLayout(tableSize,true),perimeterLayout(tableSize,false)].map((layout,index)=>Object.entries(layout).filter(([key])=>key!=='points').map(([key,value])=>`--${index?'wide':'compact'}-${key.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase())}:${value}px`).join(';')).join(';');
 const moveBlocked=!!view.pendingMove&&active.status==='running'&&!options.moveAcked;
 const legal=shown.legal,hero=active.status==='running'?shown.seats.find(seat=>seat.id===0):undefined,ready=c.status==='ready'&&!c.busy&&!active.paused&&!moveBlocked;
 const turn=ready&&active.status==='running'&&shown.street!=='complete'&&shown.actor===0;
 const peekKey=`${shown.handId}:${shown.revision}`;
 if(tPeekKey!==peekKey){tPeekKey=peekKey;tPeekChoice=null;}
 const peek=tPeekChoice??!turn;
 const peekToggle=`<button type="button" id="t-panel-peek-toggle" class="panel-peek-toggle" aria-expanded="${!peek}" aria-label="${peek?'Expand the tournament controls':'Collapse the tournament controls to a peek strip'}">${peek?'▴ Controls':'▾ Peek'}</button>`;
 const min=legal.shortAllInTo??legal.minRaiseTo,max=legal.maxRaiseTo??legal.shortAllInTo;
 const value=raiseDraft||String(min??0),parsed=Number(value),valid=/^\d+$/.test(value)&&Number.isSafeInteger(parsed)&&min!==null&&max!==null&&parsed>=min&&parsed<=max&&parsed%shown.profile.chipUnit===0;
 const name=(id:number)=>shown.seats.find(seat=>seat.id===id)?.name??`Seat ${id+1}`;
 const sizes=turn?tournamentSizes(shown):[],canSize=turn&&raiseBounds(shown)!==null,pre=!moveBlocked&&canPreCheckFold(c);
 const heroCards=hero?.hole.length?`<span class="t-hero-cards" role="img" aria-label="Your cards: ${hero.hole.map(cardName).map(escape).join(', ')}">${hero.hole.map(value=>card(value,true)).join('')}</span>${options.handLabel&&hero.hole.length===2&&!hero.folded?`<span class="hero-hand-label" data-testid="hero-hand-label">${escape(heroHandLabel(hero.hole,shown.board))}</span>`:''}`:'';
 const auto=!!options.autoDeal&&active.status==='running'&&!options.autoDealHeld;
 const results=shown.street==='complete'?Object.entries(shown.payouts).map(([id,amount])=>`${escape(name(Number(id)))} receives ${chips(amount)} chips`).join(' · '):'';
 const result=view.result;
 const pendingPlace=active.status==='hero-out'&&!result;
 const seatWon=!!result&&!!view.seatTarget&&result.prize===view.seatTarget.seat;
 const seats=view.seatTarget?view.ladder.filter(prize=>prize===view.seatTarget!.seat).length:0;
 const seatLocked=!!view.seatTarget&&!result&&!!hero&&hero.stack>0&&view.playersLeft<=seats?`<p class="t-seat-locked" data-testid="seat-locked" role="status">${view.playersLeft} players left for ${seats} seats: your seat in ${escape(view.seatTarget.name)} is locked. Fold every hand or play it out.</p>`:'';
 const eventResult=result?`<section class="panel t-result" data-testid="tournament-result"><h2>${seatWon?`You won a seat in ${escape(view.seatTarget!.name)}.`:result.place===1?'You won the tournament.':`You finished ${ordinal(result.place)}.`}</h2>${seatWon?`<p data-testid="seat-won">Your seat (${dollars(view.seatTarget!.seat)}) is in your tournament balance.</p>${active.status==='complete'?`<button type="button" class="button primary" data-seat-target="${escape(view.seatTarget!.id)}">Register for ${escape(view.seatTarget!.name)}</button>`:''}`:''}<p>Prize ${dollars(result.prize)} · Entry ${dollars(result.cost)} · Net ${dollars(result.prize-result.cost)} virtual money.</p>${active.status==='hero-out'?'<p>Your result is saved. Continue watching the real remaining hands to finish the event.</p>':''}</section>`:pendingPlace?'<section class="panel t-result" data-testid="tournament-place-pending" role="status"><h2>You are out · place pending</h2><p>Your final place and any prize will be confirmed when registration closes. You have one entry; continue watching or play out the event.</p></section>':'';
 /** Re-entry offer (patch 46): after a knockout while late registration is open. */
 const reEntryMarkup=(r:{available:boolean;pending:boolean;cost:number;used:number}|undefined,status:string)=>!r||status!=='hero-out'&&!r.pending?'':r.pending?'<p class="t-reentry" role="status">Re-entry paid. You sit down with a fresh stack next hand.</p>':r.available?`<div class="t-reentry"><p>Late registration is still open. Your knocked-out entry is placed when it closes.</p><button class="button primary" id="t-reenter" ${disabled(c.status!=='ready'||c.busy||!!c.otherTables)}>Re-enter for ${dollars(r.cost)}</button></div>`:'';
 const controls=shown.street==='complete'?`<h2>${active.status==='complete'?'Tournament complete':active.status==='hero-out'?'Watching the remaining players':'Hand complete'}</h2><p>${results}</p>${options.talkOn===undefined?'':`<label class="t-auto-deal" for="t-table-talk"><input id="t-table-talk" type="checkbox" ${options.talkOn?'checked':''}>Table talk</label>`}<div class="showdown-hands" tabindex="0" aria-label="Shown showdown hands">${Object.entries(shown.handLabels).map(([id,label])=>`${escape(name(Number(id)))}: ${escape(label)}`).join(' · ')}</div>${reEntryMarkup(view.registration?.heroReEntry,active.status)}<div class="t-deal-row"><button class="button primary" id="${active.status==='complete'?'t-finish':'t-next'}" ${disabled(c.status!=='ready'||c.busy||!!c.otherTables||moveBlocked)}>${c.otherTables?'Other tables are finishing their hands…':active.status==='complete'?'Save result & return to lobby':auto?`<span class="t-deal-count">Next hand in <span id="t-auto-count">${options.autoDealSeconds??3}</span>s</span>`:'Deal next tournament hand'}</button>${auto?'<button class="button secondary" id="t-auto-hold">Hold</button>':''}</div>${active.status==='running'?`<label class="t-watch-result t-auto-deal"><input id="t-auto-deal" type="checkbox" ${options.autoDeal?'checked':''}>Auto-deal the next hand</label>`:''}`:`<div class="t-action-title"><h2>${moveBlocked?'Take your new seat to continue':active.paused?'Paused':active.status==='running'&&shown.actor===0?'Your decision':`${escape(name(shown.actor??0))} is up next`}</h2>${heroCards}<span>${hero?`${chips(hero.stack)} · ${(Math.round(hero.stack/shown.profile.bigBlind*10)/10)} BB`:'Watching'}</span>${pre||options.preCheckFold&&shown.actor!==0&&hero&&!hero.folded?`<button type="button" class="button secondary t-pre" id="t-pre-check-fold" aria-pressed="${!!options.preCheckFold}" ${disabled(!pre)}>Check/Fold</button>`:''}</div><div class="t-raise-row"><label for="t-raise-to">Raise to (chips)</label><button type="button" class="button secondary t-step" id="t-less" aria-label="Lower the raise by one big blind" ${disabled(!canSize)}>−</button><input id="t-raise-to" inputmode="numeric" type="text" value="${escape(value)}" aria-describedby="t-raise-help" aria-invalid="${turn&&!valid}" ${disabled(!turn||min===null)}><button type="button" class="button secondary t-step" id="t-more" aria-label="Raise by one more big blind" ${disabled(!canSize)}>+</button></div>${canSize&&min!==null&&max!==null&&max>min?`<div class="amount-slider"><span aria-hidden="true">Min</span><input id="t-raise-slider" type="range" min="${min}" max="${max}" step="${shown.profile.chipUnit}" value="${valid?parsed:min}" aria-label="Raise amount in chips" aria-valuetext="${valid?parsed:min} chips total"><span aria-hidden="true">All-in</span></div>`:''}<div class="t-size-row" role="group" aria-label="Raise sizes"><button class="button secondary" data-t-size="min" ${disabled(!turn||min===null)}>Min</button>${sizes.map(size=>`<button type="button" class="button secondary${String(size.to)===value?' selected':''}" data-t-to="${size.to}" data-size="${size.id}" aria-pressed="${String(size.to)===value}">${size.label}<small>${chips(size.to)}</small></button>`).join('')}<button class="button secondary" id="t-all-in" ${disabled(!turn||(!legal.canRaise&&legal.shortAllInTo===null))}>All-in</button></div><p id="t-raise-help">${min===null?'Raising is unavailable.':`Legal total ${chips(min)}–${chips(max??min)} chips. ${legal.shortAllInTo!==null?'Short all-in only.':''}`}</p><div class="action-buttons"><button class="button fold-button" id="t-fold" ${disabled(!turn||!legal.fold)}>Fold</button><button class="button call-button" id="t-call" ${disabled(!turn||(!legal.check&&!legal.callAmount))}>${legal.check?'Check':'Call '+chips(legal.callAmount)}</button><button class="button primary" id="t-raise" ${disabled(!turn||!valid||(!legal.canRaise&&legal.shortAllInTo===null))}>Raise to ${valid?chips(parsed):'—'}</button></div>${options.oddsHelper??''}`;
 return `<section class="tournament-play" data-testid="tournament-play"><div id="t-announcement" class="sr-only" ${options.externalAnnouncement?'':'role="status" aria-live="polite" aria-atomic="true"'}>${escape(tournamentAnnouncement(c))}</div>${levelStripMarkup(view)}${tournamentBannerMarkup(view.entrants<=9?{...view,finalTable:false}:view)}${multi&&view.status==='running'&&!options.moveAcked?moveNoticeMarkup(view):''}<p class="t-model-note">${multi?`Multi-table tournament · ${view.hero?`table ${view.hero.table}, seat ${view.hero.seat} · `:''}${view.tablesLeft} table${view.tablesLeft===1?'':'s'} left`:'Single-table freezeout'} · chips are not money · existing synthetic opponents are not tournament-calibrated.</p>${seatLocked}${eventResult}<div class="t-play-grid"><section class="table-panel tournament-table"><div class="table-heading"><b>${escape(view.eventName)}</b><span>Hand ${active.handNumber}</span></div><div class="table-scene perimeter-table seats-${active.entrants}${allInSpotlight(shown)?' allin-spotlight':''}" data-testid="tournament-table" style="${layoutStyle};--short-height:${shortPerimeterLayout(tableSize).height}px"><div class="table-rail"><div class="felt"><div class="felt-line"></div><div class="table-watermark">GOLD<br><strong>CROWN</strong></div></div></div><div class="board-area"><div class="street-row"><span class="street-label" data-testid="tournament-street">${shown.street==='complete'?'HAND COMPLETE':shown.street.toUpperCase()}</span><span class="hand-tag">Hand ${active.handNumber}</span></div><div class="board-cards">${Array.from({length:5},(_,index)=>shown.board[index]?card(shown.board[index]):'<span class="board-slot" aria-label="Community card not dealt">♠</span>').join('')}</div><div class="pot-display${shown.street==='complete'?' awarded':''}">${chipStackMarkup(shown.street==='complete'?Object.values(shown.payouts).reduce((sum,amount)=>sum+amount,0):shown.pot,shown.profile.bigBlind,' pot-chips')}<span>${shown.street==='complete'?'AWARDED':'POT'}</span><strong>${chips(shown.street==='complete'?Object.values(shown.payouts).reduce((sum,amount)=>sum+amount,0):shown.pot)}</strong></div></div>${options.moment||(heroId<0?'':momentMarkup(handMoment(shown,heroId,value=>`${chips(value)} chips`,null,true),shown.handId))}<div class="seat-layer has-dealer-glide">${((faces)=>Array.from({length:tableSize},(_,id)=>seatMarkup(shown,id,tableSize,multi?undefined:active.finishes.find(row=>row.seatId===id)?.name,heroId,multi,options.chatter,dealClass(active.handNumber),!!options.drawnAvatars,options.talkOn?emoteMarkup(seatEmote(shown,id,heroId)):'',options.cue?.seatId===id?options.cue.text:'',options.talkOn?quipMarkup(options.quip??null,id,`${shown.handId}:${shown.events.length}`)+(heroId>=0?heroSaidMarkup(options.heroSaid??null,id,heroId):''):'',faces,options.sideTells?.get(id),options.talkOn&&options.idleAt?options.idleAt(id)??'':'')).join(''))(facesFor(shown.seats.map(row=>row.id===heroId?'':row.name).filter(Boolean)))}<span class="seat-anchor dealer-glide" style="${seatStyle(shown.button,tableSize)}" aria-hidden="true">D</span>${shown.street==='complete'?Object.entries(shown.payouts).filter(([,amount])=>amount>0).map(([id,amount])=>`<span class="seat-anchor pot-fly" style="${seatStyle(Number(id),tableSize)}" aria-hidden="true">${chipStackMarkup(amount,shown.profile.bigBlind,' pot-chips')}</span>`).join(''):''}</div></div><div class="t-pot-list">${(shown.street==='complete'||shown.seats.some(seat=>seat.allIn)?shown.pots:[]).map((pot,index)=>`<span>${index===0?'Main pot':shown.street==='complete'||shown.seats.some(seat=>seat.allIn)?'Side pot '+index:'Contribution level '+(index+1)}: <b>${chips(pot.amount)}</b> chips${shown.street==='complete'?' · '+pot.winners.map(name).map(escape).join(', '):''}</span>`).join('')}${shown.uncalledBet&&(shown.street==='complete'||shown.seats.some(seat=>seat.allIn))?`<span>Uncalled: ${chips(shown.uncalledBet.amount)} chips · returned to ${escape(name(shown.uncalledBet.seatId))} unless matched</span>`:''}</div><div class="table-toolbar"><span>${view.playersLeft} players remain · ${active.paused?'Paused':'Saved on this device'}</span><label>Pace <select id="t-pace" aria-label="Tournament action pace"><option value="normal" ${options.pace!=='fast'?'selected':''}>Normal</option><option value="fast" ${options.pace==='fast'?'selected':''}>Fast</option></select></label><label><input type="checkbox" id="table-motion" ${options.motion!==false?'checked':''}>Animations</label><button id="t-pause" class="button secondary" ${disabled(c.status!=='ready'||c.busy||active.status==='complete')}>${active.paused?'Resume':'Pause'}</button></div>${options.quickChat??''}</section><section id="t-actions" class="t-action-panel${turn?' your-action':shown.street==='complete'?'':' waiting-action'}${peek?' panel-peek':''}" aria-label="Tournament betting controls" tabindex="-1">${peekToggle}${active.status==='hero-out'?`<button class="button secondary" id="t-fast-forward" ${disabled(c.status!=='ready'||active.paused)}> ${options.fastForward?'Stop fast-forward':'Skip to result'}</button><p class="t-watch-hint">Plays every remaining hand without the viewing delay. You can stop; each action is saved.</p><label class="t-watch-result"><input id="t-watch-result" type="checkbox" ${options.watchToResult?'checked':''} ${disabled(c.status!=='ready'||c.busy)}>Watch to result</label><p class="t-watch-hint">${options.watchToResult?'Next hands deal automatically while watching. Pause stops play; uncheck to deal each hand yourself.':'Automatically deal the remaining hands. Every hand is played and settled normally.'}</p>`:''}${controls}</section></div><details class="panel t-standings" id="t-standings"><summary>Standings and prizes</summary>${standingsMarkup(view)}</details><details class="panel t-history" id="t-current-history"><summary>Current hand actions</summary><ol>${shown.events.map(event=>`<li>${escape(actionText(shown,event))}</li>`).join('')}</ol></details>${historyMarkup(c)}</section>`;

}
export interface TournamentBindings {signal:AbortSignal;/** Patch 66: whether Hero snapped or thought long on this decision (policy 2.23.0 records it). */heroTempo?(handId:string,revision:number):'snap'|'tank'|null;onMoveAck?():void;onDraft(value:string):void;onManualAction?():void;/** Patch 105: the action Hero chose by hand, for the Live coach's review. */onHeroAction?(action:Action):void;onAction():void;onError(error:string):void;onFastForward?():void;onPace?(value:'normal'|'fast'):void;onWatchToResult?(value:boolean):void;onPreCheckFold?(value:boolean):void;onAutoDeal?(value:boolean):void;onAutoHold?():void;}
export function bindTournamentPlay(root:HTMLElement,c:TournamentPlaySource,options:TournamentBindings):void {
 const shown=c.gameView,active=c.data?.active;if(!shown||!active)return;
 const run=(action:()=>Promise<void>)=>{void action().then(()=>{options.onAction();(root.querySelector<HTMLElement>('#tournament-move-ack')??root.querySelector<HTMLElement>('#t-actions'))?.focus({preventScroll:true});}).catch(error=>options.onError(String(error)));};
 const on=(selector:string,fn:()=>void)=>root.querySelectorAll(selector).forEach(element=>element.addEventListener('click',fn,{signal:options.signal}));
 const act=(action:Action)=>{if(root.querySelector('#tournament-move-ack'))return;options.onManualAction?.();options.onHeroAction?.(action);const tempo=options.heroTempo?.(shown.handId,shown.revision)??null;run(()=>c.act(action,shown.handId,shown.revision,tempo));};
 on('#open-standings',()=>{const details=root.querySelector<HTMLDetailsElement>('#t-standings');if(details){details.open=true;details.querySelector<HTMLElement>('summary')?.focus();}});
 on('#t-panel-peek-toggle',()=>{const panel=root.querySelector<HTMLElement>('#t-actions'),btn=root.querySelector<HTMLButtonElement>('#t-panel-peek-toggle');if(!panel||!btn)return;const nowPeek=!panel.classList.contains('panel-peek');tPeekChoice=nowPeek;panel.classList.toggle('panel-peek',nowPeek);btn.setAttribute('aria-expanded',String(!nowPeek));btn.textContent=nowPeek?'▴ Controls':'▾ Peek';});
 on('#t-fold',()=>act({type:'fold'}));on('#t-call',()=>act({type:shown.legal.check?'check':'call'}));
 on('#t-raise',()=>{const value=root.querySelector<HTMLInputElement>('#t-raise-to')?.value??'';const to=Number(value),min=shown.legal.shortAllInTo??shown.legal.minRaiseTo,max=shown.legal.maxRaiseTo??shown.legal.shortAllInTo;if(!/^\d+$/.test(value)||!Number.isSafeInteger(to)||min===null||max===null||to<min||to>max||to%shown.profile.chipUnit!==0){options.onError('Enter a legal whole-chip raise total.');return;}act({type:'raise',to});});
 on('#t-all-in',()=>{const to=shown.legal.maxRaiseTo??shown.legal.shortAllInTo;if(to!==null)act({type:'raise',to});});
 on('[data-t-size="min"]',()=>options.onDraft(String(shown.legal.shortAllInTo??shown.legal.minRaiseTo??0)));
 root.querySelectorAll<HTMLElement>('[data-t-to]').forEach(element=>element.addEventListener('click',()=>options.onDraft(element.dataset.tTo!),{signal:options.signal}));
 const step=(direction:1|-1)=>{const to=stepRaise(shown,root.querySelector<HTMLInputElement>('#t-raise-to')?.value??'',direction);if(to!==null)options.onDraft(String(to));};
 on('#t-less',()=>step(-1));on('#t-more',()=>step(1));
 on('#t-pre-check-fold',()=>options.onPreCheckFold?.(root.querySelector('#t-pre-check-fold')?.getAttribute('aria-pressed')!=='true'));
 on('#t-auto-hold',()=>options.onAutoHold?.());
 on('#t-fast-forward',()=>options.onFastForward?.());
 root.querySelector<HTMLSelectElement>('#t-pace')?.addEventListener('change',event=>options.onPace?.((event.currentTarget as HTMLSelectElement).value==='fast'?'fast':'normal'),{signal:options.signal});
 root.querySelector<HTMLInputElement>('#t-auto-deal')?.addEventListener('change',event=>options.onAutoDeal?.((event.currentTarget as HTMLInputElement).checked),{signal:options.signal});
 root.querySelector<HTMLInputElement>('#t-raise-to')?.addEventListener('input',event=>options.onDraft((event.currentTarget as HTMLInputElement).value),{signal:options.signal});
 root.querySelector<HTMLInputElement>('#t-raise-slider')?.addEventListener('input',event=>{const el=event.currentTarget as HTMLInputElement,lo=Number(el.min),hi=Number(el.max),bb=shown.profile.bigBlind;let v=Number(el.value);v=v>=hi?hi:v<=lo?lo:Math.min(hi,Math.max(lo,Math.round(v/bb)*bb));options.onDraft(String(v));},{signal:options.signal});
 root.querySelector<HTMLInputElement>('#t-watch-result')?.addEventListener('change',event=>options.onWatchToResult?.((event.currentTarget as HTMLInputElement).checked),{signal:options.signal});
 on('#tournament-move-ack',()=>options.onMoveAck?.());
 on('#t-reenter',()=>{if(c.reEnter)run(()=>c.reEnter!());});on('#t-next',()=>{if(!root.querySelector('#tournament-move-ack'))run(()=>c.nextHand());});on('#t-pause',()=>run(()=>c.setPaused(!active.paused)));on('#t-finish',()=>run(()=>c.finishEvent()));
}
