import {describe,it,expect} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {GameState,RuleProfile,Action,Card,BotObservation,BotProfile} from '../../src/contracts';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {startHand,applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {seedStream,createProfile,ARCHETYPES} from '../../src/bots/profiles';
import {regularProfile} from '../../src/bots/regulars';
import {HUMAN_LAYER_V116} from '../../src/bots/human';
import {passivePotPlay} from '../../src/bots/passive-pots';
import {sessionMoodOf,moodedProfile,MOOD_LINES,SESSION_MOODS} from '../../src/bots/session-mood';
import {handChatter,MOMENT_LINES} from '../../src/bots/talk';
import {bubblePlay,bubbleRole,moneyPressure} from '../../src/tournament/bubble-play';
import type {TournamentContext} from '../../src/tournament/bot-policy-v2';
import {NEW_EVENT_TOURNAMENT_POLICY,TOURNAMENT_POLICY_V219} from '../../src/tournament/bot-policy';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData,tournamentMoment} from '../../src/tournament/runtime';

/* Patch 48: betting in passive pots, bubble and final-table roles, session moods (cash human-1.16.0, tournament 2.19.0). */
class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){if((this.value?.revision??null)!==expected)throw Error('Revision changed');this.value=structuredClone(next);}close(){}}
const cash:RuleProfile={id:'pb',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const act=(s:GameState,a:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action:a});
const mix=(i:number)=>(Math.imul(i+1,2654435761)^40503)>>>0;
const rate=(n:number,f:(i:number)=>boolean|string|null)=>{let k=0;for(let i=0;i<n;i++)if(f(i))k++;return k/n;};
const hiro=regularProfile('hiro','high'),earl=regularProfile('big-earl','low'),lag=createProfile({selection:'lag'},3,'neutral'),station=createProfile({selection:'station'},3,'neutral');
const see=(s:GameState,cards:string[],p:BotProfile,board?:string[]):BotObservation=>{const o=observeBot(s,s.actor!,p.policyVersion,'v');o.ownCards=cards as Card[];if(board)o.board=board as Card[];return o;};
const hand=(id:string,stacks=[20000,20000,20000,20000,20000,20000])=>startHand({handId:id,button:0,profile:cash,seats:stacks.map((stack,k)=>({id:k,name:`S${k}`,stack}))});
const legal=(s:GameState,r:{action:Action;play:unknown}[])=>{for(const x of r.filter(x=>x.play))expect(()=>act(s,x.action)).not.toThrow();};

describe('betting in passive multiway pots',()=>{
  function checkedAround(id:string){let s=hand(id);for(const a of [{type:'fold'},{type:'call'},{type:'call'},{type:'fold'},{type:'call'},{type:'check'},{type:'check'},{type:'check'},{type:'check'}] as Action[])s=act(s,a);return s;}
  it('the last player in a checked-around multiway pot stabs with a pair or a draw; aggressive players more',()=>{
    const s=checkedAround('pp');expect(s.street).toBe('flop');expect(s.actor).toBe(5);const B=['Kh','7d','2c'];
    const r=[...Array(400).keys()].map(i=>passivePotPlay(see(s,['7c','8d'],lag,B),lag,{type:'check'},seedStream(mix(i))));
    expect(rate(400,i=>r[i].play!==null)).toBeGreaterThan(.15);legal(s,r);
    const st=rate(400,i=>passivePotPlay(see(s,['7c','8d'],station,B),station,{type:'check'},seedStream(mix(i))).play!==null);
    expect(st).toBeGreaterThan(.03);expect(st).toBeLessThan(rate(400,i=>r[i].play!==null));
    expect(rate(400,i=>passivePotPlay(see(s,['Qc','9d'],lag,B),lag,{type:'check'},seedStream(mix(i))).play)).toBe(0);
  });
  it('not before everyone has checked, and not heads-up',()=>{
    let s=hand('p2');for(const a of [{type:'fold'},{type:'call'},{type:'call'},{type:'fold'},{type:'call'},{type:'check'},{type:'check'},{type:'check'}] as Action[])s=act(s,a);expect(s.actor).toBe(4);
    expect(rate(200,i=>passivePotPlay(see(s,['7c','8d'],lag,['Kh','7d','2c']),lag,{type:'check'},seedStream(mix(i))).play)).toBe(0);
    let h=hand('p3');for(const a of [{type:'fold'},{type:'fold'},{type:'raise',to:500},{type:'fold'},{type:'fold'},{type:'call'},{type:'check'}] as Action[])h=act(h,a);
    expect(rate(200,i=>passivePotPlay(see(h,['7c','8d'],lag,['Kh','7d','2c']),lag,{type:'check'},seedStream(mix(i))).play)).toBe(0);
  });
});

