/** Patch 71: the hand replayer. A drawn table for any frame, the whole action log with taps to jump, street jumps,
 * your price at each decision and a picture of the hand to save or share. Read only: frames are the saved,
 * already-redacted views, so hidden cards stay hidden. */
import type {Card,GameEvent,HeroViewModel,Street} from '../contracts';

export interface LogEntry {frame:number;street:Street;event:GameEvent}
/** Each event with the first frame that shows it. */
export function replayLog(frames:HeroViewModel[]):LogEntry[] {
 const out:LogEntry[]=[];let seen=0;
 frames.forEach((frame,i)=>{for(const event of frame.events.slice(seen))out.push({frame:i,street:event.type==='street'&&event.street?event.street:frame.street,event});seen=Math.max(seen,frame.events.length);});
 return out;
}
const STREETS:{street:Street;label:string}[]=[{street:'preflop',label:'Preflop'},{street:'flop',label:'Flop'},{street:'turn',label:'Turn'},{street:'river',label:'River'},{street:'complete',label:'Result'}];
/** The first frame of each street that the hand reached. */
export function streetJumps(frames:HeroViewModel[]):{label:string;frame:number;street:Street}[] {
 return STREETS.flatMap(s=>{const i=frames.findIndex(f=>s.street==='preflop'?true:s.street==='complete'?f.street==='complete':f.street===s.street);return i<0?[]:[{...s,frame:i}];});
}
export interface HeroSpot {toCall:number;pot:number;potOdds:number|null;spr:number;choice:string}
/** Hero's price at a Hero decision, and what Hero chose (from the next frame). */
export function heroSpot(frames:HeroViewModel[],i:number):HeroSpot|null {
 const f=frames[i];if(!f||f.actor!==0||f.street==='complete')return null;
 const hero=f.seats.find(s=>s.id===0);if(!hero)return null;
 const toCall=Math.min(f.legal.callAmount,hero.stack),pot=f.pot;
 const next=frames[i+1],chosen=next?.events.slice(f.events.length).find(e=>e.seatId===0&&e.action)?.action;
 const choice=!chosen?'':chosen.type==='raise'?'raise':chosen.type;
 return {toCall,pot,potOdds:toCall>0?toCall/(pot+toCall):null,spr:pot>0?hero.stack/pot:0,choice};
}
/** Where each seat sits on an oval, Hero at the bottom. Percent of the felt box. */
export function seatSpots(ids:number[]):Record<number,{x:number;y:number}> {
 const order=[...ids].sort((a,b)=>a-b),hero=Math.max(0,order.indexOf(0)),n=order.length,out:Record<number,{x:number;y:number}>={};
 order.forEach((id,k)=>{const a=Math.PI/2+2*Math.PI*((k-hero+n)%n)/n;out[id]={x:50+42*Math.cos(a),y:52+36*Math.sin(a)};});
 return out;
}
export interface Draw {card:(c:Card|undefined,size?:string)=>string;money:(n:number)=>string;esc:(s:string)=>string}
/** A small felt with every seat, its cards, stack and bet, the button and the board. */
export function miniTable(frame:HeroViewModel,d:Draw):string {
 const spots=seatSpots(frame.seats.map(s=>s.id));
 const seats=frame.seats.map(s=>{const p=spots[s.id];const state=s.folded?' folded':frame.actor===s.id?' acting':'';
  const bet=s.streetCommitted>0&&frame.street!=='complete'?`<span class="rp-bet">${d.money(s.streetCommitted)}</span>`:'';
  const won=frame.street==='complete'&&(frame.payouts[s.id]??0)>0?`<span class="rp-won">+${d.money(frame.payouts[s.id])}</span>`:'';
  return `<div class="rp-seat${state}${s.id===0?' hero':''}" style="left:${p.x.toFixed(1)}%;top:${p.y.toFixed(1)}%"><span class="rp-cards">${s.folded&&s.id!==0?'':d.card(s.hole[0],'small-card')+d.card(s.hole[1],'small-card')}</span><b>${d.esc(s.id===0?'You':s.name)}${frame.button===s.id?' <i class="rp-button">D</i>':''}</b><small>${d.money(s.stack)}</small>${bet}${won}</div>`;}).join('');
 const label=frame.handLabels[0]?`<span class="rp-label">${d.esc(frame.handLabels[0])}</span>`:'';
 return `<div class="rp-felt" data-testid="replay-table"><div class="rp-center"><div class="rp-board">${frame.board.length?frame.board.map(c=>d.card(c,'small-card')).join(''):''}</div><span class="rp-pot">${frame.street==='complete'?'Awarded '+d.money(Object.values(frame.payouts).reduce((a,b)=>a+b,0)):'Pot '+d.money(frame.pot)}</span>${label}</div>${seats}</div>`;
}

