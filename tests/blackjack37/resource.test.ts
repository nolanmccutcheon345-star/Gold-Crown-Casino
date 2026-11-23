import {expect,it,vi} from 'vitest';
import {writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import * as engine from '../../src/blackjack/engine';
import {BlackjackController} from '../../src/blackjack/controller';
import {MemoryBlackjackPersistence} from '../../src/blackjack/persistence';
import {auditSnapshot} from '../../src/blackjack/runtime';
function samples(values:number[]){const a=[...values].sort((x,y)=>x-y),q=(v:number)=>a[Math.min(a.length-1,Math.floor((a.length-1)*v))];return{n:a.length,p50:q(.5),p95:q(.95),p99:q(.99),max:a.at(-1)};}
it('completes 1000 seeded rounds with bounded hot state and independent archive financial agreement',async()=>{
 let seed=0x370011;const next=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};const mock=vi.spyOn(engine,'secureBlackjackShoe').mockImplementation(decks=>{const shoe=engine.orderedBlackjackShoe(decks);for(let i=shoe.length-1;i>0;i--){const j=Math.floor(next()*(i+1));[shoe[i],shoe[j]]=[shoe[j],shoe[i]];}return shoe;});
 const port=new MemoryBlackjackPersistence(),c=new BlackjackController(port),blocks:unknown[]=[],costs:number[]=[];let maxActiveCommands=0,maxHotBytes=0,finished=0;await c.init();await c.sit('home-1',0);
 try{for(let round=1;round<=1000;round++){let start=performance.now();await c.deal(100,c.data!.revision);costs.push(performance.now()-start);expect(c.error).toBe('');while(c.publicState!.round!.phase!=='settled'){start=performance.now();await c.act(c.publicState!.round!.phase==='insurance'?'decline-insurance':c.publicState!.round!.hands[c.publicState!.round!.actor].total<17?'hit':'stand',c.data!.revision);costs.push(performance.now()-start);expect(c.error).toBe('');}finished++;maxActiveCommands=Math.max(maxActiveCommands,c.data!.active!.engine.commands.length);maxHotBytes=Math.max(maxHotBytes,port.sizes().checkpoint);
 if([100,500,1000].includes(round)){blocks.push({round,costsMs:samples(costs.splice(0)),...port.sizes(),archiveRecords:port.records.size,activeRounds:c.data!.active!.engine.completed.length});}}
 const before=performance.now(),snapshot=(await port.snapshot())!,full=auditSnapshot(snapshot),auditMs=performance.now()-before;
 const ledger=200000+snapshot.records.reduce((n,r)=>n+(r.body.kind==='segment'?r.body.engine.ledger.reduce((sum,e)=>sum+e.amount,0):r.body.after-r.body.before),0)+full.active!.engine.ledger.reduce((sum,e)=>sum+e.amount,0);
 expect(finished).toBe(1000);expect(c.session.rounds).toBe(1000);expect(ledger).toBe(c.data!.balance);expect(full.balance).toBe(c.data!.balance);expect(maxActiveCommands).toBeLessThan(160);expect(maxHotBytes).toBeLessThan(80000);expect(port.records.size).toBeGreaterThan(30);
 if(process.env.BLACKJACK37_EVIDENCE_DIR){mkdirSync(process.env.BLACKJACK37_EVIDENCE_DIR,{recursive:true});writeFileSync(process.env.BLACKJACK37_EVIDENCE_DIR+'/resource.json',JSON.stringify({fixture:'1000 rounds; seed0x370011; home-1 $1 no ante; hit below17,stand17+; split/double rules tested separately',environment:'Node Vitest serial Linux; actual indexedDB/browser not measured here',finished,blocks,maxActiveCommands,maxHotBytes,auditMs,ledgerBalance:ledger,controllerBalance:c.data!.balance,financialAgreement:true},null,2));}
 }finally{mock.mockRestore();}
});
