import {describe,it,expect} from 'vitest';
import type {GameState,RuleProfile} from '../../src/contracts';
import {startHand} from '../../src/core/engine';
import {THREADS,threadFor,replyTo} from '../../src/bots/conversations';
import {smallTalk,spectatorLine,heroBanter,answerHero,answerBlackjack,chimeIn,HERO_PHRASES,BJ_PHRASES,lineToHero,rivalPair,gestureFor,heroHandOf,withBanter} from '../../src/bots/banter';
import {PERSONAS} from '../../src/bots/personas';
import {roundChatter} from '../../src/blackjack/table-talk';
import {heroSaidMarkup,quickChatRow} from '../../src/ui/table-talk';
import {QUIET} from '../../src/bots/talk';
import {readFileSync} from 'node:fs';

/* Patch 95: more to say and do, in every mode. Display only. */
const tRules:RuleProfile={id:'human',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:200,antePriority:'blind-first',buttonRule:'dead-button'}};
const NAMES=['Hero','Walt Dobbs','Rosa Lin','Big Mike','Dee Carter','Sam Ortiz'];
const table=(id='h')=>startHand({handId:id,button:0,profile:tRules,seats:Array.from({length:6},(_,seat)=>({id:seat,name:NAMES[seat],stack:8000}))});
const who=(g:GameState)=>(id:number)=>id===0?undefined:{name:g.seats.find(s=>s.id===id)!.name};
const seats=NAMES.slice(1).map((name,i)=>({id:i+1,name}));

