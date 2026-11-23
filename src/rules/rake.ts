import type {RuleProfile} from '../contracts';

/** Additive fields leave every persisted practice profile's floor rounding intact. */
export type VersionedRake = RuleProfile['rake'] & {
 rounding?:'floor'|'half-even';
 capByDealtIn?:{two:number;threeFour:number;fivePlus:number};
 dealtIn?:number;
 source?:{url:string;retrievedAt:string;currency:'USD';format:'regular-nlhe'};
};

const validInteger=(n:number)=>Number.isSafeInteger(n)&&n>=0;
export function validateRake(rake:VersionedRake):void {
 if(!rake||!validInteger(rake.basisPoints)||rake.basisPoints>10000||!validInteger(rake.cap)||typeof rake.noFlopNoDrop!=='boolean') throw new Error('Invalid rake');
 if(rake.rounding!==undefined&&rake.rounding!=='floor'&&rake.rounding!=='half-even')throw new Error('Unsupported rake rounding');
 if(rake.capByDealtIn&&!['two','threeFour','fivePlus'].every(key=>validInteger(rake.capByDealtIn![key as keyof NonNullable<VersionedRake['capByDealtIn']>])))throw new Error('Invalid dealt-in rake caps');
 if(rake.dealtIn!==undefined&&(!Number.isInteger(rake.dealtIn)||rake.dealtIn<2||rake.dealtIn>10))throw new Error('Invalid rake dealt-in count');
}

/** Resolve at deal time. Folded/all-in players still count; empty seats never do. */
export function resolveRake(rake:VersionedRake,dealtIn:number):VersionedRake {
 validateRake(rake);
 if(!Number.isInteger(dealtIn)||dealtIn<2||dealtIn>10)throw new Error('Invalid rake dealt-in count');
 const copy=structuredClone(rake);
 if(copy.capByDealtIn){
  copy.cap=dealtIn===2?copy.capByDealtIn.two:dealtIn<=4?copy.capByDealtIn.threeFour:copy.capByDealtIn.fivePlus;
  copy.dealtIn=dealtIn;
 }
 return copy;
}

/** Matched chips only; refund unmatched excess before calling. One cap per hand. */
export function calculateRake(contestedPot:number,boardLength:number,rake:VersionedRake,chipUnit=1):number {
 validateRake(rake);
 if(!validInteger(chipUnit)||chipUnit===0)throw new Error('Invalid chip denomination');
 if(!validInteger(contestedPot)||contestedPot%chipUnit!==0||rake.cap%chipUnit!==0)throw new Error('Invalid rake pot or denomination');
 if(rake.noFlopNoDrop&&boardLength<3)return 0;
 const product=BigInt(contestedPot)*BigInt(rake.basisPoints),unit=10000n*BigInt(chipUnit);
 let rounded=product/unit;
 if(rake.rounding==='half-even'){
  const remainder=product%unit;
  if(remainder*2n>unit||(remainder*2n===unit&&rounded%2n===1n))rounded+=1n;
 }
 const cents=rounded*BigInt(chipUnit);
 return Number(cents>BigInt(rake.cap)?BigInt(rake.cap):cents);
}
