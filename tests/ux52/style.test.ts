import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {DEFAULT_STYLE,chipColors,chipStackMarkup,heroHandLabel,normalizeStyle,styleClasses} from '../../src/ui/table-style';
import {soundCues,soundState} from '../../src/ui/sounds';
import {sampleView} from '../tournament/fixtures';
import {tournamentPlayMarkup,type TournamentPlaySource} from '../../src/ui/tournament-play';
import {projectSpectatorView,startHand} from '../../src/core/engine';
import type {Card,GameEvent,RuleProfile} from '../../src/contracts';

const css=readFileSync('src/ui/polish.css','utf8');
const app=readFileSync('src/ui/app.ts','utf8');

describe('patch 52 hand label',()=>{
 it('names starting hands preflop',()=>{
  expect(heroHandLabel(['7h','7d'],[])).toBe('Pocket sevens');
  expect(heroHandLabel(['Kd','As'],[])).toBe('Ace-king offsuit');
  expect(heroHandLabel(['Th','Jh'],[])).toBe('Jack-ten suited');
 });
 it('names the best made hand from Hero cards and the board',()=>{
  expect(heroHandLabel(['7h','Td'],['7s','2c','Kd'])).toBe('Pair of sevens');
  expect(heroHandLabel(['Ah','2h'],['5h','9h','Kh','Qs'])).toBe('Ace-high flush');
  expect(heroHandLabel(['2c','3d'],['As','Ks','Qs','Js','Ts'])).toBe('Royal flush · playing the board');
 });
 it('needs exactly two hole cards and never sees other seats',()=>{
  expect(heroHandLabel([],['As','Ks','Qs'])).toBe('');
  expect(heroHandLabel.length).toBe(2);
 });
});

describe('patch 52 preferences',()=>{
 it('defaults to quiet, no hand label, chips on, classic look',()=>{
  expect(DEFAULT_STYLE).toEqual({felt:'green',back:'blue',fourColor:false,sound:false,handLabel:false,chips:true,keys:false,theme:'dark',vibrate:false,avatars:true,breakEvery:0,textSize:'normal',trends:true,heroFace:null,portraits:true,heroPortrait:null,dealerVoice:false,tokes:'off',volume:70,ambience:false,clicks:false});
 });
 it('repairs damaged saved values field by field',()=>{
  expect(normalizeStyle({felt:'purple',back:'red',sound:'yes',handLabel:true})).toEqual({...DEFAULT_STYLE,back:'red',handLabel:true});
  expect(normalizeStyle(null)).toEqual(DEFAULT_STYLE);
 });
 it('maps to shell classes',()=>{
  expect(styleClasses({...DEFAULT_STYLE,felt:'blue',fourColor:true,chips:false})).toBe(' felt-blue back-blue four-color no-chips');
 });
 it('keeps blackjack out of the poker themes',()=>{
  const themed=css.split('Patch 52: table themes')[1].split('Patch 52: chip stacks')[0];
  expect(themed).not.toContain('bj-');expect(themed).toMatch(/\.back-red \.playing-card\.card-back/);
 });
});

describe('patch 52 chip stacks',()=>{
 it('draws larger denominations first and at most five chips',()=>{
  expect(chipColors(200,200)).toEqual(['white']);
  expect(chipColors(1200,200)).toEqual(['red','white']);
  expect(chipColors(100,200)).toEqual(['blue']);
  expect(chipColors(1_000_000,200)).toHaveLength(5);
  expect(chipColors(0,200)).toEqual([]);
 });
 it('is decorative only',()=>{
  expect(chipStackMarkup(400,200)).toContain('aria-hidden="true"');
  expect(chipStackMarkup(0,200)).toBe('<i></i>');
 });
});

describe('patch 52 sounds',()=>{
 const ev=(type:GameEvent['type'],action?:GameEvent['action']):GameEvent=>({id:String(Math.random()),handId:'h',revision:1,type,action});
 const view=(events:GameEvent[],street='flop',handId='h',payouts:Record<number,number>={})=>({handId,street,events,payouts}) as never;
 it('plays nothing on the first render or a page change',()=>{
  const v=view([ev('start')]);expect(soundCues(null,soundState(v,false),v)).toEqual([]);
 });
 it('maps new public events to sounds',()=>{
  const before=view([ev('start')]),after=view([ev('start'),ev('action',{type:'raise',to:400}),ev('street')]);
  expect(soundCues(soundState(before,false),soundState(after,true),after)).toEqual(['chip','card','turn']);
  const checked=view([ev('start'),ev('action',{type:'check'})]);
  expect(soundCues(soundState(before,false),soundState(checked,false),checked)).toEqual(['check']);
 });
 it('does not flood after a jump and plays a deal on a new hand',()=>{
  const before=view([ev('start')]),jump=view([ev('start'),...Array.from({length:6},()=>ev('action',{type:'call'}))]);
  expect(soundCues(soundState(before,false),soundState(jump,false),jump)).toEqual([]);
  const next=view([ev('start')],'preflop','h2');
  expect(soundCues(soundState(before,false),soundState(next,false),next)).toEqual(['deal']);
 });
 it('plays a win only when Hero is paid',()=>{
  const before=view([ev('start')],'river'),won=view([ev('start'),ev('award')],'complete','h',{0:500}),lost=view([ev('start'),ev('award')],'complete','h',{2:500});
  expect(soundCues(soundState(before,false),soundState(won,false),won)).toContain('win');
  expect(soundCues(soundState(before,false),soundState(lost,false),lost)).not.toContain('win');
 });
 it('is off by default and only plays from the player setting',()=>{
  expect(app).toContain('if (style.sound) playCues(cues);');
 });
});

describe('patch 52 tournament markup',()=>{
 const rules:RuleProfile={id:'ux52',version:'1',mode:'tournament',chipUnit:1,smallBlind:25,bigBlind:50,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:0,antePriority:'blind-first',buttonRule:'dead-button'}};
 const source=():TournamentPlaySource=>{
  const game=startHand({handId:'ux52',profile:rules,button:3,seats:Array.from({length:6},(_,id)=>({id,name:`Player ${id}`,stack:3000}))});
  const hero=projectSpectatorView(game);
  hero.seats=hero.seats.map(seat=>seat.id===0?{...seat,hole:game.seats[0].hole as Card[]}:seat);
  return {status:'ready',busy:false,error:'',data:{active:{entrants:6,handNumber:1,paused:false,status:'running',history:[],finishes:[]}},view:{...sampleView({entrants:6,playersLeft:6,level:1,heroRank:null}),status:'running'},gameView:hero,act:vi.fn(async()=>{}),nextHand:vi.fn(async()=>{}),setPaused:vi.fn(async()=>{}),finishEvent:vi.fn(async()=>{})} as unknown as TournamentPlaySource;
 };
 it('shows the hand label only when asked and marks card suits',()=>{
  const c=source();
  expect(tournamentPlayMarkup(c,'',{handLabel:true})).toContain('data-testid="hero-hand-label"');
  expect(tournamentPlayMarkup(c,'',{})).not.toContain('hero-hand-label');
  expect(tournamentPlayMarkup(c,'',{})).toMatch(/playing-card[^"]* suit-[cdhs]/);
 });
});
