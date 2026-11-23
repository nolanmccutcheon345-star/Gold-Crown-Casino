import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {BIG_POT_BB,MIN_BB100_HANDS,durationText,handMoment,momentMarkup,summarizeSession} from '../../src/ui/moments';
import {bankrollSeries,downsample,lineChartMarkup,resultSeries} from '../../src/ui/charts';
import {SHORTCUTS,shortcutTarget,normalizeStyle} from '../../src/ui/table-style';
import {sampleView} from '../tournament/fixtures';
import {tournamentPlayMarkup,type TournamentPlaySource} from '../../src/ui/tournament-play';
import {projectView,startHand} from '../../src/core/engine';
import type {HeroViewModel,RuleProfile} from '../../src/contracts';
import type {AppData,MoneyEvent} from '../../src/session/types';

const money=(c:number)=>`$${(c/100).toLocaleString('en-US')}`;
const app=readFileSync('src/ui/app.ts','utf8'),css=readFileSync('src/ui/polish.css','utf8');
const settled=(stack:number,starting:number,street='complete'):HeroViewModel=>({street,profile:{bigBlind:200},seats:[{id:0,stack,startingStack:starting}]}) as unknown as HeroViewModel;

describe('patch 53 table moments',()=>{
 it('marks a big pot from 25 big blinds of profit',()=>{
  expect(BIG_POT_BB).toBe(25);
  expect(handMoment(settled(30000+4999,30000),0,money,null)).toBeNull();
  expect(handMoment(settled(30000+5000,30000),0,money,null)).toEqual({kind:'win',title:'+$50',detail:'Big pot · 25 big blinds.'});
 });
 it('calls out the biggest pot of the session only when it beats an earlier hand',()=>{
  expect(handMoment(settled(40000,30000),0,money,3000)?.detail).toBe('Your biggest pot of the session.');
  expect(handMoment(settled(40000,30000),0,money,20000)?.detail).toBe('Big pot · 50 big blinds.');
 });
 it('shows a bust moment, worded for cash or tournaments',()=>{
  expect(handMoment(settled(0,30000),0,money,null)?.title).toBe('Felted');
  expect(handMoment(settled(0,30000),0,money,null,true)?.title).toBe('Knocked out');
 });
 it('stays silent mid-hand or without a Hero seat',()=>{
  expect(handMoment(settled(0,30000,'river'),0,money,null)).toBeNull();
  expect(handMoment(settled(0,30000),3,money,null)).toBeNull();
  expect(momentMarkup(null,'h')).toBe('');
  expect(momentMarkup({kind:'win',title:'+$50',detail:'x'},'h')).toContain('role="status"');
 });
 it('hides the overlay when motion is off or reduced',()=>{
  expect(css).toContain('.motion-off .table-moment{display:none}');
  expect(css).toMatch(/prefers-reduced-motion:reduce\)\{\.table-moment\{display:none\}/);
 });
});

const ev=(index:number,kind:MoneyEvent['kind'],walletDelta:number,pokerNet=0,sessionId='s1'):MoneyEvent=>({id:`e${index}`,index,at:'2026-11-20T12:00:00Z',epoch:0,kind,walletDelta,tableDelta:0,pokerNet,sessionId,note:'',previousHash:'',hash:''});
const hand=(id:string,net:number)=>({id,sessionId:'s1',net,view:{profile:{bigBlind:200}}});
const data=(nets:number[]):AppData=>({wallet:1000000-30000+30000+nets.reduce((a,b)=>a+b,0),
 ledger:[ev(0,'adjustment',1000000,0,undefined as unknown as string),ev(1,'buy-in',-30000),...nets.map((n,i)=>ev(2+i,'hand-net',0,n)),ev(2+nets.length,'cash-out',30000+nets.reduce((a,b)=>a+b,0))],
 sessions:[{id:'s1',handIds:nets.map((_,i)=>`h${i}`),activeMs:42*60000,buyIns:30000,cashOut:30000+nets.reduce((a,b)=>a+b,0),profile:{smallBlind:100,bigBlind:200},settings:{}}],
 hands:nets.map((n,i)=>hand(`h${i}`,n))} as unknown as AppData);

describe('patch 53 cash-out summary',()=>{
 it('sums the session from the ledger and saved hands',()=>{
  const s=summarizeSession(data([400,-200,5000]),'s1')!;
  expect(s).toMatchObject({hands:3,result:5200,biggestWin:5000,buyIns:30000,cashOut:35200,smallBlind:100,bigBlind:200,bb100:null});
  // An incompletely loaded history must not claim to know the biggest hand profit.
  const partial={...data([400,-200,5000]),hands:data([400,-200,5000]).hands.slice(0,1)};
  expect(summarizeSession(partial,'s1')?.biggestWin).toBeNull();
  expect(app).toContain("cell('Best hand profit'");
 });
 it('gives bb/100 only from ten complete hands',()=>{
  expect(MIN_BB100_HANDS).toBe(10);
  const s=summarizeSession(data(Array(10).fill(200)),'s1')!;
  expect(s.bb100).toBe(100);
 });
 it('handles unknown sessions and formats durations',()=>{
  expect(summarizeSession(data([1]),'nope')).toBeNull();
  expect(durationText(20000)).toBe('under a minute');expect(durationText(42*60000)).toBe('42 min');expect(durationText(125*60000)).toBe('2 h 5 min');
 });
 it('appears when a session ends and clears when a new one starts',()=>{
  expect(app).toContain('if (lastActiveSession && !activeSession && controller.data && controller.status === \'ready\') cashOutSummary = summarizeSession(');
  expect(app).toContain('if (activeSession) cashOutSummary = null;');
 });
});

