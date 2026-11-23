import {afterEach,describe,expect,it} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {GameState} from '../../src/contracts';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {foldedPreflop,foldStreak,restlessLine,withRestless,CARD_DEAD,TIRED,SHORT,CARD_DEAD_HANDS} from '../../src/bots/restless';
import {matchLine,noticedMarkup,LEAK_WORDS,LADDER_IDS,type MatchState} from '../../src/ui/heads-up';

class Memory implements PersistencePort {data:AppData|null=null;async load(){return structuredClone(this.data);}async commit(e:number|null,d:AppData){if(e!==(this.data?.revision??null))throw Error('rev');this.data=structuredClone(d);}close(){}}
const controllers:SessionController[]=[];afterEach(()=>{controllers.splice(0).forEach(c=>c.close());});

const ev=(seatId:number,type:'fold'|'check'|'call'|'raise',street='preflop')=>({id:`${seatId}${type}${street}`,handId:'h',revision:0,type:'action' as const,seatId,street:street as GameState['street'],action:type==='raise'?{type,to:400}:{type}});
function game(id:string,events:ReturnType<typeof ev>[],stacks:Record<number,number>={0:20000,1:20000,2:20000}):GameState {
 return {handId:id,street:'complete',events,profile:{bigBlind:200},seats:Object.entries(stacks).map(([sid,stack])=>({id:Number(sid),startingStack:20000,stack,folded:false,hole:[]}))} as unknown as GameState;
}

