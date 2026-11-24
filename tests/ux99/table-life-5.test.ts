import {describe,it,expect} from 'vitest';
import type {GameState,RuleProfile} from '../../src/contracts';
import {startHand} from '../../src/core/engine';
import {heroTankLine,sweatLine,farewellLine,callbackLine,slotNeighbour} from '../../src/bots/table-life';
import {withBanter,questionOf,SHOW_ONE,reactTo} from '../../src/bots/banter';
import {roundChatter,BJ_QUESTIONS} from '../../src/blackjack/table-talk';
import {QUIET} from '../../src/bots/talk';
import {readFileSync} from 'node:fs';

/* Patch 98: long thinks, all-in sweats, hellos and goodbyes, "show one?", callbacks, blackjack questions, a slots
 * neighbour. Display only. */
const tRules:RuleProfile={id:'human',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:200,antePriority:'blind-first',buttonRule:'dead-button'}};
const NAMES=['Hero','Walt Dobbs','Rosa Lin','Big Mike','Dee Carter','Sam Ortiz'];
const table=(id='h')=>startHand({handId:id,button:0,profile:tRules,seats:Array.from({length:6},(_,seat)=>({id:seat,name:NAMES[seat],stack:8000}))});
const who=(g:GameState)=>(id:number)=>id===0?undefined:{name:g.seats.find(s=>s.id===id)!.name};
const CARDS=/\b(ace|aces|king|kings|queen|flush|straight|set|nuts|ahead|behind|drawing)\b/i;