describe('session moods',()=>{
  it('one mood per session and occupant; recreational players are more often out for fun, regulars grinding',()=>{
    const count=(p:BotProfile)=>{const c:Record<string,number>={};for(let i=0;i<4000;i++){const m=sessionMoodOf(`s${i}`,p);c[m]=(c[m]??0)+1;}return c;};
    const rec=count(earl),reg=count(hiro);expect(rec.fun).toBeGreaterThan(reg.fun*2);expect(reg.grinding).toBeGreaterThan(rec.grinding*2);
    for(const m of SESSION_MOODS)expect(rec[m]).toBeGreaterThan(0);
    expect(sessionMoodOf('x',earl)).toBe(sessionMoodOf('x',earl));
  });
  it('moods shift the profile the way they should, and every mood has a line',()=>{
    const p=createProfile({selection:'tag'},5,'neutral'),fun=moodedProfile(p,'fun'),tired=moodedProfile(p,'tired'),grind=moodedProfile(p,'grinding'),conf=moodedProfile(p,'confident');
    expect(fun.looseness).toBeGreaterThan(p.looseness);expect(tired.skill!).toBeLessThan(p.skill!);expect(tired.aggression).toBeLessThan(p.aggression);
    expect(grind.looseness).toBeLessThan(p.looseness);expect(conf.aggression).toBeGreaterThan(p.aggression);expect(fun.personalityId).toBe(p.personalityId);
    for(const m of SESSION_MOODS)expect(MOOD_LINES[m].length).toBeGreaterThan(0);
  });
});

