import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {TalkHand,TalkRound} from '../../src/blackjack/table-talk';

/* Patch 104: life at the casino tables (players notice you, answer each other, do things, come and go, and answer
 * what you say), twenty more poker conversations, more for players to do, blackjack reactions, and the slot
 * neighbour's small talk. */
let queue:(()=>void)[]=[];const intervals=new Map<number,()=>void>();let ids=0;
(globalThis as Record<string, unknown>).window={setTimeout:(f:()=>void)=>{queue.push(f);return ++ids;},clearTimeout:()=>{},setInterval:(f:()=>void)=>{const id=++ids;intervals.set(id,f);return id;}};
(globalThis as Record<string, unknown>).clearInterval=(id:number)=>{intervals.delete(id);};
const store=new Map<string,string>();(globalThis as Record<string, unknown>).localStorage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)};
const {CasinoPlayer,RACE_FRAMES}=await import('../../src/casino/play');
const {casinoMarkup}=await import('../../src/casino/view');
const {turnover,patronsFor,chatAnswers,CHAT}=await import('../../src/casino/patrons');
const {THREADS}=await import('../../src/bots/conversations');
const {smallTalk}=await import('../../src/bots/banter');
const {PERSONAS}=await import('../../src/bots/personas');
const {idleActivity,slotNeighbour}=await import('../../src/bots/table-life');
const {roundChatter}=await import('../../src/blackjack/table-talk');
const seq=(seed:number)=>{let s=seed>>>0;return (n:number)=>{s=(Math.imul(s^(s>>>15),0x2c1b3c6d)+0x6d2b79f5)>>>0;s^=s>>>13;return Math.floor((s>>>0)/4294967296*n);};};
const flush=()=>{for(let i=0;i<400&&queue.length;i++)queue.shift()!();};
const runIntervals=()=>{for(let i=0;i<RACE_FRAMES+5&&intervals.size;i++)for(const f of [...intervals.values()])f();};
const player=(seed=1)=>{store.clear();queue=[];intervals.clear();return new CasinoPlayer({render(){},sound(){},active:()=>true},seq(seed));};
type Line={name:string;text:string;mood:string;to?:string};
const spoken=(t:readonly Line[])=>t.filter(l=>l.mood!=='act');

