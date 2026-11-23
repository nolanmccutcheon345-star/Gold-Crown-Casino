import {it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {startHand,applyCommand} from '../../src/core/engine';
import {createProfile} from '../../src/bots/policy';
import {practiceProfile,rig} from '../verification/helpers';
import {STYLES,rng} from './audit';
import {runHand} from './population';
it('completes real policy actions with short-stack main-pot and deeper side-pot eligibility',()=>{
 const all=[],full=process.env.STEP4C_SIDEPOTS==='1';for(const [ai,style]of STYLES.entries())for(let trial=0;trial<(full?12:1);trial++){
  const seed=0x4ce80000+ai*100+trial,own=['Ac','Ad'],board=['Ah','7h','2c','9s','Kd'],rest=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(c=>![...own,...board].includes(c)),random=rng(seed);for(let i=rest.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[rest[i],rest[j]]=[rest[j],rest[i]];}
  let g=rig(startHand({handId:`sidepot4c:${style}:${trial}`,button:0,seats:[8600,35000,19000].map((stack,id)=>({id,name:`Player${id}`,stack})),profile:practiceProfile()}),[own,rest.slice(0,2),rest.slice(2,4)],board);
  const prefix=[{type:'call'},{type:'call'},{type:'check'},{type:'raise',to:12000},{type:'call'}] as const;for(const action of prefix)g=applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:`prefix:${g.revision}`,action});
  const profiles=g.seats.map((_,i)=>createProfile({selection:i===0?style:STYLES[(ai+i+3)%8]},seed+i,'neutral')),result=runHand(g,profiles,seed,[]);expect(result.game.street).toBe('complete');expect(result.game.pots.length).toBeGreaterThanOrEqual(2);expect(result.game.seats[0].folded).toBe(false);expect(result.record.money.total).toBe(62600);all.push({archetype:style,seed,record:result.record});
 }
 if(full){const dir=resolve(process.env.STEP4C_REPORT_DIR??'tests/step4c/evidence');mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,'candidate-1.2-sidepots.json.gz'),gzipSync(JSON.stringify({classification:'Additional coverage follow-up after initial random populations produced no side-pots; no policy tuning. Preflop/flop prefix scripted; all subsequent actions from policy. Not a fresh blind holdout.',completedHands:all.length,examples:all})));console.log(JSON.stringify({completedSidePotHands:all.length}));}
},120000);
