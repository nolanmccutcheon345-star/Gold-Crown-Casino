import type {PublicHistory} from '../session/types';
import type {PublicHistoryBatch} from '../storage/public-history-batch';
/** One immutable, already-redacted payload supplies every export transport. */
export function prepareHistoryFiles(history:PublicHistory){
 const text=JSON.stringify(history,null,2);
 return {text,json:new File([text],'ai-texas-hold-em-history.json',{type:'application/json'}),plain:new File([text],'ai-texas-hold-em-history.json.txt',{type:'text/plain'})};
}
/** Uses the exact byte-budgeted text: pretty-printing here would invalidate the
 * file-size bound. A later tap shares/downloads this already-prepared payload. */
export function prepareHistoryBatchFiles(batch:PublicHistoryBatch){
 const range=batch.nextIndex===batch.startIndex?'empty':`${batch.startIndex+1}-${batch.nextIndex}`;
 const name=`ai-texas-hold-em-history-${range}-of-${batch.total}.json`,text=batch.text;
 return {text,json:new File([text],name,{type:'application/json'}),plain:new File([text],name+'.txt',{type:'text/plain'})};
}
export type HistoryFiles=ReturnType<typeof prepareHistoryFiles>;
export type SharePort=Pick<Navigator,'canShare'|'share'>;
export function shareableFile(files:HistoryFiles,port:Partial<SharePort>):File|null{
 if(!port.canShare||!port.share)return null;
 for(const file of [files.json,files.plain])try{if(port.canShare({files:[file]}))return file;}catch{/* Offer the plain-text or copy fallback. */}
 return null;
}
/** Call directly from the tap handler; do not await payload construction first. */
export function sharePreparedHistory(files:HistoryFiles,port:Partial<SharePort>):Promise<'shared'|'cancelled'|'unavailable'|'failed'>{
 const file=shareableFile(files,port);if(!file||!port.share)return Promise.resolve('unavailable');
 try{return port.share({files:[file],title:'Poker Night AI hand history'}).then(()=> 'shared' as const).catch(error=>error?.name==='AbortError'?'cancelled' as const:'failed' as const);}catch{return Promise.resolve('failed');}
}
