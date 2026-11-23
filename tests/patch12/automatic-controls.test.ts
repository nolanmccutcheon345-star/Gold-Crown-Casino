import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {transpileModule,ModuleKind,ScriptTarget} from 'typescript';
import {runInNewContext} from 'node:vm';
// Execute the actual UI closure functions, with deterministic time and ports.
// This verifies scheduling/guards, not poker settlement; browser/controller tests cover integration.
const source=readFileSync(new URL('../../src/ui/app.ts',import.meta.url),'utf8');
const functions=source.slice(source.indexOf('  const completeToken ='),source.indexOf('  function nextHand('));
function fixture(){
 const s={game:{handId:'one',revision:4,street:'complete',actor:0,revealedSeats:[] as number[],seats:[{id:0,stack:100},{id:1,stack:100}]},active:{exitMode:false,queuedConfiguration:false},status:'ready',controllerError:'',error:'',paused:false,view:'live',busy:false,hidden:false,check:true,now:0,enabled:true};
 const calls:{deals:unknown[][];actions:unknown[][]}={deals:[],actions:[]};let id=0;const timers=new Map<number,()=>void>();
 const context={s,calls,Date:{now:()=>s.now},setTimeout:(fn:()=>void)=>{timers.set(++id,fn);return id;},clearTimeout:(n:number)=>timers.delete(n),document:{get visibilityState(){return s.hidden?'hidden':'visible';}},root:{querySelector:()=>null},projectView:()=>({legal:{check:s.check}}),unavailable:()=>s.busy||s.status!=='ready',nextHand:(...args:unknown[])=>{calls.deals.push(args);s.game.street='preflop';},submit:(...args:unknown[])=>calls.actions.push(args),render:()=>{}};
 const js=transpileModule(`let autoDeal=true,game=s.game,view=s.view,paused=s.paused,error=s.error;const controller={data:{active:s.active},status:s.status,error:s.controllerError};let autoDealToken='',autoDealHeld='',autoDealAt=0,autoDealTimer=null,preCheckFold='';const AUTO_DEAL_MS=2500,AUTO_DEAL_SHOWDOWN_MS=5000;${functions}
function refresh(){game=s.game;autoDeal=s.enabled;view=s.view;paused=s.paused;error=s.error;controller.status=s.status;controller.error=s.controllerError;}
({schedule(){refresh();scheduleAutoDeal()},act(){refresh();applyPreAction()},arm(key){preCheckFold=key},armed(){return preCheckFold},hold(){autoDealHeld=completeToken();cancelAutoDeal()},counting:autoDealCounting});`,{compilerOptions:{target:ScriptTarget.ES2022,module:ModuleKind.None}}).outputText;
 const api=runInNewContext(js,context) as {schedule():void;act():void;arm(k:string):void;armed():string;hold():void;counting():boolean};
 return {s,calls,api,tick(ms:number){s.now+=ms;const jobs=[...timers.values()];timers.clear();for(const fn of jobs)fn();},timers};
}
describe('Patch12 actual automatic-control closure',()=>{
 it.each([false,true])('deals once after the appropriate showdown=%s delay',showdown=>{const f=fixture();if(showdown)f.s.game.revealedSeats=[0,1];f.api.schedule();for(let i=0;i<10;i++)f.api.schedule();expect(f.timers.size).toBe(1);f.tick(showdown?4999:2499);expect(f.calls.deals).toHaveLength(0);f.tick(1);expect(f.calls.deals).toEqual([['one',4]]);f.tick(10000);expect(f.calls.deals).toHaveLength(1);});
 it.each(['off','away','paused','exit','queued','ui-error','controller-error','readonly','no-hero-chips','one-stack','active-hand'] as const)('refuses auto-deal: %s',mode=>{const f=fixture();switch(mode){case'off':f.s.enabled=false;break;case'away':f.s.view='history';break;case'paused':f.s.paused=true;break;case'exit':f.s.active.exitMode=true;break;case'queued':f.s.active.queuedConfiguration=true;break;case'ui-error':f.s.error='failed';break;case'controller-error':f.s.controllerError='failed';break;case'readonly':f.s.status='readonly';break;case'no-hero-chips':f.s.game.seats[0].stack=0;break;case'one-stack':f.s.game.seats[1].stack=0;break;case'active-hand':f.s.game.street='flop';}f.api.schedule();f.tick(10000);expect(f.calls.deals).toHaveLength(0);expect(f.timers.size).toBe(0);});
 it.each(['hidden','busy'] as const)('waits during %s then rechecks',key=>{const f=fixture();f.api.schedule();f.s[key]=true;f.tick(6000);expect(f.calls.deals).toHaveLength(0);f.s[key]=false;f.tick(250);expect(f.calls.deals).toHaveLength(1);});
 it('Hold survives rerenders but does not suppress a different hand',()=>{const f=fixture();f.api.schedule();f.api.hold();for(let i=0;i<20;i++)f.api.schedule();f.tick(9000);expect(f.calls.deals).toHaveLength(0);f.s.game.handId='two';f.api.schedule();f.tick(5000);expect(f.calls.deals).toEqual([['two',4]]);});
 it('stale countdown cannot deal a different revision',()=>{const f=fixture();f.api.schedule();f.s.game.revision++;f.tick(9000);expect(f.calls.deals).toHaveLength(0);});
 it.each([true,false])('Check/Fold submits only the correct free-check=%s action once',check=>{const f=fixture();f.s.game.street='flop';f.s.check=check;f.api.arm('one:flop');f.api.act();f.api.act();expect(f.calls.actions).toEqual([[{type:check?'check':'fold'},'one',4]]);});
 it.each(['paused','busy','exit','readonly','opponent'] as const)('pre-action is blocked while %s',mode=>{const f=fixture();f.s.game.street='flop';f.api.arm('one:flop');if(mode==='exit')f.s.active.exitMode=true;else if(mode==='readonly')f.s.status='readonly';else if(mode==='opponent')f.s.game.actor=1;else f.s[mode]=true;f.api.act();expect(f.calls.actions).toHaveLength(0);});
 it.each(['one:preflop','previous:flop'])('clears obsolete pre-action %s',key=>{const f=fixture();f.s.game.street='flop';f.api.arm(key);f.api.act();expect(f.api.armed()).toBe('');expect(f.calls.actions).toHaveLength(0);});
 it('clears pre-action after settlement',()=>{const f=fixture();f.api.arm('one:river');f.api.act();expect(f.api.armed()).toBe('');expect(f.calls.actions).toHaveLength(0);});
});
