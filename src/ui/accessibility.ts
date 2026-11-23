import type {Card,HeroViewModel} from '../contracts';

const SUITS={c:'clubs',d:'diamonds',h:'hearts',s:'spades'} as const;
const RANKS:Record<string,string>={T:'10',J:'Jack',Q:'Queen',K:'King',A:'Ace'};
// Built once: constructing the formatter on every call dominated the cost of each announcement.
const DOLLAR_FORMAT=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const dollars=(cents:number)=>DOLLAR_FORMAT.format(cents/100);
export function cardName(card:Card):string {return `${RANKS[card[0]]??card[0]} of ${SUITS[card[1] as keyof typeof SUITS]}`;}

/** Public view only. Never accept engine state, hidden hands, or policy metadata. */
export function tableAnnouncement(view:HeroViewModel|null,handNumber:number,paused:boolean):string {
 if(!view)return 'No active table. Choose New session to configure your practice game.';
 const hero=view.seats.find(seat=>seat.id===0);
 let actionEvent:HeroViewModel['events'][number]|undefined;
 for(let index=view.events.length-1;index>=0;index--){const event=view.events[index];if(event.type==='action'&&event.action){actionEvent=event;break;}}
 const action=actionEvent?.action;
 const name=view.seats.find(seat=>seat.id===actionEvent?.seatId)?.name??'Player';
 const lastAction=!action?'':` ${name} ${action.type==='raise'?`raised to ${dollars(action.to)}`:action.type==='call'?`called ${dollars(actionEvent?.amount??0)}`:action.type==='check'?'checked':'folded'}.`;
 const prefix=`Hand ${handNumber}. ${view.street==='complete'?'Hand settled':view.street}.${lastAction}`;
 const board=view.board.length?` Board: ${view.board.map(cardName).join(', ')}.`:'';
 if(view.street==='complete'){
  const payouts=Object.entries(view.payouts).filter(([,amount])=>amount>0).map(([seat,amount])=>`${view.seats.find(player=>player.id===Number(seat))?.name??`Seat ${Number(seat)+1}`} awarded ${dollars(amount)}`).join('. ');
  return `${prefix}${board} ${payouts||'No pot award'}. Rake ${dollars(view.rake)}. Your stack ${dollars(hero?.stack??0)}. Deal next hand or cash out.`;
 }
 const pot=` Pot ${dollars(view.pot)}.`;
 if(paused)return `${prefix}${board}${pot} Table paused. Resume to continue.`;
 const actor=view.seats.find(seat=>seat.id===view.actor);
 const turn=view.actor===0?` Your turn. ${view.legal.check?'You can check.':`Call ${dollars(view.legal.callAmount)}.`} Your stack ${dollars(hero?.stack??0)}.`:` ${actor?.name??'Opponent'} to act.`;
 return `${prefix}${board}${pot}${turn}`;
}

/** Current recovery/ownership state takes priority over retained maintenance feedback. */
export function savedPracticeAnnouncement(input:{status:'loading'|'ready'|'readonly'|'error'|'deleted';error:string;maintenanceNotice:string;table:string}):string {
 if(input.status==='loading')return 'Verifying saved practice. Poker actions are unavailable until recovery succeeds.';
 if(input.status==='deleted')return 'Saved practice data deleted. No new bankroll has been created.';
 if(input.status!=='ready')return `Saved practice is paused. ${input.error||'Use the recovery controls to continue safely.'}`;
 return input.maintenanceNotice||input.table;
}

/** Preserve keyboard location across the application's replace-on-render UI. */
export function focusSelector(element:HTMLElement|null,root:HTMLElement):string|null {
 if(!element||!root.contains(element))return null;
 if(element.id)return `#${CSS.escape(element.id)}`;
 if(element.matches('a.brand'))return 'a.brand';
 for(const key of ['data-view','data-action','data-size','data-replay','data-import-selection']){
  const value=element.getAttribute(key);if(value!==null)return `[${key}="${CSS.escape(value)}"]`;
 }
 if(element.tagName==='SUMMARY'&&element.parentElement?.id)return `#${CSS.escape(element.parentElement.id)} > summary`;
 return null;
}

export function restoreFocus(root:HTMLElement,selector:string|null):void {
 if(!selector)return;
 const target=root.querySelector<HTMLElement>(selector);
 if(target&&!target.matches(':disabled')){target.focus({preventScroll:true});return;}
 // An action may have become unavailable after its one committed command.
 // Keep navigation at the action region, never automatically repeat an action.
 const fallback=root.querySelector<HTMLElement>('#table-actions')??root.querySelector<HTMLElement>('#main-content');
 fallback?.focus({preventScroll:true});
}
