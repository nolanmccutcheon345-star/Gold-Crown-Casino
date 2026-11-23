import type {Archetype} from '../contracts';
import type {AppData} from '../session/types';

type InsightData=Pick<AppData,'active'|'sessions'|'hands'>;
export interface RecordedStyleInsight {seatId:number;archetype:Archetype;}
const known:readonly string[]=['nit','tag','lag','station','maniac','fit-or-fold','passive-reg','stronger-reg'];
/** Explicit opt-in projection only. Read the current controller snapshot again
 * for every click/render; stale DOM or ended-but-seated tables confer no access. */
export function canRevealSessionStyles(data:InsightData,sessionId:string):boolean {
 const session=data.sessions.find(item=>item.id===sessionId);
 return data.active===null&&!!session?.endedAt&&Number.isFinite(Date.parse(session.endedAt))&&session.handIds.length>0;
}
export function recordedSessionStyles(data:InsightData,sessionId:string):readonly RecordedStyleInsight[] {
 if(!canRevealSessionStyles(data,sessionId))throw new Error('End and cash out all tables before opting into recorded session styles.');
 const session=data.sessions.find(item=>item.id===sessionId)!;
 const first=data.hands.find(hand=>hand.id===session.handIds[0]&&hand.sessionId===session.id);
 if(!first)throw new Error('The session’s original recorded hand is unavailable; styles cannot be inferred.');
 const rows:RecordedStyleInsight[]=[];
 for(const [id,profile] of Object.entries(first.privateProfiles)){
  const seatId=Number(id),config=session.settings.opponents?.[seatId-1];
  // Unknown is an immutable recorded marker. For Random, current setup alone
  // cannot prove the original selection after a later reconfiguration: require
  // the original recorded personality identity to match the saved seed.
  const unchangedRandom=config?.selection==='random'&&config.personalitySeed!==undefined&&profile.personalityId===`cash-v1.2:${config.personalitySeed.toString(16).padStart(8,'0')}:${profile.archetype}`;
  if(!profile.unknown&&!unchangedRandom)continue;
  if(!Number.isInteger(seatId)||seatId<=0||!known.includes(profile.archetype))throw new Error('Recorded style metadata is invalid.');
  rows.push(Object.freeze({seatId,archetype:profile.archetype}));
 }
 return Object.freeze(rows.sort((a,b)=>a.seatId-b.seatId));
}