describe('Patch 77 restless players',()=>{
 it('knows who played a hand without putting money in before the flop',()=>{
  expect(foldedPreflop(game('a',[ev(1,'fold')]),1)).toBe(true);expect(foldedPreflop(game('a',[ev(1,'check')]),1)).toBe(true);
  expect(foldedPreflop(game('a',[ev(1,'call')]),1)).toBe(false);expect(foldedPreflop(game('a',[ev(1,'check'),ev(1,'raise','flop')]),1)).toBe(true);expect(foldedPreflop(game('a',[]),1)).toBe(false);
  const past=[game('p0',[ev(1,'call')]),...Array.from({length:5},(_,i)=>game(`p${i+1}`,[ev(1,'fold')]))];expect(foldStreak(past,1)).toBe(5);expect(foldStreak(past,1,i=>i>=3)).toBe(3);
 });
 it('a card-dead player sometimes says so, only after a long run of folds',()=>{
  const long=Array.from({length:CARD_DEAD_HANDS},(_,i)=>game(`x${i}`,[ev(1,'fold')]));
  let said=0;for(let i=0;i<300;i++){const l=restlessLine(game(`h${i}`,[ev(1,'fold'),ev(2,'call')]),[],{streak:s=>foldStreak(long,s),handsPlayed:20,tournament:false});if(l){said++;expect(l.seatId).toBe(1);expect(CARD_DEAD).toContain(l.text);}}
  expect(said).toBeGreaterThan(50);expect(said).toBeLessThan(150);
  for(let i=0;i<300;i++)expect(restlessLine(game(`h${i}`,[ev(1,'fold')]),[],{streak:()=>3,handsPlayed:20,tournament:false})).toBeNull();
  for(let i=0;i<100;i++)expect(restlessLine(game(`h${i}`,[ev(1,'call')]),[],{streak:()=>40,handsPlayed:20,tournament:false})).toBeNull();// played this hand
 });
 it('gets tired late and short-stacked in tournaments, never from Hero',()=>{
  let tired=0,short=0;
  for(let i=0;i<500;i++){const l=restlessLine(game(`t${i}`,[]),[],{streak:()=>0,handsPlayed:200,tournament:false});if(l){tired++;expect(TIRED).toContain(l.text);expect(l.seatId).not.toBe(0);}}
  expect(tired).toBeGreaterThan(5);
  for(let i=0;i<200;i++)expect(restlessLine(game(`t${i}`,[]),[],{streak:()=>0,handsPlayed:100,tournament:false})).toBeNull();
  for(let i=0;i<300;i++){const l=restlessLine(game(`s${i}`,[],{0:20000,1:1000,2:20000}),[],{streak:()=>0,handsPlayed:10,tournament:true});if(l){short++;expect(l.seatId).toBe(1);expect(SHORT).toContain(l.text);}}
  expect(short).toBeGreaterThan(10);
 });
 it('adds at most one line, never to a hand where two already spoke, never for someone already talking',()=>{
  const long=()=>40,g=game('z',[ev(1,'fold'),ev(2,'fold')]);
  const two={lines:[{seatId:1,text:'a'},{seatId:2,text:'b'}],shows:[]};expect(withRestless(two,g,{streak:long,handsPlayed:500,tournament:false})).toBe(two);
  for(let i=0;i<200;i++){const one={lines:[{seatId:1,text:'a'}],shows:[]};const out=withRestless(one,game(`w${i}`,[ev(1,'fold'),ev(2,'fold')]),{streak:long,handsPlayed:10,tournament:false});expect(out.lines.length).toBeLessThanOrEqual(2);expect(new Set(out.lines.map(l=>l.seatId)).size).toBe(out.lines.length);}
 });
 it('counts fold streaks on real hands from the session controller',async()=>{
  const c=new SessionController(new Memory());controllers.push(c);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:4});
  for(let h=0;h<12;h++){for(let i=0;i<200&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;if(g.actor===0)await c.act({type:'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}}await c.nextHand();}
  const views=c.data!.hands.map(h=>h.view);
  for(const seat of [0,1,2,3]){const n=foldStreak(views,seat);expect(n).toBeGreaterThanOrEqual(0);expect(n).toBeLessThanOrEqual(views.length);for(let i=views.length-n;i<views.length;i++)expect(foldedPreflop(views[i],seat)).toBe(true);}
  // Hero folded every hand (or checked the big blind); a walk in the big blind has no action and ends a run.
  for(const v of views)if(v.events.some(e=>e.type==='action'&&e.seatId===0))expect(foldedPreflop(v,0)).toBe(true);
 },120000);
});

describe('Patch 77 heads-up talk and reads',()=>{
 const m=(o:Partial<MatchState>):MatchState=>({sessionId:'s',rung:0,opponent:'priya',name:'Priya',hands:10,hero:20000,villain:20000,over:false,won:false,how:null,net:0,...o});
 it('greets you, needles you about what they noticed, and says good game',()=>{
  for(const id of LADDER_IDS)expect(matchLine(m({opponent:id,hands:0}),'h',[],200)).toBeTruthy();
  let needles=0;for(let i=0;i<400;i++){const l=matchLine(m({hands:8}),`h${i}`,['scared-money'],200);if(l){needles++;expect(l).toBe('You don’t like big pots, do you?');}}
  expect(needles).toBeGreaterThan(120);expect(needles).toBeLessThan(280);
  for(let i=0;i<100;i++)expect(matchLine(m({hands:9}),`h${i}`,['scared-money'],200)).toBeNull();// not every hand
  for(let i=0;i<100;i++)expect(matchLine(m({}),`h${i}`,[],200)).toBeNull();
  expect(matchLine(m({over:true,won:true,how:'bust'}),'h',[],200)).toBeTruthy();expect(matchLine(m({over:true,won:false,how:'bust'}),'h',[],200)).toBeTruthy();
  const short=Array.from({length:200},(_,i)=>matchLine(m({hero:4000,hands:10}),`q${i}`,[],200)).filter(Boolean).length;expect(short).toBeGreaterThan(80);
 });
 it('shows what the opponent noticed in plain words, escaped',()=>{
  expect(noticedMarkup('Priya',[])).toBe('');for(const k of Object.keys(LEAK_WORDS))expect(noticedMarkup('Priya',[k])).toContain(LEAK_WORDS[k]);
  expect(noticedMarkup('<b>',['scared-money'])).toContain('&lt;b&gt; has noticed');
 });
});