describe('conversations',()=>{
  it('has a wide set of threads, with answers for many personalities',()=>{
    expect(THREADS.length).toBeGreaterThanOrEqual(35);
    expect(new Set(THREADS.map(t=>t.topic)).size).toBeGreaterThanOrEqual(15);
    for(const t of THREADS){expect(t.reply.any.length).toBeGreaterThanOrEqual(1);if(t.by)expect(PERSONAS.some(p=>p.id===t.by)).toBe(true);}
    for(const p of PERSONAS)expect(THREADS.some(t=>t.by===p.id)).toBe(true);
  });
  it('a conversation is two to four lines, opener first, never the same player twice in a row (Patch 97: back and forth)',()=>{
    const openers=new Set<string>();
    for(let k=0;k<300;k++){const lines=smallTalk(seats,`c${k}`);expect(lines.length).toBeGreaterThanOrEqual(2);expect(lines.length).toBeLessThanOrEqual(4);for(let i=1;i<lines.length;i++)expect(lines[i].seatId).not.toBe(lines[i-1].seatId);const flat=smallTalk(seats,`c${k}`,false);expect(flat.length).toBeLessThanOrEqual(3);expect(new Set(flat.map(l=>l.seatId)).size).toBe(flat.length);expect(THREADS.some(t=>t.open===lines[0].text)).toBe(true);openers.add(lines[0].text);}
    expect(openers.size).toBeGreaterThan(25);
    expect(smallTalk(seats.slice(0,1),'x')).toEqual([]);
  });
  it('answers lean on the answering personality',()=>{
    const t=THREADS.find(x=>x.reply.cowboy)!;const own=t.reply.cowboy!;let hits=0;for(let k=0;k<200;k++)if(own.includes(replyTo(t,'cowboy',`r${k}`)))hits++;expect(hits).toBeGreaterThan(40);
    expect(threadFor('comedian','x')).toBeTruthy();
  });
});
describe('reactions and words to you',()=>{
  it('players out of the hand react to a big bet or an all-in, never to a small one',()=>{
    let n=0;
    for(let k=0;k<200;k++){const g=table(`s${k}`);const shove:GameState={...g,street:'flop',seats:g.seats.map(s=>s.id===3?{...s,allIn:true,stack:0}:s.id===1||s.id===2?{...s,folded:true}:s),events:[...g.events,{id:'x',handId:g.handId,revision:9,type:'action',seatId:3,street:'flop',action:{type:'raise',to:8000}}]};
      const l=spectatorLine(shove,who(shove));if(l){n++;expect([1,2]).toContain(l.seatId);}
      const small:GameState={...shove,seats:g.seats.map(s=>s.id===1||s.id===2?{...s,folded:true}:s),events:[...g.events,{id:'y',handId:g.handId,revision:9,type:'action',seatId:3,street:'flop',action:{type:'raise',to:400}}]};
      expect(spectatorLine(small,who(small))).toBeNull();}
    expect(n).toBeGreaterThan(40);expect(n).toBeLessThan(120);
  });
  it('new moments: an all-in won or lost, a heater, a cold run',()=>{
    const g=table('m');const done=(net:number,allIn:boolean,id:string):GameState=>({...g,handId:id,street:'complete',payouts:net>0?{0:3000+net}:{3:3000-net},seats:g.seats.map(s=>s.id===0?{...s,totalCommitted:3000,allIn,stack:allIn&&net<0?0:s.stack}:s)});
    const count=(net:number,allIn:boolean,recent:{played:boolean;raised:boolean;won?:boolean}[])=>{let n=0;for(let k=0;k<100;k++){const d=done(net,allIn,`n${net}${allIn}${k}`);if(heroBanter(d,who(d),{recent},[]))n++;}return n;};
    expect(count(2000,true,[])).toBeGreaterThan(40);expect(count(-3000,true,[])).toBeGreaterThan(40);
    expect(count(400,false,Array(6).fill({played:true,raised:false,won:true}))).toBeGreaterThan(20);
    expect(count(-400,false,Array(6).fill({played:true,raised:false,won:false}))).toBeGreaterThan(20);
    expect(count(400,false,Array(6).fill({played:true,raised:false,won:false}))).toBe(0);
    expect(heroHandOf({events:[],payouts:{0:5}}).won).toBe(true);
  });
  it('withBanter sometimes starts a conversation after a quiet hand',()=>{
    const g=table('q');let convo=0;for(let k=0;k<300;k++){const d:GameState={...g,handId:`q${k}`,street:'complete',payouts:{3:100}};const c=withBanter(QUIET,d,who(d),{recent:[]});if(c.lines.length>=2&&THREADS.some(t=>t.open===c.lines[0].text))convo++;expect(c.lines.length).toBeLessThanOrEqual(4);}
    expect(convo).toBeGreaterThan(20);
  });
  it('Omaha uses the same lines by name',()=>{
    expect(lineToHero('heroBigWin','Rosa Lin','a').length).toBeGreaterThan(0);
    const [l,w]=rivalPair('Rosa Lin','Big Mike','b');expect(l).not.toContain('{n}');expect(w).not.toContain('{n}');
    expect(gestureFor('Rosa Lin','c')).toMatch(/^\*.+\*$/);
    const t=readFileSync('src/plo/table.ts','utf8');expect(t).toContain('smallTalk(named,');expect(t).toContain('rivalPair(');expect(t).toContain('lineToHero(');
  });
});
describe('quick chat everywhere',()=>{
  it('every poker and blackjack phrase gets an answer, sometimes a second voice',()=>{
    for(const p of HERO_PHRASES)for(let k=0;k<20;k++){const a=answerHero(p,seats,`${p}${k}`);expect(a!.text.length).toBeGreaterThan(0);}
    for(const p of BJ_PHRASES)for(let k=0;k<20;k++){const a=answerBlackjack(p,seats,`${p}${k}`);expect(a!.text.length).toBeGreaterThan(0);}
    let chimes=0;for(let k=0;k<200;k++){const c=chimeIn('Wow',seats,1,`w${k}`);if(c){chimes++;expect(c.seatId).not.toBe(1);}}expect(chimes).toBeGreaterThan(40);expect(chimes).toBeLessThan(110);
  });
  it('bubbles show yours, then each answer in turn',()=>{
    const said={at:0,phrase:'Wow',replies:[{seatId:2,text:'Wild.'},{seatId:4,text:'*laughs*'}]};
    expect(heroSaidMarkup(said,0)).toContain('Wow');expect(heroSaidMarkup(said,2)).toContain('animation-delay:1s');expect(heroSaidMarkup(said,4)).toContain('quip-gesture');expect(heroSaidMarkup(said,3)).toBe('');
    expect(quickChatRow(BJ_PHRASES,'data-bj-say')).toContain('data-bj-say="Come on, dealer!"');
  });
  it('is wired into tournaments, Omaha and blackjack',()=>{
    const app=readFileSync('src/ui/app.ts','utf8');expect(app).toContain("quickChatRow(HERO_PHRASES,'data-t-say')");expect(app).toContain("quickChatRow(HERO_PHRASES, 'data-plo-say')");
    expect(readFileSync('src/blackjack/live-ui.ts','utf8')).toContain("quickChatRow(BJ_PHRASES,'data-bj-say'");
    expect(readFileSync('src/ui/tournament-play.ts','utf8')).toContain('heroSaidMarkup(options.heroSaid');
  });
  it('blackjack tables have conversations and gestures',()=>{
    const ss=[{seat:1,name:'Rosa Lin',style:null,hands:[{cards:['Tc','7c'],total:17,status:'stood',result:'push'}]},{seat:2,name:'Big Mike',style:null,hands:[{cards:['9c','8c'],total:17,status:'stood',result:'push'}]},{seat:3,name:'Dee Carter',style:null,hands:[{cards:['9d','8d'],total:17,status:'stood',result:'push'}]}];
    let convo=0,gesture=0;for(let k=0;k<400;k++){const lines=roundChatter({id:`r${k}`,dealer:['Ts','7d'],hero:[{cards:['9h','8h'],total:17,status:'stood'}],seats:ss as never},[]);if(lines.length>=2&&THREADS.some(t=>t.open===lines[0].text))convo++;if(lines.some(l=>/^\*.+\*$/.test(l.text)))gesture++;}
    expect(convo).toBeGreaterThan(15);expect(gesture).toBeGreaterThan(20);
  });
});
