import {describe,expect,it} from 'vitest';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {validateTournamentData,settleTournamentHand,tournamentProfile,tournamentGameView,auditTournamentData,type TournamentData} from '../../src/tournament/runtime';
import {applyCommand,legalActions,nextTournamentHand} from '../../src/core/engine';
import {SPECIAL_PRESETS,EVENT_PRESETS,ALL_PRESETS,findPreset,satelliteLadder,ladderFor,payoutLadder,blindSchedule,entryCost,startingBigBlinds,summarizeEvent,seatTargetOf} from '../../src/tournament/presets';
import {lobbyMarkup,normalizeLobby,TIER_LABELS} from '../../src/tournament/screens';

function allInHand(data:TournamentData){const event=data.active!;let actions=0;while(event.game.street!=='complete'){const g=event.game,l=legalActions(g);event.game=applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:`fixture:${g.handId}:${g.revision}`,action:l.canRaise?{type:'raise',to:l.maxRaiseTo!}:l.check?{type:'check'}:{type:'call'}});event.frames.push(tournamentGameView(event.game));expect(++actions).toBeLessThan(100);}settleTournamentHand(data,event,new Date().toISOString());}
function complete(data:TournamentData){let count=0;while(data.active!.status!=='complete'){allInHand(data);validateTournamentData(data);if(String(data.active!.status)==='complete')break;const event=data.active!;event.handNumber++;event.game=nextTournamentHand(event.game,`p72-next-${++count}`,tournamentProfile(event,event.handNumber));event.frames=[tournamentGameView(event.game)];expect(count).toBeLessThan(100);}return data;}
async function play(presetId:string,entrants:number){
 const port=new MemoryTournamentPersistence();let c=new TournamentController(port);await c.init();const before=c.data!.balance;
 await c.startEvent(presetId,entrants,'fast');expect(c.error).toBe('');expect(c.data!.balance).toBe(before-entryCost(findPreset(presetId)!));
 const data=complete(structuredClone(c.data!));data.revision++;await port.commit(c.data!.revision,data);
 c=new TournamentController(port);await c.init();expect(c.error).toBe('');const event=c.data!.active!;const view=c.view;
 await c.finishEvent();expect(c.error).toBe('');auditTournamentData(structuredClone(c.data!));
 return {c,event,view,before};
}

describe('Patch 72 sit & go and satellite catalogue',()=>{
 it('keeps the main catalogue as it was and adds consistent special events',()=>{
  expect(new Set(EVENT_PRESETS.map(p=>p.tier))).toEqual(new Set(['home','casino','series']));
  expect(new Set(ALL_PRESETS.map(p=>p.id)).size).toBe(ALL_PRESETS.length);
  for(const preset of SPECIAL_PRESETS){
   expect(['sng','satellite']).toContain(preset.tier);expect(preset.buyIn%100).toBe(0);expect(preset.fee%100).toBe(0);expect(preset.fee).toBeGreaterThan(0);expect(preset.fee).toBeLessThanOrEqual(preset.buyIn);
   expect(startingBigBlinds(preset)).toBeGreaterThanOrEqual(50);expect(startingBigBlinds(preset)).toBeLessThanOrEqual(300);expect(blindSchedule(preset)).toHaveLength(40);
   for(const field of preset.fields){const s=summarizeEvent(preset,field,'fast');expect(s.ladder.reduce((a,b)=>a+b,0)).toBe(s.prizePool);s.ladder.forEach((p,i)=>{expect(p%100).toBe(0);expect(p).toBeGreaterThan(0);if(i)expect(p).toBeLessThanOrEqual(s.ladder[i-1]);});}
   if(preset.satellite){const target=findPreset(preset.satellite.target)!;expect(target.tier).not.toBe('satellite');expect(preset.satellite.seat).toBe(entryCost(target));expect(seatTargetOf(preset).seatTarget).toEqual({id:target.id,name:target.name,seat:entryCost(target)});}
   else expect(seatTargetOf(preset)).toEqual({});
  }
 });
 it('pays satellites in whole seats, the leftover to the next place',()=>{
  expect(satelliteLadder(40500,40000)).toEqual([40000,500]);expect(satelliteLadder(80000,40000)).toEqual([40000,40000]);
  const sat=findPreset('sat-series-400')!;expect(ladderFor(sat,sat.buyIn*45,45)).toEqual([40000,40000,40000,40000,40000,2500]);
  expect(()=>satelliteLadder(30000,40000)).toThrow();
  const sng=findPreset('sng-turbo-55')!;expect(ladderFor(sng,sng.buyIn*9,9)).toEqual(payoutLadder(sng.buyIn*9,9));expect(ladderFor(sng,sng.buyIn*6,6)).toEqual([19500,10500]);
 });
 it('offers sit & go and satellite tabs in the lobby, with what a satellite awards',()=>{
  expect(Object.keys(TIER_LABELS)).toEqual(['home','casino','series','sng','satellite']);
  expect(normalizeLobby({tier:'sng'}).presetId.startsWith('sng-')).toBe(true);
  const html=lobbyMarkup({tier:'satellite',presetId:'sat-series-400',entrants:18,pace:'fast'},{available:true,reason:''});
  expect(html).toContain('data-tournament-tier="satellite"');expect(html).toContain('data-testid="satellite-note"');expect(html).toContain('2 seats');expect(html).toContain('$10 to the next place');
  expect(lobbyMarkup({tier:'sng',presetId:'sng-hyper-30',entrants:6,pace:'fast'},{available:true,reason:''})).not.toContain('satellite-note');
 });
});

