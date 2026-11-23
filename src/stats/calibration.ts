/** Evidence admission is separate from game policy and money. Metadata cannot
 * certify its own truth: this release has no empirical-activation capability. */
export interface CalibrationSourceReview {
 status:'REJECTED'|'REQUIRES_INDEPENDENT_REVIEW';
 eligibleForActionFrequencyCalibration:false;empiricalLabelAllowed:false;
 missing:string[];recordedOpportunities:number;disclosure:string;
}
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0;
const count=(value:unknown):value is number=>Number.isSafeInteger(value)&&Number(value)>=0;
const strings=(value:unknown):value is string[]=>Array.isArray(value)&&value.length>0&&value.every(text)&&new Set(value).size===value.length;
const disjoint=(a:string[],b:string[])=>a.every(value=>!b.includes(value));
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const pokerActions=new Set(['fold','check','call','bet','raise','all-in']);

/** A cited paper or aggregate win-rate sample is not an eligible action-level
 * source. This reviews documentary completeness only; it never loads a dataset,
 * licenses it, validates consent, fits a policy, or upgrades a public label. */
export function reviewCalibrationSource(input:unknown):CalibrationSourceReview {
 const source=record(input)?input:{},missing:string[]=[];
 if(source.kind!=='human-action-opportunities')missing.push('An action-level human-opportunity source is required; performance research and synthetic samples cannot substitute.');
 const records=Array.isArray(source.actionRecords)?source.actionRecords:[],ids=new Set<string>();
 let validRecords=records.length>0;
 for(const row of records){
  if(!record(row)||!text(row.id)||ids.has(row.id)||!text(row.playerId)||!text(row.sessionId)||!text(row.venueId)||!text(row.stratum)||!['preflop','flop','turn','river'].includes(String(row.street))||!strings(row.legalActions)||!row.legalActions.every(action=>pokerActions.has(action))||!text(row.action)||!row.legalActions.includes(row.action))validRecords=false;
  if(record(row)&&text(row.id))ids.add(row.id);
 }
 if(!validRecords||!count(source.opportunityCount)||source.opportunityCount!==records.length)missing.push('Unique eligible action records, legal opportunity denominators and matching counts are required.');
 const provenance=record(source.provenance)?source.provenance:{};
 if(!text(provenance.citation)||!text(provenance.collectionMethod)||!text(provenance.collectedAt)||!Number.isFinite(Date.parse(String(provenance.collectedAt)))||typeof provenance.contentHash!=='string'||!/^[0-9a-f]{64}$/.test(provenance.contentHash))missing.push('Recorded collection provenance and source content hash are required.');
 const rights=record(source.rights)?source.rights:{};
 if(!text(rights.license)||rights.actionModelingPermitted!==true||!text(rights.consentOrLawfulBasis)||!text(rights.evidenceReference))missing.push('Documented action-modeling license/permission and consent or lawful-basis evidence are required.');
 const population=record(source.population)?source.population:{};
 if(!text(population.observed)||!text(population.target)||population.observed!==population.target||!text(population.matchEvidence))missing.push('Explicit observed/target population match evidence is required.');
 const strata=Array.isArray(source.stratification)?source.stratification:[],stratumIds=new Set<string>();let eligible=0,validStrata=strata.length>0;
 for(const stratum of strata){
  if(!record(stratum)||!text(stratum.id)||stratumIds.has(stratum.id)||!text(stratum.street)||!text(stratum.betSize)||!text(stratum.board)||!text(stratum.stake)||!count(stratum.opportunities)||stratum.opportunities===0)validStrata=false;
  if(record(stratum)&&text(stratum.id)){stratumIds.add(stratum.id);if(count(stratum.opportunities))eligible+=stratum.opportunities;const members=records.filter(row=>record(row)&&row.stratum===stratum.id);if(members.length!==stratum.opportunities||members.some(row=>row.street!==stratum.street))validStrata=false;}
 }
 if(!validStrata||eligible!==records.length||records.some(row=>!record(row)||!stratumIds.has(String(row.stratum))))missing.push('Opportunity-level street, bet-size, board and stake stratification with reconciled counts is required.');
 const holdout=record(source.holdout)?source.holdout:{};
 let validHoldout=text(holdout.protocolReference)&&holdout.independent===true;
 for(const key of ['players','sessions','venues'] as const){
  const train=record(holdout.train)?holdout.train[key]:undefined,test=record(holdout.test)?holdout.test[key]:undefined;
  if(!strings(train)||!strings(test)||!disjoint(train,test))validHoldout=false;
 }
 if(!validHoldout)missing.push('A documented independent player/session/venue-disjoint holdout is required.');
 const metrics=record(source.metrics)?source.metrics:{};
 if(!text(metrics.protocolReference)||!count(metrics.holdoutOpportunities)||metrics.holdoutOpportunities===0||!finite(metrics.predictiveLoss)||metrics.predictiveLoss<0||!finite(metrics.baselineLoss)||metrics.baselineLoss<0||!text(metrics.uncertainty)||!text(metrics.resultReference))missing.push('Recorded held-out predictive metrics, simple baseline, opportunity count and uncertainty are required.');
 return {status:missing.length?'REJECTED':'REQUIRES_INDEPENDENT_REVIEW',eligibleForActionFrequencyCalibration:false,empiricalLabelAllowed:false,missing,recordedOpportunities:validRecords?records.length:0,
  disclosure:'Documentary checks do not verify authenticity, rights, consent, population equivalence or empirical fit. No independently approved human calibration pipeline is enabled; even complete metadata cannot activate an empirical, expert, solver or profitability label.'};
}

