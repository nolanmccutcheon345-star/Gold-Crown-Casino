import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {FACE_PARTS,avatarSvg,faceFor,normalizeFace,sessionMoodFace} from '../../src/ui/avatars';
import {DEFAULT_STYLE,normalizeStyle} from '../../src/ui/table-style';
import {NICKNAMES,REPLIES,handChatter,regularOfProfile,withName} from '../../src/bots/talk';
import {REGULARS,regularProfile} from '../../src/bots/regulars';
import {hand,act,rig} from '../verification/helpers';

const app=readFileSync('src/ui/app.ts','utf8'),css=readFileSync('src/ui/polish.css','utf8');

describe('patch 61 avatar picker',()=>{
 it('keeps valid parts, drops bad ones, and stays off by default',()=>{
  expect(DEFAULT_STYLE.heroFace).toBeNull();
  expect(normalizeFace({hat:2,hair:99,skin:-1,extra:'1',outfit:3})).toEqual({hat:2,outfit:3});
  expect(normalizeFace({})).toBeNull();expect(normalizeFace('x')).toBeNull();
  expect(normalizeStyle({heroFace:{skin:5}}).heroFace).toEqual({skin:5});
  for(const [part,count] of Object.entries(FACE_PARTS))expect(normalizeFace({[part]:count})).toBeNull();
 });
 it('draws the chosen parts over the default face',()=>{
  const plain=avatarSvg('You'),custom=avatarSvg('You','neutral',{hat:2});
  expect(custom).not.toBe(plain);expect(custom).toContain('#7d5733');
  expect(avatarSvg('You','neutral',{...faceFor('You')})).toBe(plain);
 });
 it('uses your face on your seat and the action bar only',()=>{
  expect(app).toContain("faceMood(shown, id), id === 0, 'seat', shown, id)");expect(app).toContain("avatarSvg(name, mood, hero ? style.heroFace : null)");
  expect(app).toContain("faceArt(seatName(0, shown), faceMood(shown, 0), true)");
  expect(app).toContain('id="face-reset"');
 });
});

describe('patch 61 session moods',()=>{
 it('reads the public session result only',()=>{
  expect(sessionMoodFace(36000,30000,200)).toBe('content');expect(sessionMoodFace(24000,30000,200)).toBe('grumpy');
  expect(sessionMoodFace(29000,30000,200)).toBe('neutral');expect(sessionMoodFace(1,undefined,200)).toBe('neutral');
  expect(app).toContain('sessionMoodFace(seat.stack, trendBase?.get(`${id}:${seat.name}`), shown.profile.bigBlind)');
 });
 it('draws content and grumpy faces differently',()=>{
  expect(new Set(['neutral','content','grumpy'].map(m=>avatarSvg('Riley',m as 'neutral'))).size).toBe(3);
 });
});

describe('patch 61 nicknames',()=>{
 it('only for real regulars, and slots the name before the punctuation',()=>{
  const ids=new Set(REGULARS.map(r=>r.id));for(const id of Object.keys(NICKNAMES))expect(ids.has(id)).toBe(true);
  expect(withName('Lucky river.','Vin')).toBe('Lucky river, Vin.');expect(withName('Next time','Vin')).toBe('Next time, Vin');expect(withName('Sure, sure.','Earl')).toBe('Sure, sure, Earl.');
 });
 it('shows up in some replies to a regular',()=>{
  const earl=regularProfile('big-earl','low'),vince=regularProfile('vince','mid');
  const personas={1:{name:'Earl',profile:earl,regular:regularOfProfile(earl)},2:{name:'Vince',profile:vince,regular:regularOfProfile(vince)}};
  const replies=[...REPLIES.toWin,...REPLIES.toLoss];let named=0;
  for(let i=0;i<600;i++){
   let s=rig({...hand([20000,20000,20000],1),handId:`n${i}`},[['2c','3d'],['As','Ad'],['Kc','Kd']],['Ah','Kh','9s','4d','8c']);
   for(let k=0;k<20&&s.street!=='complete';k++){const seat=s.seats.find(x=>x.id===s.actor)!;try{s=act(s,seat.id===0?{type:'fold'}:{type:'raise',to:20000});}catch{s=act(s,{type:'call'});}}
   const c=handChatter(s,personas);
   if(c.lines.length===2&&Object.values(NICKNAMES).some(n=>c.lines[1].text.includes(`, ${n}`))&&replies.some(r=>c.lines[1].text.startsWith(r.replace(/[.!?…]+$/,''))))named++;
   expect(c.lines.length).toBeLessThanOrEqual(2);
  }
  expect(named).toBeGreaterThan(0);
 });
});

describe('patch 61 river sweat and transitions',()=>{
 it('deals a newly arrived river slowly after a called all-in, and makes the rest wait',()=>{
  expect(app).toContain('before < 5 && shown.board.length === 5 && (allInSpotlight(shown) || bigPot)) sweat =');
  expect(css).toContain('.board-cards.sweat .playing-card:nth-child(5){animation:pna-sweat 1.3s');
  expect(css).toContain('.pot-fly{animation-delay:calc(var(--sweat,0s) + var(--reveal-n,0) * .55s + .2s)}');
  expect(css).toContain('.table-moment{animation-fill-mode:both}');
 });
 it('fades pages with opacity only, never a transform that would trap fixed bars',()=>{
  expect(css).toContain('@keyframes pna-view-a{from{opacity:.001}to{opacity:1}}');
  expect(css).toContain('main.view-anim-0>:not(.game-layout){animation:pna-view-a .24s ease-out backwards}');
  expect(app).toContain('class="view-anim-${viewSwitches % 2}"');
 });
});
