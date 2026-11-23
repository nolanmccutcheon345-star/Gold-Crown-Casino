import {describe,it,expect} from 'vitest';
import {applyCommand,legalActions} from '../../src/core/engine';
import {createMtt,settleRound,checkMtt,closeRegistrationPlaces,mttStandings,heroTable,type MttState,type MttDeps} from '../../src/tournament/multi-table';
import {createMttEvent,mttTournamentView,validateMttEvent,applyMttRound} from '../../src/tournament/mtt-event';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {EVENT_PRESETS,entryCost,payoutLadder} from '../../src/tournament/presets';
import {addMoney,settleTournamentHand,auditTournamentData,INITIAL_TOURNAMENT_BALANCE,TOURNAMENT_GENESIS_VERSION,type TournamentData} from '../../src/tournament/runtime';

const deps=(seed=7):MttDeps=>{let n=seed,id=0;return {random:limit=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n%limit;},token:()=>++n,handId:()=>`independent-registration-${seed}-${++id}`};};
const names=Array.from({length:18},(_,i)=>i===0?'You':`Player ${i}`);
function state(registration=true){return createMtt({entrants:18,startingStack:1000,levels:[{level:1,smallBlind:5,bigBlind:10,ante:0}],handsPerLevel:1,ladder:payoutLadder(18000,18),names,...(registration?{registration:{closesAfterRound:4,maxEntriesPerPerson:2,reserve:[{name:'Late A',round:2},{name:'Late B',round:5}]}}:{})},deps());}
function playAll(s:MttState){for(const table of s.tables){let game=table.game,guard=0;while(game.street!=='complete'){
 const legal=legalActions(game),action=legal.canRaise?{type:'raise' as const,to:legal.maxRaiseTo!}:legal.check?{type:'check' as const}:{type:'call' as const};
 game=applyCommand(game,{handId:game.handId,revision:game.revision,seatId:game.actor!,decisionId:`allin-${game.handId}-${game.revision}`,action});expect(++guard).toBeLessThan(100);
}table.game=game;}}
function data(){const preset=EVENT_PRESETS.find(p=>p.id==='daily-125')!,event=createMttEvent({id:'registration-independent',preset,entrants:27,pace:'fast',startedAt:'2026-11-19T00:00:00.000Z',lateRegistration:true},deps(19));const d:TournamentData={schemaVersion:1,genesisVersion:TOURNAMENT_GENESIS_VERSION,revision:0,balance:0,ledger:[],active:event,completed:[]};addMoney(d,{id:'tournament-initial',kind:'initial',amount:INITIAL_TOURNAMENT_BALANCE,at:event.startedAt,note:'test'});addMoney(d,{id:`entry:${event.id}`,kind:'entry',amount:-entryCost(preset),eventId:event.id,at:event.startedAt,note:'test'});return d;}

function forceEventRound(d:TournamentData){const e=d.active!,s=e.mtt!.state,hero=s.status==='running'?heroTable(s):null;playAll(s);if(hero){e.game=hero.game;settleTournamentHand(d,e,'2026-11-19T00:01:00.000Z');}
 const played={round:s.round,records:s.tables.filter(t=>t!==hero).map(t=>({round:s.round,table:t.number,token:1,state:t.game}))};applyMttRound(d,e,played,{...deps(31+s.round*100),random:()=>0},'2026-11-19T00:02:00.000Z');return played;
}

