/** Patch 67: an optional dealer voice. It reads out what a live dealer says aloud: the board as it comes,
 * all-ins, and who takes the pot. Display only: it uses the browser's own speech, and stays silent when the
 * browser has none. */
import type {Card,HeroViewModel} from '../contracts';

const RANK:Record<string,string>={A:'ace',K:'king',Q:'queen',J:'jack',T:'ten','9':'nine','8':'eight','7':'seven','6':'six','5':'five','4':'four','3':'three','2':'deuce'};
const SUIT:Record<string,string>={c:'clubs',d:'diamonds',h:'hearts',s:'spades'};
const said=(card:Card)=>`${RANK[card[0]]} of ${SUIT[card[1]]}`;
/** What the dealer says between two views of the same hand (or at the start of a new one). */
export function dealerLines(before:HeroViewModel|null,after:HeroViewModel):string[] {
 const same=before?.handId===after.handId,out:string[]=[];
 const boardBefore=same?before!.board.length:0,eventsBefore=same?before!.events.length:0;
 if(after.board.length>=3&&boardBefore<3)out.push(`Flop: ${after.board.slice(0,3).map(said).join(', ')}.`);
 if(after.board.length>=4&&boardBefore<4)out.push(`Turn: ${said(after.board[3])}.`);
 if(after.board.length>=5&&boardBefore<5)out.push(`River: ${said(after.board[4])}.`);
 for(const e of after.events.slice(eventsBefore)){
  if(e.type!=='action'||e.seatId===undefined)continue;
  const seat=after.seats.find(s=>s.id===e.seatId);
  if(seat?.allIn&&(e.action?.type==='raise'||e.action?.type==='call'))out.push(`${e.seatId===0?'You are':`${seat.name} is`} all in.`);
 }
 if(after.street==='complete'&&(!same||before!.street!=='complete')){
  const winners=Object.entries(after.payouts).filter(([,v])=>v>0).map(([id])=>after.seats.find(s=>s.id===Number(id))?.name).filter(Boolean) as string[];
  if(winners.length===1)out.push(`${winners[0]==='You'?'You take':`${winners[0]} takes`} the pot.`);else if(winners.length>1)out.push('Split pot.');
 }
 return out;
}
/** Say the lines, if the browser can. Never throws. */
export function speakDealer(lines:readonly string[]):void {
 try{
  const synth=typeof window!=='undefined'?window.speechSynthesis:undefined;if(!synth||!lines.length)return;
  for(const line of lines){const u=new SpeechSynthesisUtterance(line);u.rate=1.05;u.pitch=.95;u.volume=.9;synth.speak(u);}
 }catch{/* no speech on this device */}
}