describe('while you think',()=>{
  it('nothing before 9 seconds; a remark after; a playful "time" after 22; only on your turn',()=>{
    let early=0,late=0;
    for(let k=0;k<300;k++){const g={...table(`t${k}`),actor:0};expect(heroTankLine(g,who(g),5)).toBeNull();if(heroTankLine(g,who(g),12))early++;const l=heroTankLine(g,who(g),25);if(l){late++;expect(l.seatId).not.toBe(0);}expect(heroTankLine({...g,actor:2},who(g),30)).toBeNull();}
    expect(early).toBeGreaterThan(120);expect(late).toBeGreaterThan(180);
    const app=readFileSync('src/ui/app.ts','utf8');expect(app).toContain("heroWaitLine('cash')");expect(app).toContain("heroWaitLine('tournament')");expect(app).toContain('[9200, 22200]');
  });
});
describe('all-in sweats',()=>{
  it('only on the turn or river of an all-in, from a player in it, with words that give nothing away',()=>{
    let n=0;
    for(let k=0;k<300;k++){const g=table(`s${k}`);const run:GameState={...g,street:'turn',board:g.deck.slice(0,4),seats:g.seats.map(s=>s.id===2?{...s,allIn:true,stack:0}:s.id===4?{...s,stack:0,allIn:true}:{...s,folded:true})};
      const l=sweatLine(run,who(run));if(l){n++;expect([2,4]).toContain(l.seatId);expect(l.text).not.toMatch(CARDS);}
      expect(sweatLine({...run,street:'flop'},who(run))).toBeNull();
      const betting:GameState={...run,seats:run.seats.map(s=>s.id===2?{...s,allIn:false,stack:5000}:s.id===4?{...s,allIn:false,stack:5000}:s)};expect(sweatLine(betting,who(betting))).toBeNull();}
    expect(n).toBeGreaterThan(140);
  });
});
describe('hellos and goodbyes',()=>{
  it('reads the table news and says goodbye or welcome by name, or remarks on a rebuy',()=>{
    let bye=0,rebuy=0;
    for(let k=0;k<300;k++){const g=table(`f${k}`);const l=farewellLine(g,['Pete Novak busts and leaves. Rosa Lin sits down.'],who(g));if(l){expect(l.seatId).not.toBe(2);if(/Pete/.test(l.text))bye++;expect(l.text).not.toMatch(/\{[nm]\}/);}
      if(farewellLine(g,['Big Mike rebuys.'],who(g))?.seatId!==undefined)rebuy++;expect(farewellLine(g,[],who(g))).toBeNull();}
    expect(bye).toBeGreaterThan(40);expect(rebuy).toBeGreaterThan(100);
  });
});
describe('they remember what you told them',()=>{
  it('a callback now and then, for every answer to every question',()=>{
    const g:GameState={...table('c'),street:'complete'};let n=0;
    for(const q of ['from','often','game','team','night','learn','drink','work'])for(const a of [0,1,2]){for(let k=0;k<200;k++){const l=callbackLine({...g,handId:`${q}${a}${k}`},[{question:q,answer:a}],who(g),[]);if(l){n++;expect(l.text.length).toBeGreaterThan(0);}}}
    expect(n).toBeGreaterThan(150);expect(callbackLine(g,[],who(g),[])).toBeNull();
    expect(readFileSync('src/ui/app.ts','utf8')).toContain("answers: answersFor('cash', a.sessionId)");
  });
  it('"show one?" after you take a pot uncontested, with three answers',()=>{
    let asked=0;for(let k=0;k<500;k++){const g=table(`o${k}`);const d:GameState={...g,street:'complete',payouts:{0:600},seats:g.seats.map(s=>s.id===0?s:{...s,folded:true,totalCommitted:s.id===3?200:0})};const c=withBanter(QUIET,d,who(d),{recent:[]},{ask:true});const l=c.lines.find(x=>questionOf(x.text)===SHOW_ONE);if(l){asked++;expect(l.seatId).toBe(3);}
      const noAsk=withBanter(QUIET,d,who(d),{recent:[]},{});expect(noAsk.lines.some(x=>questionOf(x.text)===SHOW_ONE)).toBe(false);}
    expect(asked).toBeGreaterThan(50);
    SHOW_ONE.answers.forEach((_,i)=>expect(reactTo(SHOW_ONE,i,{id:3,name:'Big Mike'},'x')!.text.length).toBeGreaterThan(0));
  });
});
describe('blackjack and slots',()=>{
  it('blackjack players ask you questions that fit the table',()=>{
    const ss=[{seat:1,name:'Rosa Lin',style:null,hands:[{cards:['Tc','7c'],total:17,status:'stood',result:'push'}]},{seat:2,name:'Big Mike',style:null,hands:[{cards:['9c','8c'],total:17,status:'stood',result:'push'}]}];
    let n=0;for(let k=0;k<1000;k++){const lines=roundChatter({id:`q${k}`,dealer:['Ts','7d'],hero:[{cards:['9h','8h'],total:17,status:'stood'}],seats:ss as never},[]);const q=lines.map(l=>questionOf(l.text)).find(Boolean);if(q){n++;expect((BJ_QUESTIONS as readonly string[]).includes(q.id)).toBe(true);}}
    expect(n).toBeGreaterThan(20);
    expect(readFileSync('src/blackjack/live-ui.ts','utf8')).toContain('data-bj-answer=');
  });
  it('the player at the next machine reacts to big wins and cold runs, and is the same person for a machine',()=>{
    let big=0,cold=0,quiet=0;const names=new Set<string>();
    for(let k=2;k<300;k++){const b=slotNeighbour('gold-rush',k,{total:500,bet:10,feature:false,big:true},[]);if(b){big++;names.add(b.name);}
      if(slotNeighbour('gold-rush',k,{total:0,bet:10,feature:false,big:false},Array(12).fill({total:0})))cold++;
      if(slotNeighbour('gold-rush',k,{total:0,bet:10,feature:false,big:false},[{total:5}]))quiet++;}
    // Patch 104: after an ordinary spin the neighbour may make small talk now and then (about 6%), nothing more.
    expect(big).toBeGreaterThan(220);expect(cold).toBeGreaterThan(40);expect(quiet).toBeLessThan(30);expect(names.size).toBe(1);
    expect(readFileSync('src/slots/view.ts','utf8')).toContain('data-testid="slot-neighbour"');
  });
});
