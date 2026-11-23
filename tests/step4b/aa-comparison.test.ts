// Historical Step4A→4B comparison stays pinned to released 1.1; current-policy premium guards remain separate.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Archetype, BotObservation, BotProfile } from '../../src/contracts';
import { analyzeDecision, chooseDecision, createProfile } from '../../src/bots/v2/policy';
import { seededRandom } from '../step4a/scenarios';
import { rate } from '../step4a/evaluation';

describe('Identical-scenario Step4A versus Step4B AA decisions',()=>{
 it('changes versioned identity only, retains exact personality parameters/observations/seeds, and classifies every sampled action',()=>{
  const frozen=JSON.parse(readFileSync(new URL('./fixtures/step4a-aa-59f950d.json',import.meta.url),'utf8')) as {rows:{archetype:Archetype;profileSeed:number;profile:BotProfile;observation:BotObservation;sampled:{counts:{raise:number;openLimp:number}}}[]};
  const rows=frozen.rows.map(row=>{
   const p=createProfile({selection:row.archetype},row.profileSeed,'neutral');expect({...p,policyVersion:row.profile.policyVersion,personalityId:row.profile.personalityId}).toEqual(row.profile);
   expect(p.personalityId?.replace('cash-v1.1:','cash-v1:')).toBe(row.profile.personalityId);
   const o={...structuredClone(row.observation),policyVersion:p.policyVersion};expect({...o,policyVersion:row.observation.policyVersion}).toEqual(row.observation);
   const counts={fold:0,check:0,openLimp:0,raise:0,allInRaise:0,allInCall:0};const sizes:Record<string,number>={};
   for(let sample=0;sample<1000;sample++){
    const a=chooseDecision(o,p,seededRandom(0x4ab123^sample)).action;
    if(a.type==='raise'){counts[a.to===o.legal.maxRaiseTo?'allInRaise':'raise']++;sizes[a.to]=(sizes[a.to]??0)+1;}
    else if(a.type==='call')counts[o.legal.callAmount===o.seats.find(s=>s.id===o.actingSeat)!.stack?'allInCall':'openLimp']++;
    else if(a.type==='fold')counts.fold++;else counts.check++;
   }
   expect(Object.values(counts).reduce((n,x)=>n+x,0)).toBe(1000);expect(counts.fold).toBe(0);expect(counts.check).toBe(0);expect(counts.allInRaise+counts.allInCall).toBe(0);
   return{archetype:row.archetype,profileSeed:row.profileSeed,oldPolicyVersion:row.profile.policyVersion,newPolicyVersion:p.policyVersion,oldPersonalityId:row.profile.personalityId,newPersonalityId:p.personalityId,parametersOtherwiseByteEqual:true,before:row.sampled.counts,after:counts,raiseSizes:sizes,
    newRaise:rate(counts.raise,1000),newLimp:rate(counts.openLimp,1000),analysis:analyzeDecision(o,p)};
  });
  if(process.env.STEP4B_EVALUATE==='1'){const dir=resolve(process.env.STEP4B_REPORT_DIR??'tests/step4b/artifacts');mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,'aa-before-after.json'),JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),baselineSource:'59f950d6f395eb623eb97b329c79fbd29fc78168',samplesPerProfile:1000,firstIn:true,position:'UTG',actingSeat:3,button:0,smallBlindSeat:1,bigBlindSeat:2,stackBB:100,commonActionSeed:0x4ab123,priorVoluntaryActions:0,rows},null,2)+'\n');}
 });
});