describe('independent registration authority and conservation',()=>{
 it('forces real busts/re-entries and checks one fresh stack per new entry, final prizes and unique places',()=>{
  const s=state(),d=deps(22);let guard=0,closedCount:number|undefined;
  while(s.status!=='complete'&&guard++<30){const round=s.round,old=s.players.length;playAll(s);settleRound(s,d,{reEnters:()=>true,ladderFor:n=>payoutLadder(n*1000,n)});checkMtt(s);
   expect(s.players.reduce((a,p)=>a+p.stack,0)).toBe(s.players.length*1000);expect(s.ladder.reduce((a,b)=>a+b,0)).toBe(s.players.length*1000);
   expect(s.players.length).toBeGreaterThanOrEqual(old);if(round>=4){closedCount??=s.players.length;expect(s.players.length).toBe(closedCount);}
   const reg=s.registration!;expect(reg.entries.filter(e=>e.name==='You')).toHaveLength(1);expect(reg.entries.some(e=>e.parent===0)).toBe(false);
   for(const e of reg.entries.filter(e=>e.kind==='re-entry')){expect(reg.out.some(o=>o.player===e.parent&&o.round===e.round-1)).toBe(true);expect(reg.entries.filter(x=>x.parent===e.parent)).toHaveLength(1);expect(reg.entries[e.parent!].kind).not.toBe('re-entry');}
   if(String(s.status)!=='complete'&&s.round<=4)expect(s.finishes).toHaveLength(0);
   if(String(s.status)!=='complete'){const alive=s.players.filter(p=>p.table!==null);expect(mttStandings(s,true).playersLeft).toBe(alive.length);expect(mttStandings(s,true).playerIds).toEqual(alive.map(p=>p.id));}
  }
  expect(s.status).toBe('complete');expect(s.registration!.entries.some(e=>e.kind==='re-entry')).toBe(true);expect(s.finishes).toHaveLength(s.players.length);expect(new Set(s.finishes.map(f=>f.player)).size).toBe(s.players.length);expect(s.finishes.reduce((a,f)=>a+f.prize,0)).toBe(s.players.length*1000);
  const ranks=s.finishes.flatMap(f=>Array.from({length:f.ties},(_,i)=>f.place+i));for(let p=1;p<=s.players.length;p++)expect(ranks).toContain(p);
 });
 it('keeps absent registration a fixed 18-entry freezeout with no injected chips',()=>{const s=state(false),d=deps(33);for(let i=0;i<30&&s.status!=='complete';i++){playAll(s);settleRound(s,d);checkMtt(s);expect(s.players).toHaveLength(18);expect(s.players.reduce((n,p)=>n+p.stack,0)).toBe(18000);}expect(s.status).toBe('complete');expect(s.registration).toBeUndefined();expect(s.finishes).toHaveLength(18);expect(s.finishes.reduce((n,f)=>n+f.prize,0)).toBe(18000);});
 it('ranks later eliminations first, ties on equal starting stacks and conserves odd prize cents',()=>{const got=closeRegistrationPlaces([{player:1,start:100,round:1},{player:2,start:100,round:3},{player:3,start:100,round:3},{player:4,start:200,round:3}],2,[100,50,31,12,9,3],names);expect(got.map(x=>[x.player,x.place,x.ties,x.prize])).toEqual([[4,3,1,31],[2,4,2,11],[3,4,2,10],[1,6,1,3]]);});
 it('accepts the normal new-event registration record',()=>{const d=data();expect(()=>validateMttEvent(d,d.active!,true)).not.toThrow();});
 it.each([
  ['window length',(d:TournamentData)=>{d.active!.mtt!.state.registration!.closesAfterRound++;}],
  ['entry limit',(d:TournamentData)=>{d.active!.mtt!.state.registration!.maxEntriesPerPerson=3;}],
  ['fractional reserve round',(d:TournamentData)=>{d.active!.mtt!.state.registration!.reserve[0].round=2.5;}],
  ['duplicate reserve name',(d:TournamentData)=>{d.active!.mtt!.state.registration!.reserve[0].name=d.active!.mtt!.state.players[1].name;}],
  ['fabricated knockout',(d:TournamentData)=>{d.active!.mtt!.state.registration!.out.push({player:1,start:d.active!.preset.startingStack,round:1});}],
 ] as const)('rejects forged %s even when outer save is resealed',(_,edit)=>{const d=data();edit(d);expect(()=>validateMttEvent(d,d.active!,true)).toThrow();});
 it('archives growing field with exact Hero charge/prize and rejects altered re-entry identity',async()=>{let d=data();const initial=d.balance,port=new MemoryTournamentPersistence();await port.commit(null,d);let guard=0,checkedParent=false;
  while(d.active!.status!=='complete'&&guard++<30){const expected=d.revision;forceEventRound(d);d.revision++;expect(()=>auditTournamentData(d)).not.toThrow();const e=d.active!;
   expect(e.prizePool).toBe(e.preset.buyIn*e.mtt!.state.players.length);expect(e.feeTotal).toBe(e.preset.fee*e.mtt!.state.players.length);expect(d.ledger.filter(r=>r.kind==='entry')).toHaveLength(1);
   const re=e.mtt!.state.registration!.entries.find(x=>x.kind==='re-entry');if(re&&!checkedParent){checkedParent=true;const forged=structuredClone(d);forged.active!.profiles[re.player].looseness=1-forged.active!.profiles[re.parent!].looseness;expect(()=>validateMttEvent(forged,forged.active!,true)).toThrow();}
   await port.commit(expected,d);const restored=await port.load();expect(restored).toEqual(d);d=restored!;expect(()=>auditTournamentData(d)).not.toThrow();
  }
  expect(checkedParent).toBe(true);expect(d.active!.status).toBe('complete');const finish=d.active!.finishes.find(f=>f.seatId===0)!;expect(d.balance).toBe(initial+finish.prize);expect(d.ledger.filter(r=>r.kind==='prize')).toHaveLength(1);const expected=d.revision;d.completed.push(d.active!);d.active=null;d.revision++;await port.commit(expected,d);expect(await port.load()).toEqual(d);expect(()=>auditTournamentData(d)).not.toThrow();
 },20000);
 it('never advertises registration open on a completed event',()=>{const d=data();d.active!.status='complete';d.active!.mtt!.state.status='complete';expect(mttTournamentView(d.active!).registration?.open).toBe(false);});
});
