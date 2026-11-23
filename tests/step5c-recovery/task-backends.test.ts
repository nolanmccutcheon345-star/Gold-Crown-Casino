import {afterEach,describe,it,expect,vi} from 'vitest';
import {recoveryScheduler} from '../../src/storage/recovery-scheduler';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
function browser(){vi.useFakeTimers();let tick=0;vi.spyOn(performance,'now').mockImplementation(()=>tick+=9);vi.stubGlobal('window',{});vi.stubGlobal('document',{});vi.stubGlobal('scheduler',undefined);vi.stubGlobal('MessageChannel',undefined);}
class ChannelReference {
 static created:ChannelReference[]=[];
 port1={onmessage:null as (()=>void)|null,close:vi.fn()};
 port2={postMessage:vi.fn(()=>{setTimeout(()=>this.port1.onmessage?.(),0);}),close:vi.fn()};
 constructor(){ChannelReference.created.push(this);}
}
describe('Step5C measured ordinary task backends',()=>{
 it('prefers a new background task and never calls boosted scheduler.yield',async()=>{
  browser();const prioritized=vi.fn(),postTask=vi.fn(async(work:()=>void)=>{work();});vi.stubGlobal('scheduler',{postTask,yield:prioritized});await recoveryScheduler()();expect(postTask).toHaveBeenCalledWith(expect.any(Function),{priority:'background'});expect(prioritized).not.toHaveBeenCalled();
 });
 it('does not resume verification before a pending background task completes',async()=>{
  browser();let release!:()=>void,completed=false;vi.stubGlobal('scheduler',{postTask:()=>new Promise<void>(resolve=>{release=resolve;})});const pending=recoveryScheduler()()!.then(()=>{completed=true;});await Promise.resolve();expect(completed).toBe(false);release();await pending;expect(completed).toBe(true);
 });
 it.each(['throws','rejects'])('falls back safely when background scheduling %s',async mode=>{
  browser();vi.stubGlobal('scheduler',{postTask:()=>{if(mode==='throws')throw Error('unavailable');return Promise.reject(Error('unavailable'));}});let completed=false;const pending=recoveryScheduler()()!.then(()=>{completed=true;});expect(completed).toBe(false);await vi.runAllTimersAsync();await pending;expect(completed).toBe(true);
 });
 it('shares one channel across concurrent yields, then closes both idle ports',async()=>{
  browser();ChannelReference.created=[];vi.stubGlobal('MessageChannel',ChannelReference);const first=recoveryScheduler()()!,second=recoveryScheduler()()!;expect(ChannelReference.created).toHaveLength(1);await vi.runAllTimersAsync();await Promise.all([first,second]);const channel=ChannelReference.created[0];expect(channel.port1.close).toHaveBeenCalledTimes(1);expect(channel.port2.close).toHaveBeenCalledTimes(1);
 });
 it('falls back to an ordinary timer if channel construction fails',async()=>{
  browser();vi.stubGlobal('MessageChannel',class {constructor(){throw Error('disabled');}});const pending=recoveryScheduler()()!;await vi.runAllTimersAsync();await pending;
 });
 it('releases waiting work through a timer and closes ports if posting fails',async()=>{
  browser();let closed=0;vi.stubGlobal('MessageChannel',class {port1={onmessage:null,close:()=>closed++};port2={postMessage:()=>{throw Error('closed');},close:()=>closed++};});let completed=false;const pending=recoveryScheduler()()!.then(()=>{completed=true;});expect(completed).toBe(false);await vi.runAllTimersAsync();await pending;expect(completed).toBe(true);expect(closed).toBe(2);
 });
 it('retains the eight millisecond work budget and creates no tasks in Node',()=>{
  browser();vi.spyOn(performance,'now').mockReturnValue(0);const postTask=vi.fn(async()=>{});vi.stubGlobal('scheduler',{postTask});expect(recoveryScheduler()()).toBeUndefined();vi.stubGlobal('window',undefined);vi.spyOn(performance,'now').mockImplementationOnce(()=>0).mockImplementation(()=>100);expect(recoveryScheduler()()).toBeUndefined();expect(postTask).not.toHaveBeenCalled();
 });
});