describe('patch 53 charts',()=>{
 it('builds a running result and a bankroll line that ends at today\'s balance',()=>{
  const d=data([400,-200,5000]);
  expect(resultSeries(d,money).map(p=>p.y)).toEqual([0,400,200,5200]);
  const bank=bankrollSeries(d,money);
  expect(bank[bank.length-1].y).toBe(d.wallet);
  expect(bank[0].y).toBe(1000000);
  // A ledger containing only its opening deposit must not show a misleading jump from $0.
  const firstDeposit={...d,ledger:[ev(0,'adjustment',1000000)],wallet:1000000};
  expect(bankrollSeries(firstDeposit,money).map(p=>p.y)).toEqual([1000000]);
 });
 it('downsamples long histories but keeps both ends',()=>{
  const pts=Array.from({length:1000},(_,i)=>({y:i,label:String(i)}));
  const out=downsample(pts,240);expect(out).toHaveLength(240);expect(out[0].y).toBe(0);expect(out[239].y).toBe(999);
 });
 it('draws one series on one axis with a table view and keyboard-reachable plot',()=>{
  const html=lineChartMarkup('c','Results',resultSeries(data([400,-200]),money),money,true);
  expect(html.match(/class="chart-line"/g)).toHaveLength(1);
  expect(html).toContain('class="chart-zero"');expect(html).toContain('tabindex="0"');expect(html).toContain('Show as a table');
  // Table mode exposes all plotted points instead of a 12-row subset.
  const long=Array.from({length:1000},(_,i)=>({label:`Hand ${i}`,y:i*100}));
  const table=lineChartMarkup('long','Long result',long,money,true);
  expect((table.match(/<tbody><tr>/g)??[]).length).toBe(1);
  expect((table.match(/<tr><td>/g)??[]).length).toBe(240);
  expect(lineChartMarkup('c','x',[{y:1,label:'a'}],money,false)).toBe('');
 });
});

describe('patch 53 keyboard shortcuts',()=>{
 const button=(disabled=false)=>({disabled}) as HTMLButtonElement;
 const root=(map:Record<string,HTMLButtonElement>)=>({querySelector:(s:string)=>map[s]??null}) as unknown as ParentNode;
 const key=(k:string,extra:Partial<{altKey:boolean;ctrlKey:boolean;metaKey:boolean;target:unknown}>={})=>({key:k,altKey:false,ctrlKey:false,metaKey:false,target:null,...extra}) as Parameters<typeof shortcutTarget>[0];
 it('is off unless the player turns it on',()=>{expect(normalizeStyle(null).keys).toBe(false);});
 it('presses the matching enabled button, cash first then tournament',()=>{
  const fold=button(),tFold=button();
  expect(shortcutTarget(key('f'),root({'#fold':fold,'#t-fold':tFold}))).toBe(fold);
  expect(shortcutTarget(key('F'),root({'#t-fold':tFold}))).toBe(tFold);
  expect(shortcutTarget(key('c'),root({'#call':button(true)}))).toBeNull();
  expect(Object.keys(SHORTCUTS).sort()).toEqual(['c','f','k','n','r']);
 });
 it('never fires while typing or with modifier keys',()=>{
  const r=root({'#fold':button()});
  expect(shortcutTarget(key('f',{target:{tagName:'INPUT',isContentEditable:false}}),r)).toBeNull();
  expect(shortcutTarget(key('f',{ctrlKey:true}),r)).toBeNull();
  expect(shortcutTarget(key('x'),r)).toBeNull();
  // Keystrokes belong to the mounted app, not the whole document.
  expect(app).toContain("root.addEventListener('keydown', event => {");
 });
});

describe('patch 53 bet slider and home screen',()=>{
 const rules:RuleProfile={id:'ux53',version:'1',mode:'tournament',chipUnit:1,smallBlind:25,bigBlind:50,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:0,antePriority:'blind-first',buttonRule:'dead-button'}};
 it('adds a min-to-all-in slider on Hero\'s tournament turn',()=>{
  const game=startHand({handId:'ux53',profile:rules,button:3,seats:Array.from({length:6},(_,id)=>({id,name:`Player ${id}`,stack:3000}))});
  const view=projectView(game,0);
  expect(view.actor).toBe(0);
  const c={status:'ready',busy:false,error:'',data:{active:{entrants:6,handNumber:1,paused:false,status:'running',history:[],finishes:[]}},view:{...sampleView({entrants:6,playersLeft:6,level:1,heroRank:null}),status:'running'},gameView:view,act:vi.fn(async()=>{}),nextHand:vi.fn(async()=>{}),setPaused:vi.fn(async()=>{}),finishEvent:vi.fn(async()=>{})} as unknown as TournamentPlaySource;
  const html=tournamentPlayMarkup(c);
  expect(html).toContain('id="t-raise-slider"');expect(html).toMatch(/id="t-raise-slider" type="range" min="\d+" max="3000"/);
 });
 it('keeps the quick-start button, its disclosure and the setup button on the home screen',()=>{
  expect(app).toContain('<button id="quick-start-live" class="home-card home-card-main">');
  expect(app).toContain('Play synthetic live $1/$2 · 9 seats · $300');
  expect(app).toContain('<p class="muted home-fine-print">${LIVE_ONE_TWO_DISCLOSURE}</p>');
  expect(app).toContain('<button id="open-setup" class="home-card">');
 });
 it('puts the cash slider on Hero\'s turn only, snapping to big blinds',()=>{
  expect(app).toContain("${canRaise && max > min ? `<div class=\"amount-slider\">");
  expect(app).toContain('Math.round(v/bb)*bb');
 });
});
