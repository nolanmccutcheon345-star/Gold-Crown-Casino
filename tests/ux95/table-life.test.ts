import {describe,it,expect} from 'vitest';
import type {GameState,RuleProfile,Action} from '../../src/contracts';
import {startHand,applyCommand} from '../../src/core/engine';
import {regularProfile} from '../../src/bots/regulars';
import {CALM} from '../../src/bots/human';
import {thinkPlan,difficultyOf,pacedMs,READ_HOLD_MS,MIN_THINK_MS,MAX_THINK_MS} from '../../src/ui/think-time';
import {liveTells} from '../../src/bots/tells';
import {heroBanter,rivalBanter,gestureLine,mutterFor,answerHero,HERO_PHRASES,withBanter,isGesture,heroHandOf} from '../../src/bots/banter';
import {QUIET} from '../../src/bots/talk';
import {talkMarkup,quipMarkup} from '../../src/ui/table-talk';
import {readFileSync} from 'node:fs';

/* Patch 94: snap the easy decisions, tank the hard ones, hold for tells; more table talk. Display only. */
const tRules:RuleProfile={id:'human',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:200,antePriority:'blind-first',buttonRule:'dead-button'}};
const act=(s:GameState,action:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action});
const table=(id='h')=>startHand({handId:id,button:0,profile:tRules,seats:Array.from({length:6},(_,seat)=>({id:seat,name:['Hero','Walt Dobbs','Rosa Lin','Big Mike','Dee Carter','Sam Ortiz'][seat],stack:8000}))});
const prof=regularProfile('walt','mid');
const seq=(seed:number)=>{let s=seed>>>0;return ()=>{s=(Math.imul(s^(s>>>15),0x2c1b3c6d)+0x6d2b79f5)>>>0;return s/4294967296;};};
const median=(xs:number[])=>{const a=[...xs].sort((x,y)=>x-y);return a[a.length>>1];};

