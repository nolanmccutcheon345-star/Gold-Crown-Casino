import {describe,it,expect} from 'vitest';
import type {GameState} from '../../src/contracts';
import {THREADS} from '../../src/bots/conversations';
import {PERSONAS,personaFor} from '../../src/bots/personas';
import {BOT_EVENT_LINES,botEventLine,heroBanter,heroStoryLine,heroStoryMoment,smallTalk,type BotMoment,type HeroHistory} from '../../src/bots/banter';
import {RecentLines,pickFresh} from '../../src/bots/talk-memory';

/* Phase 5 (6A): talk expansion — doubled conversations, bot-versus-bot event reactions, a session
 * no-repeat window, and session-story moments (comeback / rivalry). Presentation only throughout:
 * every picker below is a pure function of names, personas, public counts and a seed. */

const MOMENTS:BotMoment[]=['botBigPot','botBadBeat','botJoins','botLeaves','botRebuy','botCooler'];
/** A display name whose table personality (from the name alone) is the one wanted. */
const nameForPersona=(id:string):string=>{
 for(let i=0;i<500;i++){const n=`Talker ${id} ${i}`;if(personaFor(n).id===id)return n;}
 throw new Error(`no name for ${id}`);
};

describe('conversations doubled',()=>{
 it('THREADS at least doubled from the Patch 104 count of 70, every thread answerable',()=>{
  expect(THREADS.length).toBeGreaterThanOrEqual(140);
  const ids=new Set(PERSONAS.map(p=>p.id));
  for(const t of THREADS){
   expect(t.open.length).toBeGreaterThan(0);
   expect(t.reply.any.length).toBeGreaterThanOrEqual(1);
   for(const line of t.reply.any)expect(line.length).toBeGreaterThan(0);
   for(const k of Object.keys(t.reply))if(k!=='any')expect(ids.has(k)).toBe(true);
   if(t.by)expect(ids.has(t.by)).toBe(true);
  }
  expect(new Set(THREADS.map(t=>t.open)).size).toBe(THREADS.length);
 });
 it('covers the new topics',()=>{
  for(const topic of ['music','fishing','holidays','drive','grandkids','coffee','jackpot','stakes'])
   expect(THREADS.some(t=>t.topic===topic),topic).toBe(true);
 });
 it('the personalities that had fewest threads now own several each',()=>{
  for(const p of ['grinder','rookie','zen','high-roller','cowboy','storyteller'])
   expect(THREADS.filter(t=>t.by===p).length,p).toBeGreaterThanOrEqual(3);
  for(const p of PERSONAS)expect(THREADS.some(t=>t.by===p.id),p.id).toBe(true);
 });
});

describe('bot-versus-bot event lines',()=>{
 it('every moment has a real pool, with persona flavours and {n} substitution',()=>{
  for(const m of MOMENTS){
   expect(BOT_EVENT_LINES[m].any.length).toBeGreaterThanOrEqual(5);
   expect(Object.keys(BOT_EVENT_LINES[m]).length).toBeGreaterThanOrEqual(5);
  }
 });
 it('returns non-empty, name-filled, deterministic lines for each moment and persona',()=>{
  for(const m of MOMENTS)for(const p of PERSONAS){
   const speaker=nameForPersona(p.id);
   for(let k=0;k<12;k++){
    const line=botEventLine(m,speaker,`s${k}`,'Rosa Lin');
    expect(line.length).toBeGreaterThan(0);
    expect(line).not.toContain('{n}');
    expect(botEventLine(m,speaker,`s${k}`,'Rosa Lin')).toBe(line); // pure: same seed, same line
   }
  }
 });
 it('names the other player where a line addresses them, and never needs one',()=>{
  let named=0;
  for(let k=0;k<300;k++)if(botEventLine('botJoins','Mabel',`j${k}`,'Rosa Lin').includes('Rosa'))named++;
  expect(named).toBeGreaterThan(20);
  for(const m of MOMENTS)expect(botEventLine(m,'Mabel','x')).not.toContain('{n}');
 });
});