describe('casino tables: the players and you',()=>{
 it('roulette players notice your bet, your wins and losses, answer each other and do things',()=>{
  const p=player(3);p.setChip(100);const all:Line[]=[];const names=new Set<string>();
  for(let i=0;i<300;i++){p.placeRoulette('red',[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);p.spinRoulette();all.push(...p.ui.talk.roulette);
   expect(spoken(p.ui.talk.roulette).length).toBeLessThanOrEqual(5);flush();all.push(...p.ui.talk.roulette);for(const x of p.ui.patrons.roulette)names.add(x.name);
   expect(new Set(p.ui.patrons.roulette.map(x=>x.name)).size).toBe(p.ui.patrons.roulette.length);}
  expect(all.some(l=>l.mood==='you'&&/Red/.test(l.text))).toBe(true);
  expect(all.some(l=>l.mood==='you'&&!/Red/.test(l.text))).toBe(true);
  expect(all.some(l=>l.mood==='act')).toBe(true);
  expect(all.some(l=>l.to&&l.to!=='You')).toBe(true);
  // People came and went: more than the starting players sat down, and someone said hello.
  expect(names.size).toBeGreaterThan(4);
  const m=casinoMarkup(p,'roulette');expect(m).toContain('data-cz-say="luck"');expect(m).toContain('data-cz-game="roulette"');
 });
 it('at craps the table rallies behind you as the shooter, and the shooter’s seat never changes hands mid-roll',()=>{
  const p=player(5);p.setChip(100);const said=new Set<string>();const texts:string[]=[];
  for(let i=0;i<500;i++){if(!p.craps.pass&&!p.craps.point)p.crapsSpot('pass');const seat=p.ui.craps.shooterSeat,shooter=seat?p.ui.patrons.craps[seat-1].name:'You';p.rollCraps();
   const now=p.ui.craps.shooterSeat;if(seat>0&&now===seat)expect(p.ui.patrons.craps[seat-1].name).toBe(shooter);
   for(const l of p.ui.talk.craps){said.add(l.mood);if(l.mood==='you')texts.push(l.text);}flush();}
  expect(said.has('you')).toBe(true);expect(said.has('act')).toBe(true);
  expect(texts.some(t=>/shooter|roll|Point|line|dice/i.test(t))).toBe(true);
 });
 it('baccarat and race players say when they are on your side or your horse',()=>{
  const p=player(9);p.setChip(100);let twinB=false;
  for(let i=0;i<120&&!twinB;i++){p.placeBaccarat('banker');p.dealBaccarat();twinB=p.ui.talk.baccarat.some(l=>l.mood==='you'&&/Banker/.test(l.text));flush();}
  expect(twinB).toBe(true);
  const q=player(11);q.setChip(100);q.setQuick(true);let twinR=false,hello=false;
  for(let i=0;i<80&&!twinR;i++){const no=q.ui.races.card.runners.filter(r=>!r.scratched).map(r=>r.no);for(const n of no.slice(0,3))q.pickRunner(n);q.startRace();
   twinR=q.ui.talk.races.some(l=>l.mood==='you'&&/#\d/.test(l.text));runIntervals();flush();hello||=q.ui.talk.races.some(l=>l.mood==='act'&&/leaves|night|cashes|wanders|buffet|upstairs|friends|grumbles/.test(l.text));q.nextRace();}
  expect(twinR).toBe(true);
 });
 it('you can speak once a round; players answer in character; "Nice hit" goes to the player who won; tips name their real horse',()=>{
  const p=player(13);p.setChip(100);
  p.casinoSay('roulette','luck');const t=p.ui.talk.roulette;expect(t[0]).toMatchObject({name:'You',mood:'hero',text:'Good luck, everybody!'});expect(t.length).toBeGreaterThan(1);expect(t.slice(1).every(l=>l.to==='You')).toBe(true);
  p.casinoSay('roulette','hot');expect(p.ui.talk.roulette).toBe(t);expect(p.canSay('roulette').open).toBe(false);
  expect(casinoMarkup(p,'roulette')).toMatch(/data-cz-say="luck" disabled/);
  // "Nice hit" needs a winner to compliment.
  const q=player(17);q.setChip(100);q.casinoSay('roulette','nice');expect(q.ui.talk.roulette).toEqual([]);
  for(let i=0;i<60&&!q.canSay('roulette').nice;i++){q.placeRoulette('red',[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);q.spinRoulette();flush();}
  const winner=q.ui.talk.roulette.find(l=>l.mood==='win')!.name;q.casinoSay('roulette','nice');expect(q.ui.talk.roulette.map(l=>l.name)).toEqual(['You',winner]);
  // A tip names the same horse that player backs when the race runs.
  const r=player(19);r.casinoSay('races','tips');const tips=r.ui.talk.races.slice(1);expect(tips.length).toBe(2);
  const live=r.ui.races.card.runners.filter(x=>!x.scratched);r.setChip(100);r.pickRunner(live[0].no);r.startRace();
  for(const tip of tips){const n=Number(tip.text.match(/#(\d+)/)![1]);expect(live.some(x=>x.no===n)).toBe(true);}
  for(const g of ['roulette','craps','baccarat','races'])expect(CHAT[g].length).toBe(5);
 });
 it('comings and goings: about one round in twelve, never the protected seat, always someone new',()=>{
  const table=patronsFor('craps','2026-11-23');let n=0;
  for(let i=0;i<2400;i++){const t=turnover('craps',table,`s${i}`,1);if(!t)continue;n++;expect(t.seat).not.toBe(1);expect(table.some(x=>x.name===t.arriving.name)).toBe(false);expect(t.lines.map(l=>l.mood)).toEqual(['act','talk']);}
  expect(n/2400).toBeGreaterThan(.06);expect(n/2400).toBeLessThan(.11);
  expect(chatAnswers('roulette',table,'nope','x')).toEqual([]);
 });
 it('is the same for the same seed, and nothing touches the money',()=>{
  const a=player(21),b=player(21);for(const p of [a,b]){p.setChip(100);for(let i=0;i<40;i++){p.placeRoulette('red',[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);p.spinRoulette();flush();}}
  expect(a.ui.talk.roulette).toEqual(b.ui.talk.roulette);expect(a.state.balance).toBe(b.state.balance);
  const src=readFileSync('src/casino/patrons.ts','utf8');expect([...src.matchAll(/^import .* from '([^']+)'/gm)].map(m=>m[1])).toEqual(['../bots/personas']);expect(src).not.toMatch(/stake\(|settle\(|\.balance/);
 });
});

describe('fix: races with a scratched horse',()=>{
 it('the running order skips scratched horses instead of breaking the page (a bug from Patch 101)',()=>{
  let checked=0;
  for(let k=1;k<80&&checked<3;k++){const p=player(k);if(!p.ui.races.card.runners.some(r=>r.scratched))continue;
   p.setChip(100);p.pickRunner(p.ui.races.card.runners.find(r=>!r.scratched)!.no);p.startRace();
   const m=casinoMarkup(p,'races');const order=m.match(/data-race-order>([^<]*)</)![1];
   for(const r of p.ui.races.card.runners.filter(x=>x.scratched))expect(order).not.toContain(`#${r.no} `);
   runIntervals();flush();expect(()=>casinoMarkup(p,'races')).not.toThrow();checked++;}
  expect(checked).toBe(3);
 });
});

describe('poker',()=>{
 it('twenty more conversations, each with follow-ups, using only real personalities',()=>{
  const ids=new Set(PERSONAS.map(p=>p.id));const src=readFileSync('src/bots/conversations.ts','utf8');
  expect(THREADS.length).toBe(142);
  for(const t of THREADS)for(const k of Object.keys(t.reply))if(k!=='any')expect(ids.has(k)).toBe(true);
  for(const open of ['Who’s cooking Thanksgiving this year?','Coffee here tastes like it was made Tuesday.','How about the Thunder this season?'])expect(src).toContain(open);
  const opens=new Set<string>();const seats=[{id:1,name:'Mabel'},{id:2,name:'Rex'},{id:3,name:'Jo'}];
  for(let i=0;i<4000;i++){const t=smallTalk(seats,`h${i}`);if(t[0])opens.add(t[0].text);}
  expect([...opens].some(o=>/Thanksgiving|Black Friday|taco|puppy|Grand Canyon|faucet/.test(o))).toBe(true);
 });
 it('players have more to do after they fold',()=>{
  const seen=new Set<string>();for(let i=0;i<3000;i++){const a=idleActivity(['Mabel','Rex','Jo','Doc'][i%4],undefined,`i${i}`);if(a)seen.add(a);}
  expect(seen.size).toBeGreaterThan(25);expect([...seen].some(a=>/ordering a drink|riffling chips|yawning|checking the waitlist board/.test(a))).toBe(true);
 });
});

describe('blackjack and slots',()=>{
 const seat=(n:number,hands:TalkHand[])=>({seat:n,name:['Ann','Bo','Cy'][n-1],style:null,hands});
 const run=(r:(i:number)=>TalkRound,re:RegExp)=>{for(let i=0;i<400;i++){const out=roundChatter(r(i),[]);if(out.some(l=>re.test(l.text)))return true;}return false;};
 it('reacts to your surrender, split aces, a five-card winner and your insurance; a second player echoes a cheer',()=>{
  const others=[seat(1,[{cards:['Ts','8d'],total:18,status:'stood',result:'win'}]),seat(2,[{cards:['9s','9d'],total:18,status:'stood',result:'win'}])];
  expect(run(i=>({id:`r${i}`,dealer:['Ts','7d'],hero:[{cards:['Ts','6d'],total:16,status:'surrendered',result:'surrender'}],seats:others}),/Surrender|Half back|Live to fight|Saved half|ugly/)).toBe(true);
  expect(run(i=>({id:`a${i}`,dealer:['Ts','7d'],hero:[{cards:['As','9d'],total:20,status:'stood',result:'win'},{cards:['Ad','Th'],total:21,status:'stood',result:'win'}],seats:others}),/aces/i)).toBe(true);
  expect(run(i=>({id:`f${i}`,dealer:['Ts','7d'],hero:[{cards:['2s','3d','4h','2c','5d'],total:16,status:'stood',result:'win'}],seats:others}),/Five|Little cards/)).toBe(true);
  expect(run(i=>({id:`i${i}`,dealer:['As','Kd'],hero:[{cards:['Ts','8d'],total:18,status:'stood',result:'loss'}],seats:others,insurance:{bet:500,back:1500}}),/Insurance paid|smelled|Nice insurance/)).toBe(true);
  expect(run(i=>({id:`e${i}`,dealer:['6s','Td','Kh'],hero:[{cards:['Ts','8d'],total:18,status:'stood',result:'win'}],seats:[...others,seat(3,[{cards:['Ts','7d'],total:17,status:'stood',result:'win'}])]}),/Told you she’d break|Pay us all|Everybody eats/)).toBe(true);
 });
 it('the slot neighbour makes small talk now and then',()=>{
  const said=new Set<string>();for(let i=4;i<1500;i++){const n=slotNeighbour('lucky-7s',i,{total:0,bet:100,feature:false,big:false},[{total:100}]);if(n)said.add(n.text);}
  expect([...said].some(t=>/lunch|other half|carpet|buffet|handles|lights|commercial|Mom|rub the screen|Max bet|Everybody’s down|last week/i.test(t))).toBe(true);
 });
});
