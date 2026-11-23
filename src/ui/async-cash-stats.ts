import {CashStatsProjection} from '../stats/projection';
import type {CashStats} from '../stats/cash';
import type {AppData,CashSession,StoredHand} from '../session/types';
import {timedAsync} from '../performance/timing';
import {getArchiveContext,isVerifiedSnapshot} from '../storage/verified';
import type {CashProjectionCheckpoint} from '../stats/projection';

const prefix=(before:readonly StoredHand[],after:readonly StoredHand[])=>before===after||(before.length<=after.length&&before.every((hand,index)=>after[index]===hand));
/** UI-only readiness coordinator. Unfinished/replaced preparations cannot publish
 * statistics, and no placeholder number is returned as a computed result. */
export class AsyncCashStats {
 private projection=new CashStatsProjection();
 private source:readonly StoredHand[]|null=null;
 private pending:readonly StoredHand[]|null=null;
 private failed:readonly StoredHand[]|null=null;
 private generation=0;
 private checkpoint:CashProjectionCheckpoint|null=null;
 private compactProjection:CashStatsProjection|null=null;
 error='';
 constructor(private changed:()=>void,private yieldControl?:()=>Promise<void>|undefined){}
 reset():void {this.generation++;this.projection=new CashStatsProjection();this.source=null;this.pending=null;this.failed=null;this.error='';this.checkpoint=null;this.compactProjection=null;}
 readData(data:AppData|null,now=Date.now()):CashStats|null {
  if(!data)return null;
  const context=isVerifiedSnapshot(data)?getArchiveContext(data):undefined;
  if(!context)return this.read(data.hands,data.sessions,now);
  try{
   if(this.checkpoint!==context.statistics){
    const last=context.handIndex[context.statisticsHands-1];
    this.compactProjection=CashStatsProjection.restoreCheckpoint(context.statistics,{hands:context.statisticsHands,lastId:last?.id??null,lastHash:last?.hash??null});this.checkpoint=context.statistics;
   }
   const start=this.compactProjection!.getDiagnostics().checkpoint.hands-context.handOffset;
   if(start<0||start>data.hands.length)throw Error('Statistics checkpoint no longer matches resident history.');
   const result=this.compactProjection!.appendVerifiedTail(data.hands.slice(start),data.sessions,now);this.error='';return result;
  }catch(error){this.error=(error as Error).message;return null;}
 }
 read(records:readonly StoredHand[],sessions:readonly CashSession[],now=Date.now()):CashStats|null {
  if(this.pending){
   if(prefix(this.pending,records))return null;
   this.reset(); // Restoration/replacement is a different immutable source.
  }
  if(this.failed===records)return null;
  const incremental=this.source!==null&&prefix(this.source,records);
  if(incremental||records.length<=32){
   try{const result=this.projection.derive(records,sessions,now);this.source=records;this.error='';return result;}
   catch(error){this.error=(error as Error).message;this.failed=records;return null;}
  }
  const generation=++this.generation;this.pending=records;this.error='';this.failed=null;
  void timedAsync('statistics.prewarm',()=>CashStatsProjection.prewarm(records,{yieldControl:this.yieldControl,cancelled:()=>generation!==this.generation})).then(projection=>{
   if(generation!==this.generation)return;
   this.projection=projection;this.source=records;this.pending=null;this.changed();
  }).catch(error=>{
   if(generation!==this.generation)return;
   this.pending=null;this.failed=records;this.error=(error as Error).message;this.changed();
  });
  return null;
 }
}
