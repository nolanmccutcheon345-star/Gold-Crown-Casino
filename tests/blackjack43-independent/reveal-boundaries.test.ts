import {describe,expect,it} from 'vitest';
import {applyBlackjack,blackjackView,createBlackjackState,orderedBlackjackShoe,type BlackjackState,type ShoeCard,type TableSeating} from '../../src/blackjack/engine';
import {BlackjackController} from '../../src/blackjack/controller';
import {emptySession,initialBlackjackData,type BlackjackPort} from '../../src/blackjack/runtime';
import {maskTable} from '../../src/blackjack/deal-pace';
import {liveBlackjackView,liveFullTable} from '../../src/blackjack/live-view';
import {seatsPlayed} from '../../src/blackjack/full-table';
import {BLACKJACK_TABLES} from '../../src/blackjack/presets';
import {SEAT_RULES_VERSION} from '../../src/blackjack/table-players';
const table=BLACKJACK_TABLES.find(t=>t.id==='casino-5')!;
const port:BlackjackPort={load:async()=>null,commit:async()=>undefined,snapshot:async()=>null,close:()=>undefined};
const seating=(style:TableSeating['players'][number]['style']):TableSeating=>({rules:SEAT_RULES_VERSION,heroSeat:2,players:[{seat:1,id:'p1',name:'Ann',style,betUnits:1}]});
function shoe(faces:string[]):ShoeCard[]{const rest=orderedBlackjackShoe(6);return [...faces.map(f=>rest.splice(rest.findIndex(c=>c.endsWith(':'+f)),1)[0]),...rest];}
function controller(engine:BlackjackState){const c=new BlackjackController(port);c.data={...initialBlackjackData(),balance:engine.balance,active:{id:'a',sessionId:'s',startedAt:'',engine,reviews:[],prior:emptySession()}};return c;}
function projection(engine:BlackjackState){const c=controller(engine),state=blackjackView(engine);return {view:liveBlackjackView(state,table,c.session,c.seen,0,false),full:liveFullTable(state),order:c.dealOrder!};}
function dealt(faces:string[],style:TableSeating['players'][number]['style']='mimic-dealer'){return applyBlackjack(createBlackjackState(table,shoe(faces),{seating:seating(style)}),{id:'deal',revision:0,type:'deal',bet:500});}

describe('independent reveal boundaries',()=>{
 it('holds balance and session results at their pre-action baseline until the final reveal',()=>{
  const before=dealt(['Tc','Th','9d','9c','9h','7s','3c']);
  const after=applyBlackjack(before,{id:'stand',revision:before.revision,type:'stand'}),p=projection(after),baseline=projection(before).view;
  expect(p.view.balance).not.toBe(baseline.balance);expect(p.view.session.rounds).toBe(1);
  for(let shown=6;shown<p.order.entries.length;shown++){
   const masked=maskTable(p.view,p.full,p.order.entries,shown,baseline);
   expect(masked.view.balance).toBe(baseline.balance);expect(masked.view.session).toEqual(baseline.session);expect(masked.view.roundNet).toBeNull();
  }
  expect(maskTable(p.view,p.full,p.order.entries,p.order.entries.length,baseline)).toEqual({view:p.view,full:p.full});
 });
 it('reports only physically dealt cards in shoe remaining, counting face-down cards but not flips',()=>{
  const engine=dealt(['Tc','Th','9d','9c','9h','7s','3c']);
  const p=projection(applyBlackjack(engine,{id:'stand',revision:engine.revision,type:'stand'}));
  for(let shown=0;shown<=p.order.entries.length;shown++){
   const masked=maskTable(p.view,p.full,p.order.entries,shown);
   const dealtCount=p.order.entries.slice(0,shown).filter(e=>!e.flip).length;
   expect(masked.view.shoe.remaining).toBe(312-dealtCount);
  }
 });
 it('does not announce another player has stood before the opening deal finishes',()=>{
  const p=projection(dealt(['Tc','Th','9d','9c','9h','7s','3c']));
  // Both Ann cards are now visible, but Hero second card and dealer hole have not been dealt.
  const masked=maskTable(p.view,p.full,p.order.entries,4);
  expect(masked.full!.seats.find(s=>s.seat===1)!.hands[0].cards).toEqual(['Tc','9c']);
  expect(seatsPlayed(masked.full!)).toBe('');
 });
 it('keeps an opening pair together until the player actually starts splitting',()=>{
  const p=projection(dealt(['8c','Tc','9d','8h','9h','7s','3c','Td','2c','Kd'],'gambler'));
  expect(p.full!.seats.find(s=>s.seat===1)!.hands).toHaveLength(2);
  const opening=maskTable(p.view,p.full,p.order.entries,6).full!.seats.find(s=>s.seat===1)!;
  expect(opening.hands.map(h=>h.cards)).toEqual([['8c','8h']]);
  const firstDraw=maskTable(p.view,p.full,p.order.entries,7).full!.seats.find(s=>s.seat===1)!;
  expect(firstDraw.hands.map(h=>h.cards)).toEqual([['8c','3c'],['8h']]);
  expect(firstDraw.hands[0].doubled).toBe(false);
 });
});

