import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {setTableFaces,facesFor} from '../../src/ui/face-hook';
import {PORTRAIT_COUNT,tablePortraits,portraitFor} from '../../src/ui/portraits';
import {otherSeatsMarkup} from '../../src/blackjack/full-table';

/* Patch 84: 60 new portraits and faces in every game. */
describe('new portraits',()=>{
  it('106 portraits, the new ones at both sizes',()=>{
    expect(PORTRAIT_COUNT).toBe(106);
    for(let i=46;i<106;i++)for(const d of ['public/avatars/','public/avatars/s/'])expect(existsSync(`${d}p${i}.webp`)).toBe(true);
  });
  it('a full table of strangers still gets nine different portraits, and new ones are used',()=>{
    const names=['Alex','Morgan','Sam','Jordan','Casey','Riley','Quinn','Avery','Drew'];
    const m=tablePortraits(names,0);expect(new Set(m.values()).size).toBe(9);
    const used=new Set(Array.from({length:300},(_,i)=>portraitFor(`Player ${i}`)));expect([...used].some(p=>p>=46)).toBe(true);
  });
});
describe('one face hook for every game',()=>{
  it('no renderer: views keep their plain look',()=>{setTableFaces(null);expect(facesFor(['A'])).toBeNull();});
  it('blackjack seats show a face for each player and for Hero',()=>{
    const seen:string[][]=[];
    setTableFaces(names=>{seen.push([...names]);return (name,hero)=>`<i data-face="${hero?'HERO':name}"></i>`;});
    const html=otherSeatsMarkup({actingSeat:null,pace:'casino',seats:[
      {seat:1,kind:'player',name:'Dot',style:null,hands:[],bet:500,lastAction:null},
      {seat:2,kind:'hero',name:'You',style:null,hands:[],bet:500,lastAction:null},
      {seat:3,kind:'empty',name:'',style:null,hands:[],bet:0,lastAction:null}]});
    expect(html).toContain('data-face="Dot"');expect(html).toContain('data-face="HERO"');expect(seen[0]).toEqual(['Dot']);
    setTableFaces(null);
  });
  it('tournament, Omaha, heads-up and the app all use it',()=>{
    for(const f of ['src/ui/tournament-play.ts','src/plo/view.ts','src/ui/heads-up.ts','src/blackjack/full-table.ts'])expect(readFileSync(f,'utf8')).toContain('facesFor(');
    const app=readFileSync('src/ui/app.ts','utf8');expect(app).toContain('setTableFaces(');expect(app).toMatch(/if \(!style\.avatars\) return null;/);
  });
});
