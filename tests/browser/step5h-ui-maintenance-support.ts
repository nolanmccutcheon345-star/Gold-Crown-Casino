import type {AppData} from '../../src/session/types';
import {check} from './step5f-support';
export function maintenanceFinancial(data:Pick<AppData,'wallet'|'active'|'ledger'|'revision'>,hands:number){
 check(!data.active,'Maintenance fixture must be cashed out');
 const totals=data.ledger.reduce((sum,e)=>({wallet:sum.wallet+e.walletDelta,table:sum.table+e.tableDelta,net:sum.net+e.pokerNet}),{wallet:0,table:0,net:0});
 check(totals.wallet===data.wallet&&totals.table===0,'Independent closed-session financial sums differ');
 check(new Set(data.ledger.map(e=>e.id)).size===data.ledger.length,'Duplicate financial identity');
 check(data.ledger.filter(e=>e.kind==='hand-net').length===hands,'Canonical settlement count differs');
 check(data.ledger.every(e=>e.kind==='hand-net'||e.pokerNet===0),'Non-poker transfer inflated results');
 return{...totals,hands,events:data.ledger.length,revision:data.revision};
}
export function requireMaintenanceRelease(state:{resident:number;total:number;historyLoaded:boolean;busy:boolean},expectedHands:number){
 check(state.total===expectedHands&&state.resident<=120&&!state.historyLoaded&&state.busy,'Expanded history was not released before the real storage operation');
}
