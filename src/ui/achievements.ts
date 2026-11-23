/** Patch 54: milestones and session streaks, worked out from saved records each time. Nothing new is stored. */
import type {AppData} from '../session/types';
import type {TournamentRecord} from '../tournament/view-model';

export interface Milestone {id:string;group:'cash'|'tournament';title:string;detail:string;earned:boolean;progress?:{have:number;need:number}}
export interface Streaks {current:number;best:number;completed:number}

/** Completed cash sessions in start order, with each result from the ledger. The running session is left out. */
export function sessionResults(data:AppData):number[] {
 const net=new Map<string,number>();
 for(const event of data.ledger)if(event.kind==='hand-net'&&event.sessionId)net.set(event.sessionId,(net.get(event.sessionId)??0)+event.pokerNet);
 return [...data.sessions].filter(session=>session.endedAt!==null&&session.handIds.length>0).sort((a,b)=>a.startedAt<b.startedAt?-1:a.startedAt>b.startedAt?1:0).map(session=>net.get(session.id)??0);
}
/** Winning-session streaks. A break-even or losing session ends a streak. */
export function sessionStreaks(results:readonly number[]):Streaks {
 let run=0,best=0;
 for(const result of results){run=result>0?run+1:0;best=Math.max(best,run);}
 return {current:run,best,completed:results.length};
}

const count=(id:string,title:string,need:number,have:number,detail:string):Milestone=>({id,group:'cash',title,detail,earned:have>=need,progress:{have:Math.min(have,need),need}});
/**
 * Cash milestones. Hand counts come from the session records (always complete); pot sizes and showdowns come from the
 * hands currently loaded on this device.
 */
export function cashMilestones(data:AppData):Milestone[] {
 const hands=data.sessions.reduce((sum,session)=>sum+session.handIds.length,0);
 const inBigBlinds=data.hands.map(hand=>hand.net/hand.view.profile.bigBlind);
 const best=inBigBlinds.length?Math.max(...inBigBlinds):0;
 const showdownWin=data.hands.some(hand=>hand.view.handLabels[0]!==undefined&&(hand.view.payouts[0]??0)>0);
 const streaks=sessionStreaks(sessionResults(data));
 const winning=sessionResults(data).filter(result=>result>0).length;
 return [
  count('hands-1','First hand',1,hands,'Play a complete hand.'),
  count('hands-100','Hundred hands',100,hands,'Play 100 hands.'),
  count('hands-1000','Thousand hands',1000,hands,'Play 1,000 hands.'),
  count('hands-5000','Long haul',5000,hands,'Play 5,000 hands.'),
  {id:'pot-25',group:'cash',title:'Big pot',detail:'Win 25 big blinds or more in one hand.',earned:best>=25},
  {id:'pot-100',group:'cash',title:'Monster pot',detail:'Win 100 big blinds or more in one hand.',earned:best>=100},
  {id:'showdown',group:'cash',title:'Shown down',detail:'Win a pot at showdown.',earned:showdownWin},
  count('session-win','Winning session',1,winning,'Finish a cash session ahead.'),
  count('streak-3','Three in a row',3,streaks.best,'Finish three cash sessions ahead in a row.'),
 ];
}
export function tournamentMilestones(records:readonly TournamentRecord[]):Milestone[] {
 const t=(id:string,title:string,detail:string,earned:boolean):Milestone=>({id,group:'tournament',title,detail,earned});
 return [
  t('t-first','First tournament','Finish a tournament.',records.length>0),
  t('t-cash','In the money','Finish in a paid place.',records.some(record=>record.prize>0)),
  t('t-final','Final table','Reach the final table of a multi-table event.',records.some(record=>record.entrants>9&&record.place<=9)),
  t('t-win','Champion','Win a tournament.',records.some(record=>record.place===1)),
 ];
}