export interface SyntheticModelCheck {
 reference:string;observedProbability:number;expectedProbability:number;maximumAbsoluteDeviation:number;
}
export interface SyntheticCalibrationStatus {
 status:'INSUFFICIENT_DATA'|'DESCRIPTIVE_SYNTHETIC'|'SYNTHETIC_MODEL_MATCHED'|'SYNTHETIC_MODEL_MISMATCH';
 source:'SYNTHETIC';opportunities:number;humanCalibrated:false;expertReviewed:false;solverVerified:false;
 comparison:SyntheticModelCheck|null;disclosure:string;
}
/** Used by executable evidence reports. A synthetic model agreement means only
 * the reported engineering comparison passed; sample size never grants realism. */
export function syntheticCalibrationStatus(opportunities:number,minimumN=100,comparison?:SyntheticModelCheck):SyntheticCalibrationStatus {
 if(!count(opportunities)||!count(minimumN)||minimumN<10)throw Error('Calibration sample counts must be safe nonnegative integers; minimum N is at least 10.');
 if(comparison&&(!text(comparison.reference)||![comparison.observedProbability,comparison.expectedProbability,comparison.maximumAbsoluteDeviation].every(value=>finite(value)&&value>=0&&value<=1)))throw Error('Synthetic comparison requires a named reference and finite probabilities/tolerance in [0,1].');
 const status=opportunities<minimumN?'INSUFFICIENT_DATA':!comparison?'DESCRIPTIVE_SYNTHETIC':Math.abs(comparison.observedProbability-comparison.expectedProbability)<=comparison.maximumAbsoluteDeviation?'SYNTHETIC_MODEL_MATCHED':'SYNTHETIC_MODEL_MISMATCH';
 return {status,source:'SYNTHETIC',opportunities,humanCalibrated:false,expertReviewed:false,solverVerified:false,comparison:comparison?{...comparison}:null,
  disclosure:'Synthetic samples may match only the explicitly named synthetic model/check. This is not measured human resemblance, expert review, solver validation or evidence of real-world earnings.'};
}

/** The current application cannot mint empirical labels from user claims,
 * synthetic counts or documentation. Future activation needs a separate reviewed
 * capability; there is deliberately no persisted boolean to bypass this gate. */
export function requireEmpiricalCalibration(source:unknown):never {
 const review=reviewCalibrationSource(source);
 throw Error(review.missing.length?`Empirical calibration rejected: ${review.missing.join(' ')}`:'Empirical calibration is not enabled. Documentary completeness requires independent review and cannot authorize a label.');
}
