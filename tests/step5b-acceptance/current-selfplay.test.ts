import {it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import type {PublicMemoryHand} from '../../src/contracts';
import {createProfile} from '../../src/bots/policy';
import {makeGame,runHand} from '../step4c/population';
it('checks current strong-profile self-play and exact per-hand independent chip accounting',()=>{
 const profile=createProfile({selection:'stronger-reg'},0x5b77cd,'neutral'),profiles=[profile,structuredClone(profile)],rows=[];
 for(let block=0;block<8;block++){const history:PublicMemoryHand[]=[];for(let h=0;h<12;h++){const seed=0x5b7f0000+block*100+h,g=makeGame(`selfplay:${block}:${h}`,2,seed,[25,100,200,300][block%4],block%2===1,h%2),r=runHand(g,profiles,seed,history);expect(r.game.street).toBe('complete');expect(r.record.final.reduce((n,s)=>n+s.stack,0)+r.record.money.rake).toBe(r.record.money.total);rows.push({block,...r.record});history.push({handId:r.game.handId,seats:r.game.seats.map(s=>({id:s.id,revealedCards:r.game.revealedSeats.includes(s.id)?s.hole:[]})),events:r.game.events});}}
 const dir=resolve(process.env.STEP5B_ACCEPTANCE_EVIDENCE_DIR??'tests/step5b-acceptance/evidence/runtime');mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,'current-selfplay.json'),JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,at:new Date().toISOString(),policy:profile.policyVersion,completedHands:rows.length,actions:rows.reduce((n,r)=>n+r.money.actions,0),rows,limitation:'Finite synthetic self-play accounting check across25/100/200/300BB, not proof of equilibrium or absence of every strategic exploit.'},null,2));expect(rows).toHaveLength(96);
},120000);
