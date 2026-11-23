import {describe,it,expect} from 'vitest';
import type {GameState,RuleProfile} from '../../src/contracts';
import {startHand,applyCommand,observeBot,assertAccounting} from '../../src/core/engine';
import {seedStream,createProfile,presetTraits,ARCHETYPES} from '../../src/bots/profiles';
import {REGULARS,regularProfile} from '../../src/bots/regulars';
import {chooseTournamentDecision,NEW_EVENT_TOURNAMENT_POLICY,TOURNAMENT_POLICY_V21,TOURNAMENT_POLICY_V22,supportedTournamentPolicy} from '../../src/tournament/bot-policy';
import {chooseTournamentV2 as frozenV21} from './frozen-p29-policy-v21';
import {drawField,fieldNames,fieldPopulation,regularCount,regularPool,validateField,baseNames} from '../../src/tournament/field';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData} from '../../src/tournament/runtime';
import {EVENT_PRESETS} from '../../src/tournament/presets';

const rules:RuleProfile={id:'policy-v22',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:200,antePriority:'blind-first',buttonRule:'dead-button'}};
const standings=(game:GameState,left:number,paid:number)=>{const t=game.seats.map(s=>s.startingStack);return {playersLeft:left,paid,stacks:[...t,...Array(Math.max(0,left-t.length)).fill(4000)].slice(0,left)};};
function deps(seed:number){let s=seed>>>0;const next=()=>{s=(Math.imul(s,1103515245)+12345)>>>0;return s;};return {random:(n:number)=>next()%n,token:()=>next()};}

describe('tournament policy 2.2.0 (personal quirks)',()=>{
 it('remains supported, and 2.1.0 decisions stay identical to saved Version 47',()=>{
  expect(supportedTournamentPolicy(TOURNAMENT_POLICY_V22)).toBe(true);
  let compared=0;
  for(const archetype of ARCHETYPES)for(const depth of [5,14,30]){
   const profile=createProfile({selection:archetype},52,'neutral');
   let game=startHand({handId:`p29:${archetype}:${depth}`,button:depth%9,profile:rules,seats:Array.from({length:9},(_,id)=>({id,name:`S${id}`,stack:depth*200+id*120}))});
   for(let step=0;game.street!=='complete'&&step<200;step++){
    const o=observeBot(game,game.actor!,profile.policyVersion,`p29:${step}`),field=standings(game,5,4);
    const now=chooseTournamentDecision(o,profile,seedStream(step+depth),TOURNAMENT_POLICY_V21,field);
    expect(now).toEqual(frozenV21(o,profile,seedStream(step+depth),field));game=applyCommand(game,now);compared++;
   }
  }
  expect(compared).toBeGreaterThan(100);
 });
 it('plays exactly like 2.1.0 for a player whose traits match their style',()=>{
  let compared=0;
  for(const archetype of ARCHETYPES){
   const stock=createProfile({selection:archetype},9,'neutral'),exact=createProfile({selection:'custom',baseArchetype:archetype,traits:presetTraits(archetype),aggression:stock.aggression,looseness:stock.looseness,skill:stock.skill},9,'neutral');
   let game=startHand({handId:`exact:${archetype}`,button:3,profile:rules,seats:Array.from({length:9},(_,id)=>({id,name:`S${id}`,stack:(6+id*3)*200}))});
   for(let step=0;game.street!=='complete'&&step<200;step++){
    const o=observeBot(game,game.actor!,exact.policyVersion,`e:${step}`),field=standings(game,6,4);
    const a=chooseTournamentDecision(o,exact,seedStream(step),TOURNAMENT_POLICY_V22,field),b=chooseTournamentDecision(o,exact,seedStream(step),TOURNAMENT_POLICY_V21,field);
    expect(a.action).toEqual(b.action);game=applyCommand(game,a);compared++;
   }
  }
  expect(compared).toBeGreaterThan(20);
 });
 it.each(REGULARS.map(r=>r.id))('plays complete legal tournament hands as %s',id=>{
  const profile=regularProfile(id,'mid');
  for(let seed=0;seed<4;seed++){let s=startHand({handId:`${id}:${seed}`,button:seed%9,profile:rules,seats:Array.from({length:9},(_,i)=>({id:i,name:`S${i}`,stack:200*(3+((seed*5+i*7)%45))}))});
   const field=standings(s,10,9);
   for(let n=0;s.street!=='complete'&&n<200;n++){const o=observeBot(s,s.actor!,profile.policyVersion,`q:${n}`);s=applyCommand(s,chooseTournamentDecision(o,profile,seedStream(seed*100+n),TOURNAMENT_POLICY_V22,field));assertAccounting(s);}
   expect(s.street).toBe('complete');}
 });
});

