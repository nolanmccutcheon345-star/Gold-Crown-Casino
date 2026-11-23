import {describe,it,expect} from 'vitest';
import {runInNewContext} from 'node:vm';
import {readFileSync} from 'node:fs';
import {LOSS_EMOTES,WIN_EMOTES,emoteMarkup,seatEmote} from '../../src/ui/moments';
import type {HeroViewModel} from '../../src/contracts';

const app=readFileSync('src/ui/app.ts','utf8'),css=readFileSync('src/ui/polish.css','utf8');
const sw=readFileSync('public/sw.js','utf8'),main=readFileSync('src/main.ts','utf8'),manifest=JSON.parse(readFileSync('public/site.webmanifest','utf8'));
const view=(handId:string,deltas:number[],street='complete'):HeroViewModel=>({handId,street,profile:{bigBlind:200},seats:deltas.map((d,id)=>({id,stack:30000+d,startingStack:30000}))}) as unknown as HeroViewModel;

describe('patch 56 seat emotes',()=>{
 it('reacts only to 25+ big blind swings, never for Hero, only after settlement',()=>{
  const v=view('h1',[9000,-4999,5000,-5000]);
  expect(seatEmote(v,0,0)).toBe('');expect(seatEmote(v,1,0)).toBe('');
  expect(seatEmote(view('h1',[0,0,5000],'river'),2,0)).toBe('');
 });
 it('is the same every time for a hand, and about half of big swings react',()=>{
  let reacted=0,total=0;
  for(let i=0;i<400;i++){const v=view(`hand-${i}`,[0,8000,-8000]);for(const seat of [1,2]){const e=seatEmote(v,seat,0);expect(seatEmote(v,seat,0)).toBe(e);total++;if(e){reacted++;expect(seat===1?WIN_EMOTES:LOSS_EMOTES).toContain(e);}}}
  expect(reacted/total).toBeGreaterThan(.4);expect(reacted/total).toBeLessThan(.6);
 });
 it('is decorative and only shown with table talk on',()=>{
  expect(emoteMarkup('😎')).toContain('aria-hidden="true"');expect(emoteMarkup('')).toBe('');
  expect(app).toContain("${tableTalk ? emoteMarkup(seatEmote(shown, id, 0)) : ''}");
 });
});

describe('patch 56 player cards',()=>{
 it('opens from a labelled button on each opponent seat, never Hero',()=>{
  expect(app).toContain('${id !== 0 && shown ? `<button type="button" class="seat-profile-hit" data-profile="${id}" aria-label="${escape(seatName(id,shown))}: player card"></button>`');
 });
 it('uses completed public actions for the same player only, and shows numbers between hands',()=>{
  expect(app).toContain('hand.view.seats.some(item => item.id === seat.id && item.name === seat.name)');
  expect(app).toContain('buildOpponentMemory(publicMemoryHands(together, active.sessionId, 0), 0, 1)');
  expect(app).toContain("const between = shown.street === 'complete';");
  expect(app).toContain('Styles and hidden cards are never shown.');
  const card=app.slice(app.indexOf('function profileCard('),app.indexOf('function tourMarkup('));
  expect(card).not.toMatch(/profiles\[|privateProfiles|archetype|recordedSessionStyles|\.hole\b/);
 });
 it('closes with Escape or the close button and returns focus to the seat',()=>{
  expect(app).toContain("if (event.key === 'Escape' && profileSeat !== null)");
  expect(app).toContain('root.querySelector<HTMLElement>(`[data-profile="${seat}"]`)?.focus');
 });
});

describe('patch 56 offline app',()=>{
 it('registers the service worker only on HTTPS, never on local test servers',()=>{
  expect(main).toContain("'serviceWorker' in navigator && location.protocol === 'https:'");
 });
 it('is network-first, same-origin GET only, versioned, bounded, and never touches saved games',()=>{
  const scope='https://poker.example/';
  const mayCache=runInNewContext(sw+'\nmayCache',{URL,self:{
    registration:{scope},location:new URL(scope),addEventListener:()=>{}
  }}) as (request:{method:string},url:URL)=>boolean;
  expect(mayCache({method:'GET'},new URL('assets/table.js',scope))).toBe(true);
  expect(mayCache({method:'POST'},new URL('assets/table.js',scope))).toBe(false);
  expect(mayCache({method:'GET'},new URL('https://elsewhere.example/table.js'))).toBe(false);
  expect(mayCache({method:'GET'},new URL('api/data',scope))).toBe(false);
  expect(sw.indexOf('await fetch(request)')).toBeLessThan(sw.indexOf('caches.match(request)'));
  expect(sw).toMatch(/const CACHE=PREFIX\+'v\d+'/);expect(sw).toContain('const LIMIT=160;');
  expect(sw).toContain("keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE)");
  expect(sw).not.toMatch(/indexedDB|localStorage/);
 });
 it('keeps the manifest in browser display, so installs share the browser\'s saved data',()=>{
  expect(manifest.display).toBe('browser');
 });
 it('offers the install button only when the browser provides an install prompt',()=>{
  expect(app).toContain("window.addEventListener('beforeinstallprompt'");
  expect(app).toContain("${installPrompt ? '<button type=\"button\" id=\"install-app\"");
 });
});

describe('patch 56 bet chips stack up',()=>{
 it('drops each newly added chip onto the bet, staggered',()=>{
  expect(css).toContain('.seat-bet .chip-stack .chip{animation:pna-chip-drop .22s ease-out both}');
  expect(css).toContain('.seat-bet .chip-stack .chip:nth-child(5){animation-delay:.2s}');
 });
});
