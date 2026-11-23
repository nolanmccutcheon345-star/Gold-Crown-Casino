import {describe,it,expect} from 'vitest';
import type {GameState,RuleProfile,Action} from '../../src/contracts';
import {startHand} from '../../src/core/engine';
import {grudgeLine,heroShowdowns,moodLine,dealerLine,reraiseLine,idleActivity,headsUpExtra} from '../../src/bots/table-life';
import {withBanter} from '../../src/bots/banter';
import {PERSONAS} from '../../src/bots/personas';
import {roundChatter} from '../../src/blackjack/table-talk';
import {QUIET} from '../../src/bots/talk';
import {readFileSync} from 'node:fs';

/* Patch 96: grudges, moods, the dealer, needles in the hand, what folded players do. Display only. */
const tRules:RuleProfile={id:'human',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:200,antePriority:'blind-first',buttonRule:'dead-button'}};
const NAMES=['Hero','Walt Dobbs','Rosa Lin','Big Mike','Dee Carter','Sam Ortiz'];
const table=(id='h')=>startHand({handId:id,button:0,profile:tRules,seats:Array.from({length:6},(_,seat)=>({id:seat,name:NAMES[seat],stack:8000}))});
const who=(g:GameState)=>(id:number)=>id===0?undefined:{name:g.seats.find(s=>s.id===id)!.name};
/** A finished hand where you and seat 3 reach showdown and `winner` takes the pot. */
const showdown=(winner:number,id:string,pot=6000):GameState=>{const g=table(id);return {...g,street:'complete',payouts:{[winner]:pot},seats:g.seats.map(s=>({...s,folded:!(s.id===0||s.id===3),totalCommitted:s.id===0||s.id===3?pot/2:0}))};};
const act=(seatId:number,street:string,action:Action,i:number)=>({id:`a${i}`,handId:'x',revision:i,type:'action' as const,seatId,street:street as never,action});