describe('session no-repeat window',()=>{
 it('RecentLines is a FIFO window of the configured size',()=>{
  const mem=new RecentLines(4);
  for(const t of ['a','b','c','d'])mem.add(t);
  expect(mem.size).toBe(4);expect(mem.seen('a')).toBe(true);
  mem.add('e');expect(mem.seen('a')).toBe(false);expect(mem.seen('e')).toBe(true);
  mem.add('e');expect(mem.size).toBe(4); // re-adding a remembered line is a no-op
  expect(new RecentLines().capacity).toBe(48);
  mem.clear();expect(mem.size).toBe(0);
 });
 it('pickFresh never repeats within the window while the pool has unseen lines',()=>{
  const pool=Array.from({length:60},(_,i)=>`line ${i}`),mem=new RecentLines(48),drawn:string[]=[];
  for(let k=0;k<200;k++){
   const line=pickFresh(pool,`p${k}`,mem);
   expect(drawn.slice(-48)).not.toContain(line);
   drawn.push(line);
  }
  expect(pickFresh(pool,'p0',new RecentLines())).toBe(drawn[0]); // pure for a fresh memory
 });
 it('pickFresh falls back to the plain pick when the pool is exhausted',()=>{
  const mem=new RecentLines(48);mem.add('only');
  expect(pickFresh(['only'],'any-seed',mem)).toBe('only');
  expect(pickFresh([],'any-seed',mem)).toBe('');
 });
 it('smallTalk with a memory never repeats a line within the window',()=>{
  const seats=[{id:1,name:'Mabel'},{id:2,name:'Rex'},{id:3,name:'Jo'}];
  const mem=new RecentLines(),said:string[]=[];
  for(let k=0;k<10;k++)for(const l of smallTalk(seats,`m${k}`,true,mem)){expect(said).not.toContain(l.text);said.push(l.text);}
  expect(said.length).toBeGreaterThanOrEqual(20);
  // Deterministic: a fresh memory replays the exact same conversations.
  const mem2=new RecentLines(),again:string[]=[];
  for(let k=0;k<10;k++)again.push(...smallTalk(seats,`m${k}`,true,mem2).map(l=>l.text));
  expect(again).toEqual(said);
 });
 it('smallTalk without a memory is unchanged in shape and deterministic',()=>{
  const seats=[{id:1,name:'Mabel'},{id:2,name:'Rex'},{id:3,name:'Jo'}];
  for(let k=0;k<50;k++){
   const lines=smallTalk(seats,`d${k}`);
   expect(lines.length).toBeGreaterThanOrEqual(2);expect(lines.length).toBeLessThanOrEqual(4);
   expect(THREADS.some(t=>t.open===lines[0].text)).toBe(true);
   expect(smallTalk(seats,`d${k}`)).toEqual(lines);
  }
 });
 it('heroBanter with a memory never repeats a line within the window',()=>{
  const game=(handId:string):GameState=>({handId,street:'complete',board:[],events:[],profile:{bigBlind:200},
   payouts:{0:3000+8000},seats:[{id:0,totalCommitted:3000,allIn:false,stack:9000},{id:1,totalCommitted:3000,allIn:false,stack:5000},{id:2,totalCommitted:100,allIn:false,stack:5000}]} as unknown as GameState);
  const who=(id:number)=>id===0?undefined:{name:['','Mabel','Rex'][id]};
  const history:HeroHistory={recent:[]};
  const mem=new RecentLines(),said:string[]=[];
  for(let k=0;k<200&&said.length<8;k++){
   const line=heroBanter(game(`hb${k}`),who,history,[],mem);
   if(line){expect(said).not.toContain(line.text);said.push(line.text);}
  }
  expect(said.length).toBe(8);
  // And without a memory the same hand still gives the same line twice.
  const g=game('fixed');
  expect(heroBanter(g,who,history,[])).toEqual(heroBanter(g,who,history,[]));
 });
});

describe('session-story moments',()=>{
 it('heroStoryMoment reads only the counts passed in',()=>{
  expect(heroStoryMoment({lowestDownBB:55,comebackPotBB:30})).toBe('heroComeback');
  expect(heroStoryMoment({lowestDownBB:55,comebackPotBB:10})).toBeNull();
  expect(heroStoryMoment({lowestDownBB:10,comebackPotBB:90})).toBeNull();
  expect(heroStoryMoment({sameBotBeats:3,rivalName:'Rosa Lin'})).toBe('heroRivalry');
  expect(heroStoryMoment({sameBotBeats:2})).toBeNull();
  expect(heroStoryMoment({})).toBeNull();
  // A comeback outranks a rivalry when both happened.
  expect(heroStoryMoment({lowestDownBB:80,comebackPotBB:40,sameBotBeats:5})).toBe('heroComeback');
 });
 it('story lines are non-empty, deterministic and name the rival',()=>{
  for(const p of PERSONAS){
   const speaker=nameForPersona(p.id);
   const back=heroStoryLine('heroComeback',speaker,'c1');
   expect(back.length).toBeGreaterThan(0);
   expect(heroStoryLine('heroComeback',speaker,'c1')).toBe(back);
   for(let k=0;k<12;k++)expect(heroStoryLine('heroRivalry',speaker,`r${k}`,{rivalName:'Rosa Lin'})).not.toContain('{n}');
  }
  let named=0;
  for(let k=0;k<200;k++)if(heroStoryLine('heroRivalry','Mabel',`n${k}`,{rivalName:'Rosa Lin'}).includes('Rosa'))named++;
  expect(named).toBeGreaterThan(10);
 });
});
