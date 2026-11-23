import {it,expect} from 'vitest';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import type {BotObservation,PublicMemoryHand} from '../../src/contracts';
import {applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {analyzeDecision,buildOpponentMemory,chooseDecision,VERSION_FOUR_POLICY_VERSION as POLICY_VERSION} from '../../src/bots/policy';
import {makeGame,type probeBlock} from '../step4c/population';
import {rng,reconcile} from '../step4c/audit';
import {evaluate,compareRanks} from '../../src/core/evaluator';
const deck=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s));
function actualHoldingEquity(o:BotObservation,other:string[]){
 const unseen=deck.filter(c=>![...o.ownCards,...o.board,...other].includes(c));let n=0,sum=0;
 const score=(board:string[])=>{const cmp=compareRanks(evaluate([...o.ownCards,...board]),evaluate([...other,...board]));sum+=cmp>0?1:cmp===0?.5:0;n++;};
 if(o.board.length===5)score(o.board);else if(o.board.length===4)for(const c of unseen)score([...o.board,c]);else for(let a=0;a<unseen.length;a++)for(let b=a+1;b<unseen.length;b++)score([...o.board,unseen[a],unseen[b]]);
 return {equity:sum/n,runouts:n,warning:'Hindsight only: hidden opponent cards never enter the bot policy.'};
}
// Reconstruct the exact Step5A1.3 policy comparison, not a later policy revision.
it('reconstructs all thirty original oversized stronger-reg responses exactly',()=>{
 const blocks=JSON.parse(gunzipSync(readFileSync('tests/step4c/evidence/candidate-1.2-heldout-probe-blocks.json.gz')).toString()) as ReturnType<typeof probeBlock>[];
 const selected=blocks.filter(b=>b.archetype==='stronger-reg'&&b.probe==='probe-shove');expect(selected).toHaveLength(8);
 const rows=[];
 for(const block of selected){const history:PublicMemoryHand[]=[];
  for(const [hi,record] of block.hands.entries()){
   let g=makeGame(record.handId,2,record.seed,block.depth,block.block%2===1,record.button);const lastFraction:Record<string,number>={};const focus=hi%2;
   for(const event of record.events.filter(e=>e.type==='action')){
    const actor=g.actor!,p=record.profiles[actor],o=observeBot(g,actor,p.policyVersion,event.decisionId!);o.rake=g.profile.rake;o.memory=buildOpponentMemory(history,actor,p.traits?.memoryRetention??.5);
    expect(g.seats.map(s=>s.hole)).toEqual(record.initial.map(s=>s.cards));
    if(actor===focus){const actual=chooseDecision(o,p,rng(record.seed^Math.imul(actor+1,0x71e142bd)^Math.imul(g.revision+1,0x9e3779b9)));expect(actual.action).toEqual(event.action);
     if(g.street!=='preflop'&&o.legal.callAmount>0&&lastFraction[g.street]>=1.5){const analysis=analyzeDecision(o,p),opponent=g.seats.find(s=>s.id!==actor)!;
      const current=analyzeDecision({...o,policyVersion:POLICY_VERSION},{...p,policyVersion:POLICY_VERSION});expect(current.distribution).toEqual(analysis.distribution);
      rows.push({block:block.block,depth:block.depth,handId:g.handId,revision:g.revision,actual:event.action,own:o.ownCards,hiddenOpponentForAuditOnly:opponent.hole,board:o.board,pot:o.pot,legal:o.legal,wagerFraction:lastFraction[g.street],profile:p,observation:o,analysis,hindsight:actualHoldingEquity(o,opponent.hole)});
     }
    }
    if(event.action!.type==='raise'){const own=g.seats.find(s=>s.id===actor)!,legal=legalActions(g);lastFraction[g.street]=(event.action!.to-own.streetCommitted-legal.callAmount)/(g.pot+legal.callAmount);}
    g=applyCommand(g,{handId:g.handId,revision:g.revision,seatId:actor,decisionId:event.decisionId!,action:event.action!});
   }
   expect(g.events).toEqual(record.events);expect(g.seats.map(s=>s.stack)).toEqual(record.final.map(s=>s.stack));reconcile(g);
   history.push({handId:g.handId,seats:g.seats.map(s=>({id:s.id,revealedCards:g.revealedSeats.includes(s.id)?s.hole:[]})),events:g.events});
  }
 }
 expect(rows).toHaveLength(30);expect(rows.every(r=>r.actual?.type==='fold')).toBe(true);
 const brief=rows.map(r=>({hand:r.handId,street:r.observation.street,cards:r.own.join(''),board:r.board.join(''),handClass:r.analysis.features.handClass,drawClass:r.analysis.features.drawClass,price:r.analysis.postflop?.rakeAdjustedPrice,rangeEquity:r.analysis.ranges?.equity,realized:r.analysis.postflop?.realizedEquity,continue:1-r.analysis.distribution.fold,actualEquity:r.hindsight.equity,betPot:r.wagerFraction,memory:r.observation.memory?.opponents}));
 if(process.env.STEP5A_RECONSTRUCT==='1'){writeFileSync('tests/step5a-bots/evidence/original-thirty.json.gz',gzipSync(JSON.stringify(rows)));writeFileSync('tests/step5a-bots/evidence/original-thirty-summary.json',JSON.stringify(brief,null,2));console.log(JSON.stringify(brief.map(({memory:_memory,...r})=>r)));}
},120000);
