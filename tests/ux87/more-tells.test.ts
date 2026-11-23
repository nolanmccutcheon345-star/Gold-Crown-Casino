import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {sideTells,boardTell,TELL_GUIDE,WAITING_TELLS,BOARD_TELLS} from '../../src/bots/more-tells';
import {tellStyle} from '../../src/bots/tells';
import {regularProfile} from '../../src/bots/regulars';
import type {Card} from '../../src/contracts';

/* Patch 87: waiting tells and board reactions. */
const weakPlayer=regularProfile('sal','mid'),strongPlayer=regularProfile('hiro','mid');
const seat=(id:number,hole:Card[])=>({id,hole,folded:false,allIn:false,stack:200});
describe('waiting tells',()=>{
  it('only while Hero decides, only from players still to act, deterministic',()=>{
    let shown=0;
    for(let i=0;i<300;i++){
      const g={handId:`h${i}`,street:'preflop',board:[] as Card[],actor:0,events:[],seats:[seat(0,['2c','3d']),seat(1,['7h','2s']),seat(2,['As','Ah'])]};
      const m=sideTells(g,()=>weakPlayer);expect(sideTells(g,()=>weakPlayer)).toEqual(m);
      expect(m.has(0)).toBe(false);
      for(const t of m.values()){expect(t.kind).toBe('waiting');shown++;
        if(!t.fake)expect(t.says).toBe(t.truth);
        expect([...WAITING_TELLS.weak,...WAITING_TELLS.strong]).toContain(t.text);}
      expect(sideTells({...g,actor:1},()=>weakPlayer).size).toBe(0);
    }
    expect(shown).toBeGreaterThan(60);
  });
  it('weak players leak far more than skilled ones',()=>{
    const count=(p:typeof weakPlayer)=>Array.from({length:400},(_,i)=>sideTells({handId:`c${i}`,street:'preflop',board:[],actor:0,events:[],seats:[seat(0,['2c','3d']),seat(1,['7h','2s'])]},()=>p).size).reduce((a,b)=>a+b,0);
    expect(tellStyle(weakPlayer).rate).toBeGreaterThan(tellStyle(strongPlayer).rate);
    expect(count(weakPlayer)).toBeGreaterThan(count(strongPlayer)*2);
  });
});
describe('board reactions',()=>{
  it('a player with one card of a suit rechecks when the third card of that suit lands',()=>{
    let rechecks=0;
    for(let i=0;i<200;i++){const t=boardTell({handId:`f${i}`,street:'turn',board:['2h','9h','Kc','5h']},1,['Ah','Qs'],weakPlayer);if(t?.text===BOARD_TELLS.recheck)rechecks++;}
    expect(rechecks).toBeGreaterThan(100);
    expect(boardTell({handId:'x',street:'turn',board:['2h','9h','Kc','5h']},1,['Ah','Qh'],weakPlayer)?.text).not.toBe(BOARD_TELLS.recheck);
  });
  it('no reaction from a player who has already acted on the street',()=>{
    const g={handId:'h',street:'flop',board:['2h','9h','5h'] as Card[],actor:2,events:[{type:'action',street:'flop',seatId:1,action:{type:'check'}}] as never,seats:[seat(0,['2c','3d']),seat(1,['Ah','Qs']),seat(2,['Kd','Kc'])]};
    expect(sideTells(g,()=>weakPlayer).has(1)).toBe(false);
  });
});
describe('on screen',()=>{
  it('cash and tournament seats show them in one neutral style; the coach has a tell guide; coaching reads board reactions',()=>{
    const app=readFileSync('src/ui/app.ts','utf8'),t=readFileSync('src/ui/tournament-play.ts','utf8'),css=readFileSync('src/ui/visuals.css','utf8'),coach=readFileSync('src/ui/tell-coach.ts','utf8');
    expect(app).toContain('sideTellMarkup(cashSideTells().get(id), escape)');expect(app).toContain('sideTells:tournamentSideTells()');expect(t).toContain('options.sideTells?.get(id)');
    expect(css).toContain('.side-tell{');expect(css).not.toMatch(/side-tell[^{]*(strong|weak)/);
    expect(app).toContain('data-testid="tell-guide"');expect(TELL_GUIDE.length).toBeGreaterThanOrEqual(10);expect(coach).toContain('boardTell(');
  });
});