describe('Patch 72 playing the events',()=>{
 it.each([['sng-turbo-55',9],['sng-hyper-30',6]] as const)('plays a %s sit & go of %i to the end and pays the ladder',async(id,n)=>{
  const {c,event,before}=await play(id,n);
  expect(event.finishes).toHaveLength(n);expect(event.finishes.reduce((a,f)=>a+f.prize,0)).toBe(event.prizePool);
  const hero=event.finishes.find(f=>f.seatId===0)!;expect(c.data!.balance).toBe(before-entryCost(findPreset(id)!)+hero.prize);
 },180000);
 it('plays a single-table satellite: one seat, the leftover to second, and the view names the target',async()=>{
  const {event,view}=await play('sat-series-400',9);
  expect(event.ladder).toEqual([40000,500]);expect(view?.seatTarget).toEqual({id:'series-400',name:findPreset('series-400')!.name,seat:40000});
  /* Players busting on the same hand split the prizes of the places they share, so check the totals. */
  expect(event.finishes.reduce((a,f)=>a+f.prize,0)).toBe(40500);expect(event.finishes.find(f=>f.place===1)!.prize).toBe(40000);
 },180000);
 it('starts and reloads a multi-table satellite with seats for its field',async()=>{
  const port=new MemoryTournamentPersistence(),c=new TournamentController(port);await c.init();await c.startEvent('sat-main-1700',18,'fast');expect(c.error).toBe('');
  expect(c.data!.active!.ladder).toEqual([170000,170000,2000]);
  const again=new TournamentController(port);await again.init();expect(again.error).toBe('');expect(again.view?.seatTarget?.id).toBe('series-1700');
 },60000);
 it('refuses fields an event does not offer',async()=>{
  const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('sng-turbo-55',18,'fast');expect(c.data!.active).toBeNull();
 });
});

describe('Patch 72 seat result',()=>{
 it('says you won a seat and offers to register for it, and only for a seat-sized prize',async()=>{
  const {resultMarkup}=await import('../../src/tournament/screens');
  const {sampleView}=await import('../tournament/fixtures');
  const base=sampleView({presetId:'daily-125',entrants:9,playersLeft:1} as never);
  const seatTarget={id:'series-400',name:'Series opener $400',seat:40000};
  const won=resultMarkup({...base,status:'complete',seatTarget,result:{place:1,entrants:9,prize:40000,cost:5000,handsPlayed:80}});
  expect(won).toContain('You won a seat in Series opener $400.');expect(won).toContain('data-seat-target="series-400"');expect(won).toContain('data-testid="seat-won"');
  const rest=resultMarkup({...base,status:'complete',seatTarget,result:{place:2,entrants:9,prize:500,cost:5000,handsPlayed:80}});
  expect(rest).not.toContain('data-seat-target');expect(rest).toContain('in the money');
  expect(resultMarkup({...base,status:'complete',result:{place:1,entrants:9,prize:40000,cost:5000,handsPlayed:80}})).toContain('You won the tournament.');
 });
});
