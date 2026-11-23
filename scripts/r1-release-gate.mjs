/** Explicit scope splits from unchanged acceptance titles/criteria and the
 * governing V7 directive's section9 deferred-feature override.
 * This is not an alternate requirement-status registry. It limits which rows may
 * use documented cash-clause evidence for an R1 release decision. */
export const MIXED_CASH_REQUIREMENTS=Object.freeze({
 R11:'Original title includes cash and tournament; positional cash behavior is R1, tournament mode/stage behavior is R2.',
 M05:'Original cash versus tournament statistics; cash money/BB/hours/filtering is R1, ROI/ITM/finish/fees is R2.',
 M11:'Original cross-mode ledger; cash balanced transfers are R1, tournament fees/reentries/bounties/payouts are R2.',
 X13:'Original title explicitly contrasts tournament all-in exposure with cash muck policy; cash runout/reveal/refunds are R1.',
 V407:'Original criterion explicitly adds a tournament TDA odd-chip fixture; cash individual-pot splits/odd chips are R1.',
 V409:'Original criterion separately requires a cash profile and TDA tournament reopening example; cash is R1.',
 Z14:'FUT050 explicitly defers session recording/bookmarks to R4; V7 section9 and post-R1 bookmark wording preserve that scope. Base Hero-authored cash notes, replay, privacy, accessibility and reliable flow remain mandatory.',
 Y10:'Original scenario includes churn, rebuy and mismatched stacks. V7 section9/FUT032 explicitly defers automatic player turnover; continuous six/nine-seat cash population, legal top-ups, carry-forward stack dynamics and documented synthetic composition/sizing remain mandatory.',
 V706:'V7 permanent directive section9 explicitly lists straddles as NOT R1 blockers; FUT010/FUT011 preserve variants. Current cash rake/blinds/denomination freeze/version/ledger/replay remain mandatory.',
});
export function evaluateR1Release(rows){
 const critical=rows.filter(row=>row.r1_blocking==='YES'),components=[],blockers=[];
 for(const row of critical){
  const component=row.r1_gate_basis==='EXPLICIT_MIXED_CASH_COMPONENT';
  // A recorded whole-criterion failure/blocker remains a real release concern;
  // an old component PASS cannot silently mask a newly discovered defect.
  if(row.status==='FAIL'||row.status==='BLOCKED'){blockers.push({id:row.id,status:row.status,basis:'ORIGINAL_WHOLE_CRITERION',reason:row.observed_defect||row.next_action});continue;}
  if(component){
   const verified=Object.hasOwn(MIXED_CASH_REQUIREMENTS,row.id)&&row.r1_cash_component_status==='PASS'&&!!row.r1_cash_component_evidence&&!!row.supporting_test_cases&&!!row.scope_split;
   components.push({id:row.id,originalStatus:row.status,cashComponentStatus:row.r1_cash_component_status,evidence:row.r1_cash_component_evidence,deferredScope:MIXED_CASH_REQUIREMENTS[row.id]});
   if(!verified)blockers.push({id:row.id,status:row.r1_cash_component_status||'NOT_EXECUTED',basis:row.r1_gate_basis,reason:'Explicit cash component lacks PASS and executed evidence; explicitly deferred clauses never waive required cash behavior.'});
  }else if(row.status!=='PASS')blockers.push({id:row.id,status:row.status,basis:row.r1_gate_basis,reason:row.next_action});
 }
 return {decision:blockers.length?'NOT_READY_FOR_R1':'READY_FOR_R1',criticalOriginalRows:critical.length,verifiedCashComponents:components.filter(row=>row.cashComponentStatus==='PASS').length,componentChecks:components,blockers};
}
