/** Independent cross-hand audit for multi-table events. Individual engine replays prove a
 * hand is legal; this chain additionally proves every entrant's chips and finishing place
 * came from exactly one table in each settled round. */
import type {GameState} from '../contracts';
import type {TournamentEvent,TournamentHand} from './runtime';
import {mttProfile,type MttHandRecord,type MttFinish} from './multi-table';

function requireAudit(value:unknown,message:string):asserts value {if(!value)throw Error(`Tournament round audit: ${message}`);}
// Deliberately independent of settlement's ranking helpers: replay evidence must
// detect a shared financial/ranking mistake rather than repeat that implementation.
function auditPlaces(busted:{player:number;start:number}[],place:number,ladder:readonly number[],round:number,names:readonly string[]):MttFinish[]{
 const rows=[...busted].sort((a,b)=>b.start-a.start||a.player-b.player),out:MttFinish[]=[];
 for(let index=0;index<rows.length;){let end=index+1;while(end<rows.length&&rows[end].start===rows[index].start)end++;
  const tied=end-index,pool=ladder.slice(place-1,place-1+tied).reduce((sum,n)=>sum+n,0);
  for(let n=0;n<tied;n++){const player=rows[index+n].player;out.push({player,name:names[player],place,ties:tied,prize:Math.floor(pool/tied)+(n<pool%tied?1:0),round});}
  place+=tied;index=end;
 }return out;
}
function auditDeferred(rows:{player:number;start:number;round:number}[],alive:number,ladder:readonly number[],names:readonly string[]):MttFinish[]{
 const ordered=[...rows].sort((a,b)=>b.round-a.round),out:MttFinish[]=[];let place=alive+1;
 while(ordered.length){const round=ordered[0].round,batch=ordered.filter(r=>r.round===round);out.push(...auditPlaces(batch,place,ladder,round,names));place+=batch.length;ordered.splice(0,batch.length);}return out;
}
export function auditMttContinuity(event:TournamentEvent,records:MttHandRecord[],heroHands:TournamentHand[]):void {
 const state=event.mtt!.state,settledThrough=state.status==='complete'?state.round:state.round-1;
 const names=state.players.map(player=>player.name),playerByName=new Map(names.map((name,id)=>[name,id]));
 requireAudit(playerByName.size===names.length,'entrant names are not unique');
 const reg=state.registration,out:{player:number;start:number;round:number}[]=[];
 const rounds=new Map<number,GameState[]>();
 const add=(round:number,game:GameState)=>{
  requireAudit(Number.isSafeInteger(round)&&round>=1&&round<=state.round,'invalid hand round');
  const group=rounds.get(round)??[];group.push(game);rounds.set(round,group);
 };
 for(const record of records)add(record.round,record.state);
 for(const hand of heroHands)add(hand.number,hand.state);
 // Entries join at their own round (late registration and re-entry, patch 43); without registration
 // everyone starts in round 1.
 const joinRound=(id:number)=>reg?(reg.entries[id].kind==='hero-bullet'?Infinity:reg.entries[id].round):1;
 let expected=new Map(names.filter((_,id)=>joinRound(id)===1).map(name=>[name,event.preset.startingStack]));
 const finishes:MttFinish[]=[];
 for(let round=1;round<=settledThrough;round++) {
  const games=rounds.get(round)??[],seen=new Set<string>(),next=new Map<string,number>(),busted:{player:number;start:number}[]=[];
  requireAudit(games.length>0,`missing round ${round}`);
  for(const game of games){
   requireAudit(game.street==='complete',`unfinished hand in settled round ${round}`);
   requireAudit(JSON.stringify(game.profile)===JSON.stringify(mttProfile(state,round)),`rules changed in round ${round}`);
   for(const seat of game.seats){
    requireAudit(expected.has(seat.name)&&!seen.has(seat.name),`missing, duplicate or unexpected entrant in round ${round}`);
    requireAudit(seat.startingStack===expected.get(seat.name),`stack continuity failed in round ${round}`);
    seen.add(seat.name);next.set(seat.name,seat.stack);
    if(seat.stack===0)busted.push({player:playerByName.get(seat.name)!,start:seat.startingStack});
   }
  }
  requireAudit(seen.size===expected.size,`missing table or entrant in round ${round}`);
  const survivors=[...next.entries()].filter(([,stack])=>stack>0);
  requireAudit(survivors.length>0,'round has no winner');
  requireAudit(!busted.some(b=>out.some(o=>o.player===b.player)),'an entry played after it was knocked out');
  // Hero's re-entry (patch 46): Hero sits down again as "You"; the knocked-out entry moves to its own record.
  const heroBack=reg?.heroReEntries?.find(h=>h.round===round+1);
  const joining=[...(heroBack?[names[0]]:[]),...names.flatMap((name,id)=>joinRound(id)===round+1?[name]:[])];
  const open=!!reg&&round<=reg.closesAfterRound;
  if(open)out.push(...busted.map(b=>({...b,round})));
  else finishes.push(...auditPlaces(busted,survivors.length+1,event.ladder,round,names));
  if(heroBack){requireAudit(open&&out.some(o=>o.player===0),'Hero re-entered without being knocked out in registration');for(const o of out)if(o.player===0)o.player=heroBack.bullet;}
  if(reg&&(round===reg.closesAfterRound||(open&&survivors.length+joining.length===1)))finishes.push(...auditDeferred(out,survivors.length+joining.length,event.ladder,names));
  if(survivors.length===1&&joining.length===0){
   requireAudit(round===settledThrough&&state.status==='complete','event continued after a winner');
   const player=playerByName.get(survivors[0][0])!;
   finishes.push({player,name:names[player],place:1,ties:1,prize:event.ladder[0],round});
  }
  expected=new Map([...survivors,...joining.map(name=>[name,event.preset.startingStack] as [string,number])]);
 }
 if(reg){const order=(rows:{player:number;start:number;round:number}[])=>[...rows].sort((a,b)=>a.player-b.player);requireAudit(JSON.stringify(order(reg.out))===JSON.stringify(order(out)),'pending eliminations differ from canonical hands');}
 requireAudit(JSON.stringify(finishes)===JSON.stringify(state.finishes),'finish ranking or prizes differ from canonical hands');
 const expectedStatus=expected.size===1?'complete':expected.has(names[0])&&!out.some(o=>o.player===0)?'running':'hero-out';
 requireAudit(state.status===expectedStatus,'status differs from canonical hands');
 for(const player of state.players)requireAudit(player.stack===(expected.get(player.name)??0),'current player stack differs from preceding round');
 if(state.status!=='complete'){
  const seen=new Set<string>();
  for(const table of state.tables)for(const seat of table.game?.seats??[]){
   requireAudit(expected.has(seat.name)&&!seen.has(seat.name),'current tables duplicate or resurrect an entrant');
   requireAudit(seat.startingStack===expected.get(seat.name),'current table start differs from preceding round');seen.add(seat.name);
  }
  requireAudit(seen.size===expected.size,'current tables omit an entrant');
 }
}
