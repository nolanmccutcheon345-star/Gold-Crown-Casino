import type {AppData} from '../../src/session/types';
/** Isolated QA only: public room rules and policy version strings, no hole cards,
 * personality parameters, deck, private observation or decision diagnostics. */
export function appliedProvenance(data:AppData|null,checkIdentity:string,inputDescriptor:string,kind:'applied-successful-state'|'retained-input-only'='applied-successful-state'){
 const policies=(profiles:Record<number,{policyVersion:string}>|undefined)=>[...new Set(Object.values(profiles??{}).map(profile=>profile.policyVersion))];
 const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
 return{format:'step5e-per-check-applied-provenance',version:1,checkIdentity,inputDescriptor,kind,observedAt:new Date().toISOString(),noSecretCardsOrTraits:true,active:data?.active?{handId:data.active.game.handId,sessionId:data.active.sessionId,revision:data.active.game.revision,ruleProfile:copy(data.active.game.profile),policyVersions:policies(data.active.profiles)}:null,sessions:(data?.sessions??[]).map(session=>({sessionId:session.id,ruleProfile:copy(session.profile)})),hands:(data?.hands??[]).map(hand=>({handId:hand.id,sessionId:hand.sessionId,canonicalHash:hand.hash,ruleProfile:copy(hand.view.profile),policyVersions:policies(hand.privateProfiles)})),noAppliedRoomState:data===null};
}
