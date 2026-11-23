import {describe,it,expect} from 'vitest';
import type {GameState} from '../../src/contracts';
import {regularProfile} from '../../src/bots/regulars';
import {MISREAD_LINES} from '../../src/bots/misreads';
import {handChatter} from '../../src/bots/talk';
import {chatterFor} from '../../src/ui/table-talk';

/** Patch 50 follow-up: older games never acquire new flavour; bot cards must be shown. */
const profile=regularProfile('big-earl','low');
const kindLines=new Set(Object.values(MISREAD_LINES).flat());
function finished(id:string,shown:boolean):GameState {
 return {
  handId:id,street:'complete',profile:{bigBlind:200},board:['Kh','9h','4h','2h','Jc'],
  seats:[
   {id:0,startingStack:20000,stack:22000,folded:false,totalCommitted:2000,hole:['Ah','Th']},
   {id:1,startingStack:20000,stack:18000,folded:false,totalCommitted:2000,hole:['Kc','Kd']},
  ],
  revealedSeats:shown?[0,1]:[0],payouts:{0:4000},pots:[],
  events:[{type:'action',street:'river',seatId:1,action:{type:'call'}}],
 } as unknown as GameState;
}
const misread=(game:GameState,opts:{allowMisreadTalk?:boolean}={})=>handChatter(game,{1:{name:'Big Earl',profile,regular:'big-earl'}},opts).lines.some(l=>kindLines.has(l.text));
describe('Patch 50 misread talk compatibility',()=>{
 it('is absent by default for legacy saved games and for unshown hole cards',()=>{
  for(let i=0;i<100;i++){
   expect(misread(finished('legacy-'+i,true))).toBe(false);
   expect(misread(finished('hidden-'+i,false),{allowMisreadTalk:true})).toBe(false);
  }
 });
 it('is available in opted-in new tables and does not pollute the old talk cache',()=>{
  let said=0;
  for(let i=0;i<120;i++){
   const game=finished('v118-'+i,true);
   const persona=(id:number)=>id===1?profile:undefined;
   const legacy=chatterFor(game,persona,false,true,undefined,undefined,false);
   const modern=chatterFor(game,persona,false,true,undefined,undefined,true);
   expect(legacy.lines.some(l=>kindLines.has(l.text))).toBe(false);
   if(modern.lines.some(l=>kindLines.has(l.text)))said++;
  }
  expect(said).toBeGreaterThan(5);
 });
});
