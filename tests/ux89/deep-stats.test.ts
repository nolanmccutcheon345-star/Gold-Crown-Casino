import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {deepStats,heroExtras,equityVs,handCode,handGroup,allInLuck,pct} from '../../src/stats/deep';
import {projectView,legalActions} from '../../src/core/engine';
import {hand,act} from '../verification/helpers';
import type {GameState,Action} from '../../src/contracts';

/* Patch 89: deep stats. */
let seed=11;const rnd=()=>{seed=(Math.imul(seed,1103515245)+12345)>>>0;return seed/4294967296;};
function play(i:number):GameState {
  let s={...hand([20000,20000,20000,20000,20000,20000],i%6),handId:`d${i}`} as GameState;
  for(let k=0;k<60&&s.street!=='complete';k++){
    const l=legalActions(s),r=rnd();let a:Action;
    if(l.canRaise&&r<.22)a={type:'raise',to:l.minRaiseTo!};else if(l.check)a={type:'check'};else if(r<.55&&l.callAmount>0)a={type:'call'};else a={type:'fold'};
    try{s=act(s,a);}catch{s=act(s,l.check?{type:'check'}:{type:'fold'});}
  }
  return s;
}
const stored=Array.from({length:150},(_,i)=>{const g=play(i),v=projectView(g,0),hero=v.seats.find(x=>x.id===0)!;return {id:`h${i}`,sessionId:'s',epoch:0,number:i+1,startedAt:new Date(1e12+i*1000).toISOString(),endedAt:'',view:v,frames:[],net:(v.payouts[0]??0)-hero.totalCommitted,privateProfiles:{},previousHash:'',hash:''};}).filter(h=>h.view.street==='complete') as never[];
describe('deep stats',()=>{
  const all=deepStats(stored),me=all.get('You')!;
  it('counts every finished hand for every player, and every count fits inside its chances',()=>{
    expect(me.hands).toBe(stored.length);
    for(const p of all.values())for(const [k,v] of Object.entries(p))if(v&&typeof v==='object'&&'of' in (v as object)){const x=v as {count:number;of:number};expect(x.count,`${p.name} ${k}`).toBeLessThanOrEqual(x.of);expect(x.count).toBeGreaterThanOrEqual(0);}
    for(const p of all.values()){expect(p.pfr.count).toBeLessThanOrEqual(p.vpip.count);expect(p.wsd.of).toBe(p.wtsd.count);}
  });
  it('the money adds up: everyone’s result sums to minus the rake, and showdown plus non-showdown is the total',()=>{
    const total=[...all.values()].reduce((a,p)=>a+p.net,0),rake=stored.reduce((a:number,h:{view:{rake:number}})=>a+h.view.rake,0);expect(total+rake).toBe(0);
    for(const p of all.values())expect(p.showdownNet+p.nonShowdownNet).toBe(p.net);
    expect(stored.reduce((a:number,h:{net:number})=>a+h.net,0)).toBe(me.net);
  });
  it('starting hands are named and grouped',()=>{
    expect(handCode(['Ks','Ah'])).toBe('AKo');expect(handCode(['7h','8h'])).toBe('87s');expect(handCode(['Td','Tc'])).toBe('TT');
    expect(handGroup(['Ad','Kd'])).toBe('Broadway cards');expect(handGroup(['As','5s'])).toBe('Suited aces');expect(handGroup(['8h','9h'])).toBe('Suited connectors and gappers');
    const x=heroExtras(stored,[]);expect(x.groups.reduce((a,g)=>a+g.hands,0)).toBe(me.hands);expect(x.streakWin).toBeGreaterThan(0);
  });
  it('all-in equity is right, and all-in luck compares it with what happened',()=>{
    expect(equityVs(['As','Ah'],['Ks','Kh'],[])).toBeGreaterThan(.78);expect(equityVs(['As','Ah'],['Ks','Kh'],[])).toBeLessThan(.86);
    expect(equityVs(['Ah','2h'],['Kc','Kd'],['3h','9h','Jh','4c','5s'])).toBe(1);
    expect(equityVs(['Ah','Kh'],['Qc','Qd'],['2h','7h','9c'])).toBeCloseTo(equityVs(['Ah','Kh'],['Qc','Qd'],['2h','7h','9c']),9);
    const l=allInLuck(stored);expect(l.won).toBeLessThanOrEqual(l.spots);if(l.spots)expect(l.avgEquity!).toBeGreaterThan(0);
    expect(pct({count:1,of:4})).toBe(25);expect(pct({count:0,of:0})).toBeNull();
  });
});
describe('on screen',()=>{
  it('a Deep stats page under Stats, and an all-sessions line on the player card',()=>{
    const app=readFileSync('src/ui/app.ts','utf8');
    expect(app).toContain("{ view: 'deep-stats', label: 'Deep stats'");expect(app).toContain('data-testid="allin-luck"');expect(app).toContain('data-testid="deep-players"');expect(app).toContain('data-testid="profile-deep"');
  });
});
