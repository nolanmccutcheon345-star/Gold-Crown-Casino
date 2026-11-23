import {syntheticCalibrationStatus,type SyntheticCalibrationStatus} from './calibration';
/** Conditional Monte Carlo reporting only. This module cannot grant a human-data
 * calibration label, model-match claim, strategic endorsement or real-win claim. */
export interface ConditionalResponseEvidence {
 evidenceClass:'SYNTHETIC_FUNCTIONAL';status:'INSUFFICIENT_DATA'|'DESCRIPTIVE_SYNTHETIC';
 numerator:number;denominator:number;minimumN:number;observedPercent:number|null;
 ci95Percent:[number,number]|null;humanCalibrated:false;uncertainty:string;
 calibration:SyntheticCalibrationStatus;
}
export function summarizeConditionalResponse(numerator:number,denominator:number,minimumN=100):ConditionalResponseEvidence {
 if(!Number.isSafeInteger(numerator)||!Number.isSafeInteger(denominator)||numerator<0||denominator<0||numerator>denominator)throw Error('Conditional counts must be nonnegative integers with numerator no greater than denominator');
 // V705: fewer than ten eligible nodes can never earn a measured frequency or
 // calibration result, even if a caller tries to relax the reporting threshold.
 if(!Number.isSafeInteger(minimumN)||minimumN<10)throw Error('Conditional minimum sample must be an integer of at least 10');
 let ci95Percent:[number,number]|null=null;
 if(denominator>0){
  const p=numerator/denominator,z=1.959963984540054,d=1+z*z/denominator,mid=(p+z*z/(2*denominator))/d;
  const radius=z*Math.sqrt((p*(1-p)+z*z/(4*denominator))/denominator)/d;
  ci95Percent=[100*Math.max(0,mid-radius),100*Math.min(1,mid+radius)];
 }
 const insufficient=denominator<minimumN;
 return {evidenceClass:'SYNTHETIC_FUNCTIONAL',status:insufficient?'INSUFFICIENT_DATA':'DESCRIPTIVE_SYNTHETIC',numerator,denominator,minimumN,
  observedPercent:insufficient?null:100*numerator/denominator,ci95Percent,humanCalibrated:false,calibration:syntheticCalibrationStatus(denominator,minimumN),
  uncertainty:`Conditional 95% Wilson sampling interval; ${denominator} eligible opportunities. Fewer than ${minimumN} opportunities are insufficient, and an absent/insufficient rate is not 0%. Repeated seeds, shared scenarios and correlated decisions limit independence. These synthetic samples do not quantify human-population, strategy-model or real-world profitability uncertainty; sample size alone never establishes calibration.`,
 };
}