describe('grudges with you',()=>{
  it('finds your showdowns and who won them',()=>{
    expect(heroShowdowns([showdown(0,'a'),showdown(3,'b'),{...showdown(0,'c'),street:'river'}])).toEqual([{seats:[0,3],winners:[0]},{seats:[0,3],winners:[3]}]);
  });
  it('payback after losing to you earlier; "you again" when they keep losing; rarely anything the first time',()=>{
    const before=heroShowdowns([showdown(0,'p')]);let pay=0,again=0,first=0;
    for(let k=0;k<200;k++){const w=showdown(3,`w${k}`);if(grudgeLine(w,before,who(w),[]))pay++;const l=showdown(0,`l${k}`);if(grudgeLine(l,before,who(l),[]))again++;if(grudgeLine(l,[],who(l),[]))first++;}
    expect(pay).toBeGreaterThan(110);expect(again).toBeGreaterThan(90);expect(first).toBeLessThan(55);
    const w=showdown(3,'x');expect(grudgeLine(w,[],who(w),[])).toBeNull();expect(grudgeLine(w,before,who(w),[3])).toBeNull();
  });
});
describe('moods, the dealer and needles',()=>{
  it('players running hot or on tilt say so sometimes, calm players never',()=>{
    let t=0,h=0;for(let k=0;k<400;k++){if(moodLine(2,'Rosa Lin',undefined,{tilt:.8,heater:0},`t${k}`))t++;if(moodLine(2,'Rosa Lin',undefined,{tilt:0,heater:.8},`h${k}`))h++;expect(moodLine(2,'Rosa Lin',undefined,{tilt:.2,heater:.2},`c${k}`)).toBeNull();}
    expect(t).toBeGreaterThan(60);expect(h).toBeGreaterThan(45);
  });
  it('big pots bring a tip or a word to the dealer; small pots never',()=>{
    let n=0;for(let k=0;k<300;k++){const g={...showdown(3,`d${k}`,6000)};g.seats=g.seats.map(s=>s.id===0?{...s,folded:true}:s.id===2?{...s,folded:false}:s);if(dealerLine(g,who(g),[]))n++;const small={...showdown(3,`s${k}`,300)};expect(dealerLine(small,who(small),[])).toBeNull();}
    expect(n).toBeGreaterThan(50);
  });
  it('a re-raised player needles the re-raiser by first name; a raising war gets a remark',()=>{
    let named=0,war=0;
    for(let k=0;k<300;k++){const g=table(`r${k}`);const two:GameState={...g,street:'flop',events:[...g.events,act(2,'flop',{type:'raise',to:400},1),act(3,'flop',{type:'raise',to:1200},2)]};
      const l=reraiseLine(two,who(two));if(l){named++;expect(l.seatId).toBe(2);expect(l.text).not.toContain('{n}');}
      const three:GameState={...two,seats:g.seats.map(s=>s.id===5?{...s,folded:true}:s),events:[...two.events,act(4,'flop',{type:'raise',to:3000},3)]};if(reraiseLine(three,who(three))?.seatId===5)war++;}
    expect(named).toBeGreaterThan(50);expect(war).toBeGreaterThan(80);
    const g=table('h');const hero:GameState={...g,street:'flop',events:[...g.events,act(0,'flop',{type:'raise',to:400},1),act(3,'flop',{type:'raise',to:1200},2)]};expect(reraiseLine(hero,who(hero))).toBeNull();
  });
  it('withBanter brings these in, capped at four lines',()=>{
    let any=0;for(let k=0;k<200;k++){const g=showdown(3,`b${k}`);const c=withBanter(QUIET,g,who(g),{recent:[]},{showdowns:heroShowdowns([showdown(0,'p')]),moodAt:()=>({tilt:.9,heater:0})});expect(c.lines.length).toBeLessThanOrEqual(4);if(c.lines.length)any++;}
    expect(any).toBeGreaterThan(150);
  });
});
describe('folded players, heads-up, personalities, blackjack',()=>{
  it('folded players are doing something about four times in ten, in their own way',()=>{
    let n=0;const seen=new Set<string>();for(let k=0;k<500;k++){const w=idleActivity('Rosa Lin',undefined,`i${k}`);if(w){n++;seen.add(w);}}
    expect(n).toBeGreaterThan(160);expect(n).toBeLessThan(260);expect(seen.size).toBeGreaterThan(8);
    const app=readFileSync('src/ui/app.ts','utf8');expect(app).toContain('idleMarkup(shown, id)');expect(readFileSync('src/plo/view.ts','utf8')).toContain('idleActivity(s.name');expect(readFileSync('src/ui/tournament-play.ts','utf8')).toContain('data-testid="idle-act"');
  });
  it('the heads-up opponent says more, in personality',()=>{
    let big=0,lost=0;for(let k=0;k<200;k++){if(headsUpExtra('Frank','frank',30,.6,`a${k}`))big++;if(headsUpExtra('Frank','frank',-30,.4,`b${k}`))lost++;}
    expect(big).toBeGreaterThan(60);expect(lost).toBeGreaterThan(60);
    expect(readFileSync('src/ui/app.ts','utf8')).toContain('headsUpExtra(m.name,m.opponent');
  });
  it('every personality has more to say for its actions and results',()=>{
    for(const p of PERSONAS){expect(p.openers.length).toBeGreaterThanOrEqual(3);expect((p.lines.win??[]).length).toBeGreaterThanOrEqual(2);expect(Object.values(p.actions).flat().length+(p.id==='zen'?3:0)).toBeGreaterThanOrEqual(3);}
  });
  it('blackjack players talk about your hand',()=>{
    const ss=[{seat:1,name:'Rosa Lin',style:null,hands:[{cards:['Tc','7c'],total:17,status:'stood',result:'push'}]},{seat:2,name:'Big Mike',style:null,hands:[{cards:['9c','8c'],total:17,status:'stood',result:'push'}]}];
    let bust=0,five=0;for(let k=0;k<300;k++){const a=roundChatter({id:`x${k}`,dealer:['Ts','7d'],hero:[{cards:['Th','6h','9s'],total:25,status:'busted',result:'loss'}],seats:ss as never},[]);if(a.some(l=>/Ouch|Too many|Tough card|ten, man|Unlucky|next time/.test(l.text)))bust++;
      const b=roundChatter({id:`y${k}`,dealer:['Ts','7d'],hero:[{cards:['2h','3h','6s','Kd'],total:21,status:'stood',result:'win'}],seats:ss as never},[]);if(b.some(l=>/Twenty-one|Nice draw|Four cards|a hit/.test(l.text)))five++;}
    expect(bust).toBeGreaterThan(50);expect(five).toBeGreaterThan(130);
  });
});
