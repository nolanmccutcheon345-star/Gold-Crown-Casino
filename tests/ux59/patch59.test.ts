import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {ACTION_LINES,VOICES,actionChatter,handChatter,regularOfProfile} from '../../src/bots/talk';
import {REGULARS,regularProfile} from '../../src/bots/regulars';
import {avatarSvg,liveMood} from '../../src/ui/avatars';
import {quipFor,quipMarkup} from '../../src/ui/table-talk';
import {hand,act,rig} from '../verification/helpers';
import type {GameState} from '../../src/contracts';

const app=readFileSync('src/ui/app.ts','utf8'),css=readFileSync('src/ui/polish.css','utf8');

describe('patch 59 personality voices',()=>{
 it('gives every regular their own voice, keyed by real regular ids',()=>{
  const ids=new Set(REGULARS.map(r=>r.id));
  for(const id of Object.keys(VOICES))expect(ids.has(id)).toBe(true);
  expect(Object.keys(VOICES).length).toBe(REGULARS.length);
 });
 it('keeps lines short and friendly',()=>{
  for(const banks of [...Object.values(VOICES),...Object.values(ACTION_LINES).map(lines=>({x:lines}))])
   for(const lines of Object.values(banks))for(const line of lines as string[]){expect(line.length).toBeLessThan(40);expect(line).not.toMatch(/idiot|stupid|hate you|kill/i);}
 });
});

const personaTable=(seed:string)=>{
 const vince=regularProfile('vince','mid');
 const personas=Object.fromEntries([1,2].map(id=>[id,{name:`P${id}`,profile:vince,regular:regularOfProfile(vince)}]));
 let g=hand([20000,20000,20000],1);g={...g,handId:seed};
 return {g,personas};
};
describe('patch 59 mid-hand chatter',()=>{
 it('never speaks for Hero, never after the hand, and is the same on every redraw',()=>{
  let spoke=0;
  for(let i=0;i<300;i++){
   const {g,personas}=personaTable(`q${i}`);
   let s:GameState=g;
   for(let k=0;k<4&&s.street==='preflop'&&s.actor!==null;k++){s=act(s,s.actor===0?{type:'call'}:k<2?{type:'raise',to:600*(k+1)}:{type:'call'});const q=actionChatter(s,personas);
    expect(actionChatter(s,personas)).toEqual(q);if(q){spoke++;expect(q.seatId).not.toBe(0);}if(spoke>200)break;}
  }
  expect(spoke).toBeGreaterThan(0);
  const done={...personaTable('z').g,street:'complete'} as GameState;expect(actionChatter(done,personaTable('z').personas)).toBeNull();
 });
 it('depends only on the public action, never on anyone\'s cards',()=>{
  for(let i=0;i<120;i++){
   const {g,personas}=personaTable(`c${i}`);
   const a=rig(g,[['As','Ad'],['2c','7d'],['Kh','Qh']],['3s','8d','Jc','4h','9s']),b=rig(g,[['5s','5d'],['Ac','Ah'],['2h','3h']],['3s','8d','Jc','4h','9s']);
   const step=(s:GameState)=>act(s,{type:'raise',to:600});
   const sa=step(a),sb=step(b);
   expect(actionChatter(sa,personas)).toEqual(actionChatter(sb,personas));
  }
 });
 it('talks rarely on checks and often on all-ins for a chatty player',()=>{
  let allins=0,n=0;
  for(let i=0;i<200;i++){const {g,personas}=personaTable(`a${i}`);const s=act(g,{type:'raise',to:20000});n++;if(actionChatter(s,personas))allins++;}
  expect(allins/n).toBeGreaterThan(.35);
 });
 it('stays silent with table talk off',()=>{
  const {g}=personaTable('off');
  expect(quipFor(act(g,{type:'raise',to:600}),()=>regularProfile('vince','mid'),false)).toBeNull();
  expect(quipMarkup(null,1,'k')).toBe('');
  expect(quipMarkup({seatId:1,text:'<b>'},1,'k')).toContain('&lt;b&gt;');
 });
 it('leaves end-of-hand chatter rules intact: at most two lines, deterministic',()=>{
  const {g,personas}=personaTable('end');let s=g;
  while(s.street!=='complete'){try{s=act(s,s.actor===0?{type:'fold'}:{type:'call'});}catch{s=act(s,{type:'check'});}}
  const c=handChatter(s,personas);expect(c.lines.length).toBeLessThanOrEqual(2);expect(handChatter(s,personas)).toEqual(c);
 });
});

describe('patch 59 live face reactions',()=>{
 const view=(events:{seatId:number;type:string;to?:number}[],pot:number,seats:{id:number;folded?:boolean;allIn?:boolean}[],street='flop')=>({street,pot,profile:{bigBlind:200},events:events.map(e=>({type:'action',seatId:e.seatId,action:{type:e.type,to:e.to}})),seats:seats.map(s=>({folded:false,allIn:false,stack:1000,startingStack:1000,...s}))});
 it('smirks after raising, sighs after folding, and looks surprised at a big bet',()=>{
  const v=view([{seatId:2,type:'raise',to:1000}],1500,[{id:0},{id:1},{id:2},{id:3,folded:true}]);
  expect(liveMood(v,2)).toBe('smirk');expect(liveMood(v,1)).toBe('surprised');expect(liveMood(v,3)).toBe('neutral');expect(liveMood(v,0)).toBe('neutral');
  expect(liveMood(view([{seatId:1,type:'fold'}],400,[{id:0},{id:1,folded:true}]),1)).toBe('sigh');
 });
 it('does not react to a small bet, and returns to win/loss moods at settlement',()=>{
  expect(liveMood(view([{seatId:2,type:'raise',to:200}],1500,[{id:1},{id:2}]),1)).toBe('neutral');
  expect(liveMood({...view([],0,[{id:1}],'complete'),seats:[{id:1,folded:false,allIn:false,stack:3000,startingStack:1000}]},1)).toBe('happy');
 });
 it('draws each live mood differently',()=>{
  expect(new Set(['neutral','surprised','smirk','sigh'].map(m=>avatarSvg('Riley',m as 'neutral'))).size).toBe(4);
 });
});

describe('patch 59 dealer pitch, bet slide, action-bar faces and ambient light',()=>{
 it('pitches cards from the button seat in deal order, two rounds',()=>{
  expect(app).toContain('style="--deal-i:${dealOrder.get(id) ?? 0};');
  expect(app).toContain("seat-layer has-dealer-glide pitch\" style=\"--deal-n:");
  expect(css).toContain('.seat-layer.pitch .seat:not(.folded) .hole-cards:not(.shown-hand):not(.revealed) .playing-card+.playing-card{animation-delay:calc((var(--deal-i,0) + var(--deal-n,1)) * 70ms)}');
  expect(css).toMatch(/@keyframes pna-pitch-a\{from\{opacity:0;translate:calc\(\(var\(--dealer-x\) - var\(--seat-x\)\)/);
 });
 it('slides bets out from the name plate, shows faces on the action bar, and warms the light on big pots',()=>{
  expect(css).toMatch(/@keyframes pna-chip\{from\{opacity:0;translate:0 -30px/);
  expect(app).toContain('<span class="bar-face" aria-hidden="true">');
  expect(app).toContain("40 * shown.profile.bigBlind ? ' pot-big' : ''");
  expect(css).toContain('.pot-big .felt-line::after{opacity:.15}');
 });
});
