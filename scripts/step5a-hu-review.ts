import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {startHand,applyCommand,observeBot} from '../src/core/engine';
import {analyzePreflop} from '../src/bots/preflop';
import {buildOpponentMemory} from '../src/bots/policy';
import {rig} from '../tests/verification/helpers';
import type {PublicMemoryHand} from '../src/contracts';
import type {sessionBlock} from '../tests/step5a-release/population';
const base='tests/step5a-release/evidence/candidate-1.3';
const blocks=JSON.parse(gunzipSync(readFileSync(`${base}/sessions.json.gz`)).toString()) as ReturnType<typeof sessionBlock>[];
const rows:unknown[]=[];const targeted=new Set(['5a:heads-up:6:20','5a:heads-up:7:2','5a:heads-up:7:16']);
const counters:Record<string,{buttonHands:number;opens:number;buttonFolds:number;responses:Record<string,number>}>={};
for(const b of blocks.filter(b=>b.configuration==='heads-up')){
 const memory:PublicMemoryHand[]=[];
 for(const h of b.hands){
  const actions=h.events.filter(e=>e.type==='action'&&e.street==='preflop'),first=actions[0],style=b.profiles[h.button].archetype;
  counters[style]??={buttonHands:0,opens:0,buttonFolds:0,responses:{}};const c=counters[style];c.buttonHands++;if(first.action!.type==='fold')c.buttonFolds++;
  if(first.action!.type==='raise'){c.opens++;const response=actions[1].action!.type;c.responses[response]=(c.responses[response]??0)+1;}
  if(targeted.has(h.handId)){
   const holes=h.initial.map(s=>s.cards),reserved=[...holes.flat(),...h.board],fill=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(c=>!reserved.includes(c));
   // Only public preflop nodes are examined. Padding the unused test runout is
   // inaccessible to observeBot and never used to infer postflop behavior.
   let g=rig(startHand({handId:h.handId,button:h.button,profile:h.profile,seats:h.initial.map(s=>({id:s.id,name:`Stable ${s.id}`,stack:s.stack}))}),holes,[...h.board,...fill].slice(0,5));
   for(const e of actions){const p=b.profiles[g.actor!],o=observeBot(g,g.actor!,p.policyVersion,e.decisionId!);o.rake=g.profile.rake;o.memory=buildOpponentMemory(memory,g.actor!,p.traits?.memoryRetention??.5);
    if(e.action!.type==='fold')rows.push({handId:h.handId,actor:g.actor,profile:p,observation:o,analysis:analyzePreflop(o,p),actualAction:e.action,sequence:actions});
    g=applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:e.decisionId!,action:e.action!});
   }
  }
  memory.push({handId:h.handId,events:h.events,seats:h.initial.map(s=>({id:s.id,revealedCards:h.final.find(f=>f.id===s.id)!.revealed?s.cards:[]}))});
 }
}
writeFileSync('tests/step5a-release/evidence/heads-up-review.json',JSON.stringify({source:`${base}/sessions.json.gz`,counters,diagnosticRows:rows,warning:'Counts are observed actions. Analysis distributions are authored model diagnostics, not human calibration or independent strategic truth. Isolated folds alone do not establish a policy defect.'},null,2));
process.stdout.write(JSON.stringify({counters,diagnostics:rows.map(x=>{const r=x as {handId:string;analysis:ReturnType<typeof analyzePreflop>};return{handId:r.handId,analysis:r.analysis};})},null,2));