describe('tournament fields with regulars',()=>{
 it('seats about four in ten regulars, the rest from the tier population, with unique names',()=>{
  for(const preset of EVENT_PRESETS)for(const entrants of preset.fields){
   const d=deps(entrants*31+preset.buyIn),drawn=drawField(preset,entrants,d.random,d.token);
   const regs=Object.entries(drawn.field.regulars);
   expect(regs.length).toBe(regularCount(entrants,regularPool(preset).length));for(const [,id] of regs)expect(regularPool(preset)).toContain(id);expect(new Set(regs.map(([,id])=>id)).size).toBe(regs.length);
   expect(drawn.field.population).toBe(fieldPopulation(preset));
   expect(drawn.names[0]).toBe('You');expect(new Set(drawn.names).size).toBe(entrants);expect(drawn.names).toEqual(fieldNames(entrants,drawn.field));
   for(const [player,id] of regs)expect(drawn.profiles[Number(player)]).toEqual(regularProfile(id,drawn.field.population));
   for(let p=1;p<entrants;p++)if(!drawn.field.regulars[String(p)])expect(drawn.profiles[p].environment).toBe(drawn.field.population);
   expect(()=>validateField({entrants,preset,profiles:drawn.profiles,field:drawn.field},drawn.names)).not.toThrow();
  }
  expect(regularCount(6)).toBe(2);expect(regularCount(9)).toBe(3);expect(regularCount(27)).toBe(10);expect(regularCount(90)).toBe(20);
  expect(regularCount(90,regularPool({tier:'series'}).length)).toBe(regularPool({tier:'series'}).length);expect(regularPool({tier:'home'},'cast-1')).toHaveLength(20);
  expect(fieldPopulation({tier:'home'})).toBe('low');expect(fieldPopulation({tier:'series'})).toBe('high');
 });
 it('rejects a tampered field',()=>{
  const preset=EVENT_PRESETS.find(p=>p.id==='daily-125')!,d=deps(5),drawn=drawField(preset,27,d.random,d.token),event={entrants:27,preset,profiles:drawn.profiles,field:drawn.field};
  const [player,id]=Object.entries(drawn.field.regulars)[0];
  const styled=structuredClone(event);styled.profiles[Number(player)]={...styled.profiles[Number(player)],aggression:.01};expect(()=>validateField(styled,drawn.names)).toThrow(/style changed/);
  const renamed=[...drawn.names];renamed[Number(player)]='Alex';expect(()=>validateField(event,renamed)).toThrow(/names changed/);
  const twice=structuredClone(event);const other=Object.keys(twice.field.regulars)[1];twice.field.regulars[other]=id;expect(()=>validateField(twice,drawn.names)).toThrow(/twice/);
  const fewer=structuredClone(event);delete fewer.field.regulars[player];expect(()=>validateField(fewer,drawn.names)).toThrow(/number of regulars/);
  const population=structuredClone(event);population.field.population='high';expect(()=>validateField(population,drawn.names)).toThrow(/population/);
  expect(baseNames(9).slice(1)).toEqual(['Alex','Morgan','Jordan','Riley','Casey','Taylor','Drew','Quinn']);
 });
 it.each([['home-50',9],['daily-125',27]] as const)('new %s %s-player events seat regulars, label them in standings and pass the full audit',async(preset,entrants)=>{
  const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent(preset,entrants,'fast');
  const e=c.data!.active!;expect(e.field).toBeDefined();expect(e.tournamentPolicyVersion).toBe(NEW_EVENT_TOURNAMENT_POLICY);
  const labelled=c.view!.standings.filter(row=>row.regular);expect(labelled.length).toBe(regularCount(entrants));
  for(const row of labelled)expect(REGULARS.find(r=>r.name===row.name)?.style).toBe(row.regular);
  for(let guard=0;guard<400&&c.data!.active!.handNumber<=4;guard++){const g=c.gameView!,a=c.data!.active!;
   if(a.game.street==='complete'){await c.nextHand();continue;}
   if(g.actor===0)await c.act({type:g.legal.check?'check':'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(a.game.handId,a.game.revision);}
   expect(c.error).toBe('');}
  expect(auditTournamentData(c.data!)).toBeGreaterThan(0);c.close();
 });
});
