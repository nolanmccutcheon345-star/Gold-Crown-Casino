import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {HeroViewModel} from '../../src/contracts';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {syntheticLiveOneTwoPreset} from '../../src/session/configuration';
import {tableChoices,seatPreview,moveSeat} from '../../src/ui/table-picker';
import {dealerLines} from '../../src/ui/dealer-voice';
import {DEFAULT_STYLE,normalizeStyle} from '../../src/ui/table-style';
import {regularFor} from '../../src/bots/regulars';

/* Patch 67: faster table flow, home hub, live dealer feel, card room life. */
class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(_e:number|null,n:AppData){this.value=structuredClone(n);}close(){}}
let r=11;const rand=(n:number)=>{r=(r*16807)%2147483647;return r%n;};
describe('picking a table and a seat',()=>{
  const base=syntheticLiveOneTwoPreset(DEFAULT_SETTINGS);
  it('offers three different tables, one of them full, with no regular or name at two tables',()=>{
    const tables=tableChoices(base,rand);expect(tables.length).toBe(3);expect(tables.filter(t=>t.full).length).toBe(1);expect(tables[2].ahead).toBeGreaterThan(0);
    const regulars=tables.flatMap(t=>seatPreview(t.settings).filter(p=>p.regular).map(p=>p.name));expect(new Set(regulars).size).toBe(regulars.length);
    for(const t of tables){const seats=seatPreview(t.settings);expect(seats.length).toBe(8);expect(seats.filter(p=>p.regular).length).toBeGreaterThanOrEqual(1);
      expect(new Set(seats.map(p=>p.name)).size).toBe(8);for(const p of seats)expect(p.name).not.toMatch(/^Seat /);}
    const names=tables.flatMap(t=>seatPreview(t.settings).filter(p=>!p.regular).map(p=>p.name));expect(new Set(names).size).toBe(names.length);
  });
  it('moving a seat shifts everyone by one and can be undone; regulars keep their names',()=>{
    const t=tableChoices(base,rand)[0].settings,before=seatPreview(t),moved=seatPreview(moveSeat(t,1));
    expect(moved.map(p=>p.name)).toEqual([...before.slice(1),before[0]].map(p=>p.name));
    expect(seatPreview(moveSeat(moveSeat(t,1),-1)).map(p=>p.name)).toEqual(before.map(p=>p.name));
    const m=moveSeat(t,-1);for(let seat=1;seat<9;seat++){const reg=regularFor(m.opponents![seat-1]);if(reg)expect(m.seatNames?.[seat]).toBeUndefined();}
  });
  it('a picked table starts a normal session with the players and seats shown',async()=>{
    const pick=moveSeat(tableChoices(base,rand)[1].settings,1),c=new SessionController(new Port());await c.init();await c.startSession(pick);expect(c.error).toBe('');
    const seats=c.data!.active!.game.seats.filter(s=>s.id!==0).sort((a,b)=>a.id-b.id).map(s=>s.name);expect(seats).toEqual(seatPreview(pick).map(p=>p.name));
  });
});
describe('dealer voice',()=>{
  const view=(over:Partial<HeroViewModel>):HeroViewModel=>({handId:'h',street:'preflop',board:[],events:[],seats:[{id:0,name:'You',allIn:false},{id:1,name:'Riley',allIn:false}],payouts:{},...over} as unknown as HeroViewModel);
  it('says the board, all-ins and the winner, once',()=>{
    const pre=view({}),flop=view({street:'flop',board:['Kh','7c','2d'] as never});
    expect(dealerLines(pre,flop)).toEqual(['Flop: king of hearts, seven of clubs, deuce of diamonds.']);
    expect(dealerLines(flop,flop)).toEqual([]);
    const river=view({street:'river',board:['Kh','7c','2d','Ts','As'] as never});expect(dealerLines(flop,river)).toEqual(['Turn: ten of spades.','River: ace of spades.']);
    const shove=view({street:'river',board:river.board,events:[{type:'action',seatId:1,action:{type:'raise',to:900}} as never],seats:[{id:0,name:'You',allIn:false},{id:1,name:'Riley',allIn:true}] as never});
    expect(dealerLines(river,shove)).toEqual(['Riley is all in.']);
    const done=view({street:'complete',board:river.board,events:shove.events,seats:shove.seats,payouts:{1:1800}});expect(dealerLines(shove,done)).toEqual(['Riley takes the pot.']);
    expect(dealerLines(done,view({handId:'h2',payouts:{0:1,1:1},street:'complete'}))).toContain('Split pot.');
  });
  it('is off by default and remembered',()=>{expect(DEFAULT_STYLE.dealerVoice).toBe(false);expect(normalizeStyle({dealerVoice:true}).dealerVoice).toBe(true);});
});
describe('wiring',()=>{
  const app=readFileSync('src/ui/app.ts','utf8');
  it('faster flow, dealer feel, card room life and the hub are in the app',()=>{
    expect(app).toContain('id="skip-to-turn"');expect(app).toContain('SKIP_PACE_MS = 140');expect(app).toContain('AUTO_DEAL_QUICK_MS = 1200');
    expect(app).toContain('Time has been called…');expect(app).toContain("'counts their chips'");expect(app).toContain('|| bigPot');
    expect(app).toContain('function arrivalLine()');expect(app).toContain('id="change-table"');expect(app).toContain('data-testid="waiting-list"');
    expect(app).toContain("{ view: 'home', label: 'Home'");expect(app).toContain('function homeView()');expect(app).toContain('Drill of the day');
    expect(app).toContain("if (view === 'live' && !controller.data.active && controller.data.hands.length > 0) view = 'home';");
  });
});
