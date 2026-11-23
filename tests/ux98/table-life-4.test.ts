import {describe,it,expect} from 'vitest';
import type {GameState,RuleProfile} from '../../src/contracts';
import {startHand} from '../../src/core/engine';
import {THREADS,turnsFor} from '../../src/bots/conversations';
import {smallTalk,QUESTIONS,heroQuestionLine,questionOf,reactTo,heroNickname,heroBanter,withBanter} from '../../src/bots/banter';
import {talkMarkup,answerRow} from '../../src/ui/table-talk';
import {QUIET} from '../../src/bots/talk';
import {readFileSync} from 'node:fs';

/* Patch 97: back-and-forth conversations, questions for you, a nickname. Display only. */
const tRules:RuleProfile={id:'human',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:200,antePriority:'blind-first',buttonRule:'dead-button'}};
const NAMES=['Hero','Walt Dobbs','Rosa Lin','Big Mike','Dee Carter','Sam Ortiz'];
const table=(id='h')=>startHand({handId:id,button:0,profile:tRules,seats:Array.from({length:6},(_,seat)=>({id:seat,name:NAMES[seat],stack:8000}))});
const who=(g:GameState)=>(id:number)=>id===0?undefined:{name:g.seats.find(s=>s.id===id)!.name};
const seats=NAMES.slice(1).map((name,i)=>({id:i+1,name}));

describe('back and forth',()=>{
  it('many threads have comebacks, and more threads were added',()=>{
    expect(THREADS.length).toBeGreaterThanOrEqual(50);
    expect(THREADS.filter(t=>turnsFor(t.open)).length).toBeGreaterThanOrEqual(20);
    for(const t of THREADS){const m=turnsFor(t.open);if(m){expect(m.follow.length).toBeGreaterThan(0);expect(m.back.length).toBeGreaterThan(0);}}
  });
  it('conversations sometimes run A, B, A, B',()=>{
    let four=0,three=0;for(let k=0;k<600;k++){const l=smallTalk(seats,`b${k}`);if(l.length===4){four++;expect(l[0].seatId).toBe(l[2].seatId);expect(l[1].seatId).toBe(l[3].seatId);}if(l.length===3&&l[0].seatId===l[2].seatId)three++;}
    expect(four).toBeGreaterThan(60);expect(three).toBeGreaterThan(15);
  });
  it('a player who speaks twice keeps one bubble whose words change in turn, spaced for reading',()=>{
    const c={lines:[{seatId:1,text:'Anybody catch the Thunder game last night?'},{seatId:2,text:'Missed it. Who won?'},{seatId:1,text:'Fourth quarter was unreal.'},{seatId:2,text:'Don’t jinx it.'}],shows:[]};
    const m=talkMarkup(c,1);expect(m).toContain('talk-turns');expect(m).toContain('--talk-step:1.9s');expect(m).toContain('talk-earlier');expect(m).toContain('--talk-next:2');expect((m.match(/talk-text/g)??[]).length).toBe(2);
    expect(talkMarkup({lines:[{seatId:1,text:'Hi.'},{seatId:2,text:'Hey.'}],shows:[]},1)).not.toContain('talk-step');
    const css=readFileSync('src/ui/polish.css','utf8');expect(css).toContain('.talk-seq>.talk-text{grid-area:1/1}');expect(css).toContain('pna-words-out');
  });
});
describe('questions for you',()=>{
  it('eight questions, three answers each, every answer gets a reaction from the asker',()=>{
    expect(QUESTIONS.length).toBe(8);
    for(const q of QUESTIONS){expect(q.answers.length).toBe(3);for(const list of Object.values(q.ask))for(const text of list!)expect(questionOf(text)).toBe(q);
      q.answers.forEach((_,i)=>{const r=reactTo(q,i,{id:3,name:'Big Mike'},`x${i}`);expect(r!.seatId).toBe(3);expect(r!.text.length).toBeGreaterThan(0);});}
    expect(questionOf('Nice hand.')).toBeUndefined();
  });
  it('asked now and then after a hand, only where you can answer',()=>{
    let n=0;for(let k=0;k<1000;k++)if(heroQuestionLine(seats,`q${k}`))n++;expect(n).toBeGreaterThan(40);expect(n).toBeLessThan(110);
    let asked=0,never=0;for(let k=0;k<600;k++){const g:GameState={...table(`w${k}`),street:'complete',payouts:{3:100}};if(withBanter(QUIET,g,who(g),{recent:[]},{ask:true}).lines.some(l=>questionOf(l.text)))asked++;if(withBanter(QUIET,g,who(g),{recent:[]},{}).lines.some(l=>questionOf(l.text)))never++;}
    expect(asked).toBeGreaterThan(15);expect(never).toBe(0);
    expect(answerRow(['A','B'],'cash','Mike')).toContain('data-answer="1" data-answer-mode="cash"');
  });
  it('is wired into cash, tournaments and Omaha',()=>{
    const app=readFileSync('src/ui/app.ts','utf8');expect(app).toContain("answerMarkup('cash')");expect(app).toContain("answerMarkup('tournament')");expect(app).toContain("answerMarkup('omaha')");expect(app).toContain('answered.add(p.key)');
    expect(readFileSync('src/plo/table.ts','utf8')).toContain('heroQuestionLine(named,');
  });
});
describe('your nickname',()=>{
  it('comes from a clear pattern in your last hands, and is used in lines to you',()=>{
    const h=(played:boolean,raised:boolean,won?:boolean)=>({played,raised,won});
    expect(heroNickname(Array(9).fill(h(true,true)))).toBeNull();
    expect(heroNickname(Array(12).fill(h(true,true)))).toBe('Action');
    expect(heroNickname(Array(12).fill(h(true,false,true)))).toBe('Hot Hand');
    expect(heroNickname(Array(12).fill(h(false,false,false)))).toBe('Patience');
    expect(heroNickname([...Array(6).fill(h(true,false,false)),...Array(6).fill(h(false,false,false))])).toBeNull();
    let named=0;for(let k=0;k<300;k++){const g=table(`n${k}`);const d:GameState={...g,street:'complete',payouts:{0:20000},seats:g.seats.map(s=>s.id===0?{...s,totalCommitted:3000}:s)};const l=heroBanter(d,who(d),{recent:Array(12).fill(h(true,true,false))},[]);if(l&&/, Action[.!?]$/.test(l.text))named++;}
    expect(named).toBeGreaterThan(20);
  });
});
