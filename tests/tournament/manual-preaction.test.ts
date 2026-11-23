import {describe,it,expect,vi} from 'vitest';
import {startHand,projectView} from '../../src/core/engine';
import type {RuleProfile} from '../../src/contracts';
import {bindTournamentPlay,type TournamentPlaySource} from '../../src/ui/tournament-play';
const profile:RuleProfile={id:'review35',version:'1',mode:'cash',chipUnit:1,smallBlind:25,bigBlind:50,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
describe('manual tournament actions supersede queued Check/Fold',()=>{
 it.each(['#t-call','#t-fold','#t-raise','#t-all-in'])('%s clears the queue before an unsettled commitment',async selector=>{
  const order:string[]=[];let resolve!:()=>void;const pending=new Promise<void>(r=>{resolve=r});
  const game=startHand({handId:'manual-queue',profile,button:3,seats:Array.from({length:6},(_,id)=>({id,name:`Player ${id}`,stack:3000}))});
  const c:TournamentPlaySource={status:'ready',busy:false,error:'',data:{active:{entrants:6,handNumber:1,paused:false,status:'running',history:[],finishes:[]}},view:null,gameView:projectView(game,0),act:async()=>{order.push('commit');await pending;},nextHand:vi.fn(),setPaused:vi.fn(),finishEvent:vi.fn()};
  const listeners=new Map<string,()=>void>();const root={querySelectorAll:(s:string)=>s.startsWith('#')?[{addEventListener:(_type:string,listener:()=>void)=>listeners.set(s,listener)}]:[],querySelector:(s:string)=>s==='#t-raise-to'?{value:'100',addEventListener:()=>{}}:null} as unknown as HTMLElement;
  bindTournamentPlay(root,c,{signal:new AbortController().signal,onManualAction:()=>order.push('cancel queued action'),onAction:()=>order.push('finished'),onDraft:()=>{},onError:()=>{}});
  listeners.get(selector)!();expect(order).toEqual(['cancel queued action','commit']);resolve();await pending;await Promise.resolve();expect(order).toContain('finished');
 });
});
