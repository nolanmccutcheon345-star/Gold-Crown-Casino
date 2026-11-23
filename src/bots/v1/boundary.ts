import type {BotMemory,BotObservation,BotProfile,ObservedRate} from '../../contracts';
import {completeProfile,POLICY_VERSION} from './profiles';
import {publicActionEvents} from './memory';
const rate=(r:ObservedRate):ObservedRate=>{
 if(!r||!Number.isSafeInteger(r.count)||!Number.isSafeInteger(r.opportunities)||r.count<0||r.count>r.opportunities)throw new Error('Invalid public-memory rate.');
 return {count:r.count,opportunities:r.opportunities};
};
function memory(m:BotMemory):BotMemory {
 if(!Number.isSafeInteger(m.windowHands)||m.windowHands<0||m.windowHands>120||m.opponents.length>9)throw new Error('Invalid public memory window.');
 return {windowHands:m.windowHands,opponents:m.opponents.map(p=>({seatId:p.seatId,hands:p.hands,vpip:rate(p.vpip),pfr:rate(p.pfr),aggression:rate(p.aggression),foldToBet:rate(p.foldToBet),showdowns:p.showdowns.slice(-8).map(cards=>{if(cards.length!==2||cards.some(c=>!/^[2-9TJQKA][cdhs]$/.test(c))||cards[0]===cards[1])throw new Error('Invalid public showdown.');return [...cards];})})).sort((a,b)=>a.seatId-b.seatId)};
}
export function permittedObservation(o:BotObservation,withContext=true):BotObservation {
 const result:BotObservation={handId:o.handId,revision:o.revision,actingSeat:o.actingSeat,decisionId:o.decisionId,policyVersion:o.policyVersion,ownCards:[...o.ownCards],board:[...o.board],street:o.street,button:o.button,pot:o.pot,bigBlind:o.bigBlind,seats:o.seats.map(s=>({id:s.id,stack:s.stack,streetCommitted:s.streetCommitted,totalCommitted:s.totalCommitted,folded:s.folded,allIn:s.allIn})),legal:{actor:o.legal.actor,fold:o.legal.fold,check:o.legal.check,callAmount:o.legal.callAmount,minRaiseTo:o.legal.minRaiseTo,maxRaiseTo:o.legal.maxRaiseTo,canRaise:o.legal.canRaise,shortAllInTo:o.legal.shortAllInTo,reopened:o.legal.reopened},publicEvents:publicActionEvents(o.publicEvents)};
 if(withContext&&o.rake){if(!Number.isSafeInteger(o.rake.basisPoints)||o.rake.basisPoints<0||o.rake.basisPoints>10000||!Number.isSafeInteger(o.rake.cap)||o.rake.cap<0)throw new Error('Invalid public rake.');result.rake={basisPoints:o.rake.basisPoints,cap:o.rake.cap,noFlopNoDrop:o.rake.noFlopNoDrop};}
 if(withContext&&o.memory)result.memory=memory(o.memory);
 return result;
}
export function validate(o:BotObservation,p:BotProfile):void {
 completeProfile(p);
 if(o.policyVersion!==POLICY_VERSION||p.policyVersion!==o.policyVersion)throw new Error('Bot policy version mismatch.');
 if(!o.handId||!o.decisionId||!Number.isSafeInteger(o.revision)||o.revision<0)throw new Error('Missing bot decision identity.');
 if(o.street==='complete'||o.legal.actor!==o.actingSeat)throw new Error('Bot does not own the current turn.');
 if(o.ownCards.length!==2||![0,3,4,5].includes(o.board.length))throw new Error('Invalid visible card count.');
 const cards=[...o.ownCards,...o.board];if(cards.some(c=>!/^[2-9TJQKA][cdhs]$/.test(c))||new Set(cards).size!==cards.length)throw new Error('Invalid visible cards.');
 const own=o.seats.find(s=>s.id===o.actingSeat);if(!own||own.folded||own.allIn||!Number.isSafeInteger(own.stack)||own.stack<=0)throw new Error('Bot seat cannot act.');
 if(![o.pot,o.bigBlind,o.legal.callAmount,own.streetCommitted].every(n=>Number.isSafeInteger(n)&&n>=0)||o.bigBlind===0)throw new Error('Invalid chip amount.');
 if(o.legal.callAmount>own.stack||o.legal.check!==(o.legal.callAmount===0))throw new Error('Inconsistent legal actions.');
 if(!o.legal.canRaise&&(o.legal.minRaiseTo!==null||o.legal.maxRaiseTo!==null||o.legal.shortAllInTo!==null))throw new Error('Raise bounds supplied when raising is closed.');
 if(o.legal.canRaise&&!o.legal.reopened)throw new Error('Raising is not reopened.');
 if(o.legal.canRaise&&(o.legal.minRaiseTo===null||o.legal.maxRaiseTo===null||!Number.isSafeInteger(o.legal.minRaiseTo)||!Number.isSafeInteger(o.legal.maxRaiseTo)||(o.legal.minRaiseTo>o.legal.maxRaiseTo&&o.legal.shortAllInTo!==o.legal.maxRaiseTo)||o.legal.minRaiseTo<=own.streetCommitted+o.legal.callAmount||o.legal.maxRaiseTo>own.streetCommitted+own.stack))throw new Error('Invalid legal raise bounds.');
 if(o.legal.shortAllInTo!==null&&(!Number.isSafeInteger(o.legal.shortAllInTo)||o.legal.shortAllInTo!==own.streetCommitted+own.stack||o.legal.shortAllInTo<=own.streetCommitted+o.legal.callAmount))throw new Error('Invalid short all-in bound.');
}
export function fingerprint(o:BotObservation,p:BotProfile):string {
 const text=JSON.stringify({observation:o,profile:p});let a=0x811c9dc5,b=0x9e3779b9;
 for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b^text.charCodeAt(i),2246822519);}
 return `cash-v1:${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}`;
}