describe('drawless seat completion order',()=>{
 it('does not announce a later drawless seat while an earlier seat is still receiving a card',()=>{
  const config:TableSeating={rules:SEAT_RULES_VERSION,heroSeat:4,players:[{seat:1,id:'early',name:'Early',style:'mimic-dealer',betUnits:1},{seat:7,id:'late',name:'Late',style:'never-bust',betUnits:1}]};
  // Hero natural means Deal commits the whole round: Early 5+4 hits8, Late T+8 stands.
  const s=applyBlackjack(createBlackjackState(table,shoe(['5c','Ac','Tc','9d','4c','Kh','8h','7s','8c','3d']),{seating:config}),{id:'natural',revision:0,type:'deal',bet:500});
  expect(s.round!.phase).toBe('settled');const p=projection(s);
  expect(p.order.entries[8].seat).toBe(1);
  const opening=maskTable(p.view,p.full,p.order.entries,8);
  expect(seatsPlayed(opening.full!)).toBe('');
  expect(opening.full!.seats.find(seat=>seat.seat===7)!.hands[0].state).toBe('waiting');
  const dealerTurn=maskTable(p.view,p.full,p.order.entries,9);
  expect(seatsPlayed(dealerTurn.full!)).toContain('Late 18');
 });
 it('does not announce a later drawless seat while Hero is still receiving a card',()=>{
  const config:TableSeating={rules:SEAT_RULES_VERSION,heroSeat:4,players:[{seat:1,id:'early',name:'Early',style:'mimic-dealer',betUnits:1},{seat:7,id:'late',name:'Late',style:'never-bust',betUnits:1}]};
  // Early T+9 stands; Hero5+8 hits8 to21; LateT+8 then stands, dealer9+7 hits3.
  let s=applyBlackjack(createBlackjackState(table,shoe(['Tc','5c','Th','9d','9c','8c','8h','7s','8s','3d']),{seating:config}),{id:'deal',revision:0,type:'deal',bet:500});
  s=applyBlackjack(s,{id:'hit',revision:s.revision,type:'hit'});expect(s.round!.phase).toBe('settled');const p=projection(s);
  expect(p.order.entries[8].seat).toBe('hero');
  const heroTurn=maskTable(p.view,p.full,p.order.entries,8);
  expect(seatsPlayed(heroTurn.full!)).toContain('Early 19');
  expect(seatsPlayed(heroTurn.full!)).not.toContain('Late');
  expect(heroTurn.full!.seats.find(seat=>seat.seat===7)!.hands[0].state).toBe('waiting');
 });
});