describe('bubble and final-table roles',()=>{
  const ctx=(left:number,paid:number,stacks:number[]):TournamentContext=>({playersLeft:left,paid,stacks:[...stacks,...Array(Math.max(0,left-stacks.length)).fill(20000)].slice(0,left)});
  it('pressure is high on the bubble and at a final table, low far from the money',()=>{
    expect(moneyPressure(ctx(19,18,[]))).toBe(1);expect(moneyPressure(ctx(40,18,[]))).toBeLessThan(.5);
    expect(moneyPressure({...ctx(8,9,[]),prizes:[500,300,200]})).toBeGreaterThanOrEqual(.6);
    expect(bubbleRole(60000,200,ctx(19,18,[60000]))).toBe('big');expect(bubbleRole(2000,200,ctx(19,18,[]))).toBe('short');expect(bubbleRole(20000,200,ctx(19,18,[]))).toBe('medium');
  });
  it('big stacks open wider and 3-bet medium stacks; medium stacks fold to a covering raise; legal',()=>{
    const stacks=[20000,20000,20000,60000,20000,20000],c=ctx(19,18,stacks);
    const s=hand('bo',stacks);expect(s.actor).toBe(3);
    const open=[...Array(400).keys()].map(i=>bubblePlay(see(s,['Kd','9c'],hiro),hiro,{type:'fold'},c,seedStream(mix(i))));
    expect(rate(400,i=>open[i].play==='bully-open')).toBeGreaterThan(.2);legal(s,open);
    expect(rate(400,i=>bubblePlay(see(s,['Kd','9c'],hiro),hiro,{type:'fold'},ctx(60,18,stacks),seedStream(mix(i))).play)).toBe(0);
    const r=act(s,{type:'raise',to:500});expect(r.actor).toBe(4);
    const fold=[...Array(400).keys()].map(i=>bubblePlay(see(r,['Kd','9c'],hiro),hiro,{type:'call'},c,seedStream(mix(i))));
    expect(rate(400,i=>fold[i].play==='ladder-fold')).toBeGreaterThan(.2);
    expect(rate(400,i=>bubblePlay(see(r,['Ac','Ad'],hiro),hiro,{type:'call'},c,seedStream(mix(i))).play)).toBe(0);
    expect(rate(400,i=>bubblePlay(see(r,['Kd','9c'],station),station,{type:'call'},c,seedStream(mix(i))).play==='ladder-fold')).toBeLessThan(rate(400,i=>fold[i].play==='ladder-fold'));
  });
  it('short stacks hang on when someone else is shorter',()=>{
    const stacks=[20000,20000,20000,2000,20000,20000],s=hand('ho',stacks);expect(s.actor).toBe(3);const o=see(s,['Kd','9c'],hiro);
    const shove={type:'raise',to:o.legal.maxRaiseTo!} as Action;
    expect(rate(400,i=>bubblePlay(o,hiro,shove,ctx(19,18,[...stacks,1000]),seedStream(mix(i))).play==='hang-on')).toBeGreaterThan(.2);
    expect(rate(400,i=>bubblePlay(o,hiro,shove,ctx(19,18,stacks),seedStream(mix(i))).play)).toBe(0);
  });
  it('the table talks on the bubble, when it bursts and at the final table',()=>{
    const personas=Object.fromEntries([1,2,3,4,5].map(id=>[id,{name:`S${id}`,profile:createProfile({selection:ARCHETYPES[id%ARCHETYPES.length]},id,'neutral')}]));
    const said=(m:'bubble'|'burst'|'final-table')=>rate(60,i=>{let g=hand(`t${m}${i}`);while(g.street!=='complete')g=act(g,legalActions(g).check?{type:'check'}:{type:'fold'});
      return handChatter(g,personas,{tournament:true,moment:m}).lines.some(l=>(MOMENT_LINES[m] as readonly string[]).includes(l.text));});
    expect(said('burst')).toBeGreaterThan(.5);expect(said('final-table')).toBeGreaterThan(.5);expect(said('bubble')).toBeGreaterThan(.15);
  });
});

describe('versions and full runs',()=>{
  it('new cash tables use 1.16.0: complete legal hands and mood lines in the table news',async()=>{
    const c=new SessionController(new Port());await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:6});expect(c.data!.active!.humanLayer).toBe('human-1.21.0');
    const lines:string[]=[];
    for(let h=0;h<40;h++){for(let i=0;i<600&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;
      if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}
     if(h<39){if(c.data!.active!.game.seats.find(s=>s.id===0)!.stack<2000)await c.topUp(DEFAULT_SETTINGS.buyIn);await c.nextHand();expect(c.error).toBe('');const n=c.data!.active!.churnNews;if(n)lines.push(...n.lines);}}
    const moodLines=Object.values(MOOD_LINES).flat();expect(lines.some(l=>moodLines.some(m=>l.endsWith(`“${m}”`)))).toBe(true);
  },400000);
  it('a 2.19.0 event runs to the end, passes the audit, and marks the bubble',async()=>{
    expect(NEW_EVENT_TOURNAMENT_POLICY).toBe('synthetic-tournament-2.23.0');
    const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('home-20',9,'fast');expect(c.error).toBe('');
    const moments=new Set<string>();
    for(let guard=0;guard<20000&&c.data!.active!.status!=='complete';guard++){const a=c.data!.active!,g=c.gameView!;
     if(a.game.street==='complete'){const m=tournamentMoment(a);if(m)moments.add(m);await c.nextHand();expect(c.error).toBe('');continue;}
     if(a.game.actor===0)await c.act({type:g.legal.check?'check':'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(a.game.handId,a.game.revision);}expect(c.error).toBe('');}
    expect(c.data!.active!.status).toBe('complete');expect(auditTournamentData(c.data!)).toBeGreaterThan(0);
    expect(moments.has('bubble')||moments.has('burst')).toBe(true);c.close();
  },600000);
});
