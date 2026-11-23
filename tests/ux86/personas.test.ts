import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {PERSONAS,personaFor} from '../../src/bots/personas';
import {handChatter,actionChatter} from '../../src/bots/talk';
import {roundChatter} from '../../src/blackjack/table-talk';
import {regularProfile} from '../../src/bots/regulars';
import {hand,act,rig} from '../verification/helpers';
import type {GameState} from '../../src/contracts';

/* Patch 86: table personalities and more talk. */
describe('personalities',()=>{
  it('twelve personalities, each with lines for every moment and small talk',()=>{
    expect(PERSONAS.length).toBe(12);expect(new Set(PERSONAS.map(p=>p.id)).size).toBe(12);
    for(const p of PERSONAS){expect(p.openers.length,p.id).toBeGreaterThanOrEqual(2);expect(p.answers.length,p.id).toBeGreaterThanOrEqual(3);expect(p.lines.win?.length,p.id).toBeGreaterThan(0);expect(p.lines.loss?.length,p.id).toBeGreaterThan(0);}
  });
  it('a name always gets the same personality, regulars get their own, and strangers spread across all of them',()=>{
    expect(personaFor('Lisa')).toBe(personaFor('Lisa'));expect(personaFor('Vince','vince').id).toBe('needler');expect(personaFor('Sal','sal').id).toBe('rookie');
    const seen=new Set(Array.from({length:400},(_,i)=>personaFor(`Stranger ${i}`).id));expect(seen.size).toBe(12);
  });
  it('no personality line names a card, a hand strength or a playing style',()=>{
    const all=PERSONAS.flatMap(p=>[...Object.values(p.lines).flat(),...Object.values(p.actions).flat(),...p.openers,...p.answers]) as string[];
    for(const l of all)expect(l,l).not.toMatch(/\b(aces|kings|queens|nit|maniac|calling station|tight|loose)\b/i);
  });
});
function playOut(seed:number):GameState {
  let s=rig({...hand([20000,20000,20000,20000],1),handId:`p86-${seed}`},[['As','Ad'],['Kc','Kd'],['7h','2c'],['Qs','Js']],['Ah','Kh','9s','4d','3c']);
  for(let k=0;k<20&&s.street!=='complete';k++){const seat=s.seats.find(x=>x.id===s.actor)!;try{s=act(s,seat.id===0?{type:'fold'}:{type:'call'});}catch{s=act(s,{type:'check'});}}
  return s;
}
describe('small talk between hands',()=>{
  it('strangers sometimes make small talk and answer each other, deterministically, never Hero',()=>{
    const profile=regularProfile('nina','mid');
    const personas=Object.fromEntries([1,2,3].map(id=>[id,{name:['Lisa','Ray','Gail'][id-1],profile}]));
    const openers=new Set(PERSONAS.flatMap(p=>p.openers)),answers=new Set(PERSONAS.flatMap(p=>p.answers));
    let small=0,answered=0;
    for(let i=0;i<300;i++){const s=playOut(i);if(s.street!=='complete')continue;const c=handChatter(s,personas);expect(handChatter(s,personas)).toEqual(c);
      for(const l of c.lines)expect(l.seatId).not.toBe(0);
      if(c.lines[0]&&openers.has(c.lines[0].text)){small++;if(c.lines[1]&&answers.has(c.lines[1].text))answered++;}}
    expect(small).toBeGreaterThan(5);expect(answered).toBeGreaterThan(1);
  });
  it('mid-hand quips use the stranger’s personality',()=>{expect(readFileSync('src/bots/talk.ts','utf8')).toContain('personaFor(persona.name).actions[kind]');expect(typeof actionChatter).toBe('function');});
});
describe('blackjack and Omaha talk',()=>{
  it('blackjack players groan at their own bust sometimes',()=>{
    const seats=[{seat:1,name:'Lisa',style:null,hands:[{cards:['Ts','6d','9c'],total:25,status:'bust',result:'loss'}]}];
    const lines=Array.from({length:200},(_,i)=>roundChatter({id:`r${i}`,dealer:['9s','8d'],hero:[{cards:['Tc','8c'],total:18,status:'stand',result:'win'}],seats},[])).flat();
    expect(lines.some(l=>/Too many|Twenty-two|stayed|face card|Busted/.test(l.text))).toBe(true);
  });
  it('Omaha has small talk between hands',()=>{const t=readFileSync('src/plo/table.ts','utf8');expect(t).toContain('smallTalk(named,');});
  it('the player card names the table manner and says it is not a style',()=>{const a=readFileSync('src/ui/app.ts','utf8');expect(a).toContain('data-testid="profile-persona"');expect(a).toContain('it says nothing about how they play');});
});