/* The picture: drawn on a canvas in the browser only. */
const SUIT:Record<string,string>={c:'♣',d:'♦',h:'♥',s:'♠'};
export interface ImageLine {text:string;bold?:boolean}
export async function replayImage(frame:HeroViewModel,title:string,lines:ImageLine[],money:(n:number)=>string):Promise<Blob|null> {
 if(typeof document==='undefined')return null;
 const W=1080,lineH=40,H=760+Math.min(lines.length,24)*lineH;const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');if(!g)return null;
 g.fillStyle='#0f1a17';g.fillRect(0,0,W,H);
 g.fillStyle='#1d5a3f';g.beginPath();g.ellipse(W/2,360,470,250,0,0,Math.PI*2);g.fill();g.strokeStyle='#6b4a2a';g.lineWidth=18;g.stroke();
 const drawCard=(card:Card|undefined,x:number,y:number,w=64,h=90)=>{g.fillStyle=card?'#f7f3ea':'#27408b';g.beginPath();g.roundRect(x,y,w,h,8);g.fill();if(!card)return;const red=card[1]==='h'||card[1]==='d';g.fillStyle=red?'#c0392b':'#111';g.font=`bold ${Math.round(w*.45)}px system-ui,sans-serif`;g.textAlign='center';g.fillText((card[0]==='T'?'10':card[0]),x+w/2,y+h*.45);g.fillText(SUIT[card[1]]??'',x+w/2,y+h*.85);};
 frame.board.forEach((card,i)=>drawCard(card,W/2-180+i*74,300));
 g.textAlign='center';g.fillStyle='#e6c48a';g.font='bold 30px system-ui,sans-serif';
 g.fillText(frame.street==='complete'?`Awarded ${money(Object.values(frame.payouts).reduce((a,b)=>a+b,0))}`:`Pot ${money(frame.pot)}`,W/2,430);
 const spots=seatSpots(frame.seats.map(s=>s.id));
 for(const s of frame.seats){const p=spots[s.id],x=p.x/100*1000+40,y=p.y/100*580+70;
  if(!s.folded||s.id===0){drawCard(s.hole[0],x-56,y-80,50,70);drawCard(s.hole[1],x+6,y-80,50,70);}
  g.fillStyle=s.folded?'#8a948f':'#ffffff';g.font=`${s.id===0?'bold ':''}24px system-ui,sans-serif`;g.fillText(`${s.id===0?'You':s.name}${frame.button===s.id?' (D)':''}`,x,y+14);
  g.fillStyle='#cfe3c4';g.font='22px system-ui,sans-serif';g.fillText(money(s.stack)+((frame.payouts[s.id]??0)>0&&frame.street==='complete'?`  +${money(frame.payouts[s.id])}`:''),x,y+42);}
 g.textAlign='left';g.fillStyle='#ffffff';g.font='bold 34px system-ui,sans-serif';g.fillText(title,40,700);
 lines.slice(0,24).forEach((l,i)=>{g.fillStyle=l.bold?'#e6c48a':'#dfe7e3';g.font=`${l.bold?'bold ':''}26px system-ui,sans-serif`;g.fillText(l.text.slice(0,70),40,750+i*lineH);});
 g.fillStyle='#7f8b86';g.font='20px system-ui,sans-serif';g.fillText('Poker Night AI · virtual chips · hidden cards stay hidden',40,H-20);
 return await new Promise<Blob|null>(resolve=>c.toBlob(b=>resolve(b),'image/png'));
}

/** "You calls $2" reads wrong: Hero's lines use the plain verb. */
export function actorLine(name:string,description:string):string {
 const d=description.charAt(0).toLowerCase()+description.slice(1);
 if(name!=='You')return `${name} ${d}`;
 const words:Record<string,string>={calls:'call',raises:'raise',checks:'check',folds:'fold',posts:'post',straddles:'straddle',awarded:'won',wins:'win',bets:'bet',gets:'get'};
 const [first,...rest]=d.split(' ');return `You ${words[first]??first}${rest.length?' '+rest.join(' '):''}`;
}
