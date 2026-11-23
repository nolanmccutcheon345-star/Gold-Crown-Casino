import {afterEach,describe,expect,it,vi} from 'vitest';
import {recoveryScheduler} from '../../src/storage/recovery-scheduler';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
function environment(){
 vi.useFakeTimers();let clock=0;vi.spyOn(performance,'now').mockImplementation(()=>clock+=9);
 vi.stubGlobal('window',{});vi.stubGlobal('document',{});vi.stubGlobal('scheduler',undefined);
}
describe('Independent recovery task queue failure isolation',()=>{
 it('resumes every concurrent waiter exactly once when a later channel post fails',async()=>{
  environment();const channels:{posts:number;closed:number}[]=[];
  class FailingSecondPost {
   state={posts:0,closed:0};port1={onmessage:null as (()=>void)|null,close:()=>{this.state.closed++;}};
   port2={close:()=>{this.state.closed++;},postMessage:()=>{if(++this.state.posts===2)throw Error('second post interrupted');setTimeout(()=>this.port1.onmessage?.(),0);}};
   constructor(){channels.push(this.state);}
  }
  vi.stubGlobal('MessageChannel',FailingSecondPost);
  const counts=[0,0,0],order:number[]=[];
  const work=counts.map((_,i)=>recoveryScheduler()()!.then(()=>{counts[i]++;order.push(i);}));
  expect(channels).toHaveLength(1);expect(counts).toEqual([0,0,0]);
  await vi.runAllTimersAsync();await Promise.all(work);
  expect(counts).toEqual([1,1,1]);expect(order).toEqual([0,1,2]);expect(channels[0]).toEqual({posts:2,closed:2});
  await vi.runAllTimersAsync();expect(counts).toEqual([1,1,1]);
 });
 it('creates an independent replacement queue after failure without losing old queued waiters',async()=>{
  environment();let created=0;const closes:number[]=[];
  class Queue {
   id=created++;posts=0;port1={onmessage:null as (()=>void)|null,close:()=>closes.push(this.id)};
   port2={close:()=>closes.push(this.id),postMessage:()=>{if(this.id===0&&++this.posts===2)throw Error('first queue failed');setTimeout(()=>this.port1.onmessage?.(),0);}};
  }
  vi.stubGlobal('MessageChannel',Queue);
  const completed:string[]=[];
  const first=recoveryScheduler()()!.then(async()=>{completed.push('first');await recoveryScheduler()();completed.push('replacement');});
  const second=recoveryScheduler()()!.then(()=>completed.push('second'));
  const third=recoveryScheduler()()!.then(()=>completed.push('third'));
  await vi.runAllTimersAsync();await Promise.all([first,second,third]);
  expect(created).toBe(2);expect([...completed].sort()).toEqual(['first','replacement','second','third'].sort());
  expect(closes.filter(id=>id===0)).toHaveLength(2);expect(closes.filter(id=>id===1)).toHaveLength(2);
 });
});