describe('think time',()=>{
  it('snaps easy preflop folds in under ~0.6 s',()=>{
    let folds:number[]=[];
    for(let k=0;k<60;k++){const g=table(`f${k}`);if(liveTells(g,prof,{type:'fold'})?.cue)continue;const p=thinkPlan(g,{type:'fold'},prof,CALM,seq(k));expect(p.snap).toBe(true);folds.push(p.ms);}
    expect(folds.length).toBeGreaterThan(20);expect(Math.max(...folds)).toBeLessThanOrEqual(650);expect(Math.min(...folds)).toBeGreaterThanOrEqual(MIN_THINK_MS);
  });
  it('tanks for seconds on a big river or all-in decision',()=>{
    const g=table('t');
    const hard:GameState={...g,street:'river',pot:16000,seats:g.seats.map(s=>s.id===0?{...s,streetCommitted:6000}:s.id===g.actor?{...s,stack:6500}:s)};
    expect(difficultyOf(hard,{type:'call'})).toBeGreaterThan(.6);
    const ms=Array.from({length:40},(_,k)=>thinkPlan(hard,{type:'call'},prof,CALM,seq(k+9)).ms);
    expect(median(ms)).toBeGreaterThan(3000);expect(Math.max(...ms)).toBeLessThanOrEqual(MAX_THINK_MS);
    // A fold to that bet is a real decision too, not a snap.
    expect(thinkPlan(hard,{type:'fold'},prof,CALM,seq(3)).snap).toBe(false);
  });
  it('holds at least the read time whenever a visible tell shows',()=>{
    let seen=0;
    for(let k=0;k<400&&seen<5;k++){const t0=table(`v${k}`),g:GameState={...t0,street:'flop',board:t0.deck.slice(t0.deckCursor,t0.deckCursor+3)};for(const a of [{type:'call'},{type:'raise',to:600}] as Action[]){const t=liveTells(g,prof,a);if(t?.cue||(t?.speech&&a.type==='call')){seen++;const p=thinkPlan(g,a,prof,CALM,seq(k));expect(p.visibleTell).toBe(true);expect(p.ms).toBeGreaterThanOrEqual(READ_HOLD_MS);}}}
    expect(seen).toBeGreaterThan(0);
  });
  it('scales to the pace: snaps stay snappy, tells keep a readable floor',()=>{
    expect(pacedMs({ms:400,difficulty:0,snap:true,visibleTell:false},2,0)).toBe(400);
    expect(pacedMs({ms:4000,difficulty:.8,snap:false,visibleTell:false},.25,0)).toBe(1000);
    expect(pacedMs({ms:3000,difficulty:.5,snap:false,visibleTell:true},.25,1000)).toBe(1000);
  });
  it('is display only: the app still commits the saved decision',()=>{
    const app=readFileSync('src/ui/app.ts','utf8');
    expect(app).toContain('cashThinkPlan(active, controller.data)');expect(app).toContain('tournamentThinkPlan(current)');
    expect(app).toContain('controller.commitBot(current.handId, current.revision)');
  });
});
const finished=(winner:number,loser:number,heroFolded=true):GameState=>{const g=table('done');return {...g,street:'complete',pot:0,payouts:{[winner]:6000},seats:g.seats.map(s=>({...s,folded:s.id===winner||s.id===loser?false:s.id===0?heroFolded:true,totalCommitted:s.id===winner||s.id===loser?3000:s.totalCommitted}))};};
const who=(g:GameState)=>(id:number)=>id===0?undefined:{name:g.seats.find(s=>s.id===id)!.name};
describe('table talk',()=>{
  it('players needle each other by name after a showdown',()=>{
    let n=0;for(let k=0;k<60;k++){const g={...finished(2,3),handId:`r${k}`};const lines=rivalBanter(g,who(g),[]);if(lines.length){n++;expect(lines[0].seatId).toBe(3);if(lines[1])expect(lines[1].seatId).toBe(2);expect(lines.map(l=>l.text).join(' ')).not.toMatch(/\{n\}/);}}
    expect(n).toBeGreaterThan(10);expect(n).toBeLessThan(50);
  });
  it('talks to you after a big pot, a long run of folds, and a lot of raising',()=>{
    const count=(make:(k:number)=>GameState,recent:{played:boolean;raised:boolean}[])=>{let n=0;for(let k=0;k<80;k++){const g=make(k);if(heroBanter(g,who(g),{recent},[]))n++;}return n;};
    const heroWon=(k:number)=>{const g=finished(0,3,false);return {...g,handId:`w${k}`,payouts:{0:20000},seats:g.seats.map(s=>s.id===0?{...s,totalCommitted:3000}:s)};};
    expect(count(heroWon,[])).toBeGreaterThan(20);
    const quiet=(k:number)=>({...finished(2,3),handId:`q${k}`});
    expect(count(quiet,Array(12).fill({played:false,raised:false}))).toBeGreaterThan(10);
    expect(count(quiet,Array(8).fill({played:true,raised:true}))).toBeGreaterThan(10);
    expect(count(quiet,Array(8).fill({played:true,raised:false}))).toBe(0);
  });
  it('gestures between hands, shown as an action not a quote',()=>{
    let g0=0;for(let k=0;k<200;k++){const g={...finished(2,3),handId:`g${k}`};const l=gestureLine(g,who(g),[]);if(l){g0++;expect(isGesture(l.text)).toBe(true);}}
    expect(g0).toBeGreaterThan(15);
    const m=talkMarkup({lines:[{seatId:2,text:'*sips a drink*'}],shows:[]},2);expect(m).toContain('talk-gesture');expect(m).not.toContain('“');
    expect(quipMarkup({seatId:2,text:'*stretches*'},2,'k')).toContain('quip-gesture');
  });
  it('mutters during a long think say nothing about the cards',()=>{
    for(let k=0;k<100;k++)expect(mutterFor('Walt Dobbs',undefined,`m${k}`)).not.toMatch(/\b(ace|king|queen|flush|straight|pair|nuts|set)\b/i);
  });
  it('answers what you say, in personality',()=>{
    const seats=[{id:2,name:'Rosa Lin'},{id:3,name:'Big Mike'}];
    for(const p of HERO_PHRASES){const a=answerHero(p,seats,`s:${p}`);expect(a).not.toBeNull();expect([2,3]).toContain(a!.seatId);expect(a!.text.length).toBeGreaterThan(0);}
    expect(answerHero('Time?',seats,'x',3)!.seatId).toBe(3);
    expect(answerHero('Wow',[],'x')).toBeNull();
  });
  it('withBanter adds at most four lines and only after the hand',()=>{
    const g=finished(2,3);
    expect(withBanter(QUIET,{...g,street:'river'},who(g),null)).toBe(QUIET);
    for(let k=0;k<50;k++){const h={...g,handId:`b${k}`};expect(withBanter(QUIET,h,who(h),{recent:[]}).lines.length).toBeLessThanOrEqual(4);}
    expect(heroHandOf({events:[{type:'blind',seatId:0},{type:'action',seatId:0,street:'preflop',action:{type:'raise'}}]})).toEqual({played:true,raised:true});
  });
});
