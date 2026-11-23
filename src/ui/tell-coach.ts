/** Patch 64: after a session, the tells you could have used. Reads saved hands only, and only players whose
 * cards were shown down, so every note can be checked in History. Screen only. */
import type {AppData,StoredHand} from '../session/types';
import {revealedAtShowdown} from '../bots/insight';
import {CUE_PHRASES,TIMING_PHRASES,pastTellInputs,tellsFor,type Meaning} from '../bots/tells';
import {boardTell} from '../bots/more-tells';

export interface TellNote {handId:string;number:number;name:string;tell:string;truth:Meaning;fake:boolean;missed:boolean;text:string}
const said=(m:Meaning)=>m==='strong'?'a strong hand':m==='weak'?'a weak hand':'a drawing hand';
const means=(m:Meaning)=>m==='strong'?'strength':m==='weak'?'weakness':'a draw';

/** Tells shown this session by players who then showed their cards, most useful first. */
export function tellNotes(data:AppData,sessionId:string,limit=4):TellNote[] {
 const notes:TellNote[]=[];
 const hands=data.hands.filter(hand=>hand.sessionId===sessionId).sort((a,b)=>a.number-b.number);
 for(const hand of hands)notes.push(...handNotes(hand));
 const seen=new Set<string>();
 return notes.sort((a,b)=>Number(b.missed)-Number(a.missed)||Number(b.fake)-Number(a.fake)||b.number-a.number)
  .filter(note=>{const key=`${note.name}:${note.tell}`;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,limit);
}
export function handNotes(hand:StoredHand):TellNote[] {
 const view=hand.view;if(view.street!=='complete')return [];
 const revealed=revealedAtShowdown(view.street,Object.keys(view.handLabels??{}).map(Number),view.seats);
 const out:TellNote[]=[];
 for(const {id,hole} of revealed){
  const profile=hand.privateProfiles?.[id],seat=view.seats.find(s=>s.id===id);
  if(id===0||!profile||!seat||hole.length!==2)continue;
  for(const input of pastTellInputs(hand.id,view.events,view.board,id,hole as never,profile)){
   const t=tellsFor(input);
   const tell=t.cue?CUE_PHRASES[t.cue]:t.timingLabel?TIMING_PHRASES[t.timingLabel]:t.speech?`said “${t.speech}”`:undefined;
   if(!tell)continue;
   // Did Hero act against what the tell (truthfully) said, after it?
   const later=view.events.filter(e=>e.type==='action'&&e.seatId===0&&e.revision>input.event.revision);
   const heroFolded=later.some(e=>e.action?.type==='fold'),heroPaid=later.some(e=>e.action?.type==='call'||e.action?.type==='raise');
   const foldedToBluff=!t.fake&&t.meaning==='weak'&&heroFolded,paidOff=!t.fake&&t.meaning==='strong'&&heroPaid&&hand.net<0,missed=foldedToBluff||paidOff;
   const text=t.fake
    ?`${seat.name} ${tell} — usually ${means(t.meaning==='strong'?'weak':'strong')} — but had ${said(t.meaning)}. That one was an act.`
    :`${seat.name} ${tell}, and had ${said(t.meaning)}.${foldedToBluff?' You folded.':paidOff?' You paid it off.':''}`;
   out.push({handId:hand.id,number:hand.number,name:seat.name,tell,truth:t.meaning,fake:t.fake,missed,text});
  }
  // Patch 87: reactions to the flop, turn and river.
  for(const [street,n] of [['flop',3],['turn',4],['river',5]] as const){
   if(view.board.length<n)continue;const b=boardTell({handId:hand.id,street,board:view.board.slice(0,n)},id,hole as never,profile);if(!b)continue;
   const tell=b.text==='rechecks their cards'?`rechecked their cards on the ${street}`:b.text==='perks up'?`perked up on the ${street}`:`slumped on the ${street}`;
   const text=b.fake?`${seat.name} ${tell} but had ${said(b.truth)}. That one was an act.`:`${seat.name} ${tell}, and had ${said(b.truth)}.`;
   out.push({handId:hand.id,number:hand.number,name:seat.name,tell,truth:b.truth,fake:b.fake,missed:false,text});
  }
 }
 return out;
}
