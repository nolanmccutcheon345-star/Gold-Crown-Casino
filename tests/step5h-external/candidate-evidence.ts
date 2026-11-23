/** Test/report boundary only. Matching metadata cannot prove a human/device test ran. */
import {validateCandidate,type CandidateRecord} from '../step5f-external/contracts';
export interface CandidateBinding {sourceCommit:string;buildId:string;bundleSHA256:string;origin:string;verifiedPackage:boolean}
export function reviewCandidateIdentity(observed:CandidateRecord,expected:CandidateBinding){
 const errors=validateCandidate(observed);
 if(!expected.verifiedPackage)errors.push('Expected package has not been verified.');
 if(!/^[a-f0-9]{40}$/.test(expected.sourceCommit)||!/^[a-f0-9]{64}$/.test(expected.bundleSHA256)||!expected.buildId.trim())errors.push('Expected exact source and asset identity is missing.');
 if(observed.sourceCommit!==expected.sourceCommit)errors.push('Observation is for another source commit.');
 if(observed.buildId!==expected.buildId||observed.bundleSHA256!==expected.bundleSHA256)errors.push('Observation is for another compiled candidate.');
 let wanted:URL|null=null,actual:URL|null=null;
 try{wanted=new URL(expected.origin);actual=new URL(observed.url);}catch{errors.push('Candidate origin is invalid.');}
 if(wanted&&(wanted.protocol!=='https:'||wanted.origin!==expected.origin))errors.push('Expected origin must be an exact HTTPS origin.');
 if(actual&&wanted&&actual.origin!==wanted.origin)errors.push('Observation came from another Site origin.');
 const preserved=new Set(['https://ai-texas-hold-em.stevemccutcheon89.chatgpt.site','https://ai-texas-hold-em-v12-test.stevemccutcheon89.chatgpt.site']);
 if(wanted&&preserved.has(wanted.origin))errors.push('The public Version7 and existing Version12 test Sites are preserved, not this new candidate.');
 return{status:errors.length?'REJECTED':'IDENTITY_MATCH_REQUIRES_OBSERVATION_REVIEW',errors,physicalDeviceVerified:false,screenReaderVerified:false,newUserStudyVerified:false};
}
