/** A qualified matrix consists of actual browser rows, never authored cases. */
import {sha} from './step5d-ci-plan.mjs';
import {verifyStep5ESizing} from './step5e-qualify-sizing.mjs';
const key=c=>[c.kind,c.seats,c.width,c.height,c.smallBlind??'',c.bigBlind??'',c.buyIn??'',c.street??''].join(':');
export function verifyStep5EGateMatrix(entry,receipt,options){
 const {read,exists}=options,errors=[],fail=message=>errors.push(message);let raw;
 if(entry.format!=='ai-texas-step5e-native-gate-matrix'||entry.version!==1||!entry.id)fail('Unsupported actual browser gate matrix');
 if(!entry.capture?.path||!entry.capture.sha256||!exists(entry.capture.path)||sha(read(entry.capture.path))!==entry.capture.sha256)fail('Gate matrix capture absent or changed');
 else try{raw=JSON.parse(read(entry.capture.path));}catch{fail('Invalid gate matrix JSON');}
 const rows=raw?.results??[],mixed=rows.findIndex(row=>row.case?.kind==='mixed-granularity');
 const validated=verifyStep5ESizing({...entry,format:'ai-texas-step5e-native-sizing',resultIndex:mixed},receipt,options);errors.push(...validated.errors);
 if(raw?.format!=='step5e-native-gate-matrix'||raw.version!==1||raw.status!=='PASS'||raw.mode!=='all'||raw.planned!==66||raw.completed!==66||raw.passed!==66||raw.failed!==0||raw.actualUIPlayedHands!==0||raw.productionDatabaseAccessed!==false||raw.sourcePinned!==true||rows.length!==66||!raw.executedAt||!raw.browser)fail('Full actual66-case gate matrix did not pass');
 const wanted=[];
 for(const seats of [2,3,6,9,10])for(const width of [320,375,390,430,768,1280])wanted.push({kind:'layout-preflop',seats,width,height:width===768?1024:width===1280?900:844});
 for(const seats of [6,9,10])wanted.push({kind:'layout-preflop',seats,width:844,height:390});
 for(const kind of ['facing-raise','side-pot','short-jam','raise-closed'])for(const width of [320,360,430,1280])wanted.push({kind,seats:kind==='short-jam'||kind==='raise-closed'?3:10,width,height:width===1280?900:844});
 for(const [smallBlind,bigBlind,buyIn]of [[100,300,45000],[200,500,75000],[5000,10000,1500000],[300,700,35000]])for(const street of ['preflop','flop'])for(const width of [390,1280])wanted.push({kind:'stake',seats:6,width,height:width===1280?900:844,smallBlind,bigBlind,buyIn,street});
 wanted.push({kind:'mixed-granularity',seats:3,smallBlind:100,bigBlind:300,buyIn:30000,width:360,height:844});
 if(JSON.stringify(rows.map(row=>key(row.case??{})))!==JSON.stringify(wanted.map(key)))fail('Exact required viewport/stake/action cases are missing or reordered');
 const proof=entry.proof?.path&&exists(entry.proof.path)?JSON.parse(read(entry.proof.path)):null;
 for(const row of rows){
  const c=row.case??{},a=row.actionValues??{};
  if(row.status!=='PASS'||row.error||row.actualUIPlayedHands!==0||row.nonTraining!==true||JSON.stringify(row.candidateSource)!==JSON.stringify(proof)||row.viewport?.width!==c.width||row.viewport?.height!==c.height||!row.executedAt||!row.browser)fail('Gate row status/source/actual viewport missing');
  if(row.tableGeometry?.seats?.length!==c.seats||row.tableGeometry.horizontalOverflow!==false)fail('Occupied perimeter layout geometry missing');
  if(a.labelsMatchEngine!==true||a.call!==row.legal?.callAmount||a.check!==row.legal?.check||a.minimum!==(row.legal?.shortAllInTo??row.legal?.minRaiseTo??0)||a.maximum!==(row.legal?.maxRaiseTo??row.legal?.shortAllInTo??0)||a.remainingStack!==row.heroStack||a.additional!==Math.max(0,a.raiseTo-a.previousStreetContribution))fail('Displayed action money does not match authoritative legal inputs');
  if(!Array.isArray(row.controls)||row.controls.length!==8||row.controls.some(box=>box.width<=0||box.height<=0||box.x< -1||box.right>c.width+1))fail('Gate action-control geometry incomplete');
  if(c.kind==='short-jam'&&(row.shortAllIn?.actionsCommitted!==1||row.shortAllIn.heroStack!==0||row.shortAllIn.heroCommitted!==700||row.shortAllIn.confirmationClicks!==2||row.shortAllIn.staleDetachedClick!==1||row.shortAllIn.selectedWithoutCommit!==true||row.shortAllIn.engineAccounting!==true))fail('Incomplete all-in/duplicate-confirmation scenario not proved');
  if(c.kind==='raise-closed'&&(row.raiseClosed?.call!==100||row.raiseClosed.allRaiseControlsDisabled!==true||row.raiseClosed.foldAndCallAvailable!==true))fail('Closed raise actions not proved');
  if(c.kind==='side-pot'&&!(row.tableGeometry.sidePots>=1))fail('Side-pot display not proved');
  if(c.kind==='facing-raise'||c.kind==='mixed-granularity'){
   const sizing=row.potSizing,basis=row.pot+row.legal.callAmount,prior=sizing?.priorStreetContribution,unit=sizing?.chipUnit,to=percent=>prior+row.legal.callAmount+Math.round(basis*percent/100/unit)*unit;
   const expected=[...[25,33,50,75,100,150,200].map(percent=>[`${percent}%`,to(percent)]),['custom50',to(50)],['numeric50',to(50)],['editedBB',to(50)],['editedIncrement1BB',to(50)+sizing?.bigBlind],['custom1000',to(1000)],['minimum',a.minimum],['maximum',a.maximum],['slider100',to(100)]];
   if(!sizing||sizing.authoritativeRevisionUnchanged!==true||sizing.pot!==row.pot||sizing.callAmount!==row.legal.callAmount||sizing.potAfterCall!==basis||sizing.checks?.length!==15||expected.some(([control,amount],index)=>{const check=sizing.checks[index];return check.control!==control||check.to!==amount||check.additional!==Math.max(0,amount-prior)||check.legal!==(amount>=a.minimum&&amount<=a.maximum&&amount%unit===0);}))fail('All seven percentages and edited shortcuts not independently proved');
  }
  if(c.kind==='stake'){const s=row.stakes;if(!s||s.smallBlind!==c.smallBlind||s.bigBlind!==c.bigBlind||s.startingStack!==c.buyIn||s.startingBB!==c.buyIn/c.bigBlind||s.minimum!==(c.street==='flop'?c.bigBlind:2*c.bigBlind)||s.street!==c.street||s.independentlySummedPot!==row.pot)fail('Literal stake pot/stack/BB arithmetic differs');}
 }
 return{...validated,id:entry.id,status:errors.length?'NOT_QUALIFIED':'QUALIFIED',errors,workflow:'gate-matrix',width:null,commands:rows.map((row,index)=>({id:index+1,name:row.case?.kind,status:row.status,result:row})),actualUIPlayedHands:0,actualCases:rows.length};
}
