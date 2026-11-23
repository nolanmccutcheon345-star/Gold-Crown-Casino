import {expect,it} from 'vitest';
import type {ConfigurationHistoryRow} from '../../src/stats/cash';
import {configurationHistoryMarkup} from '../../src/ui/configuration-history';
const row:ConfigurationHistoryRow={key:'boundary',sessionId:'session',status:'RECORDED',startedAt:'2026-11-01T12:00:00Z',firstHandNumber:1,lastHandNumber:4,hands:4,profit:1250,bb100:156.25,population:'low',tableMode:'live',smallBlind:100,bigBlind:200,occupiedSeats:3,capacity:6,selectionMix:[{selection:'unknown',count:1},{selection:'random',count:1}],evidenceStatus:'DESIGNED_SYNTHETIC_NOT_HUMAN_VALIDATED',ruleId:'practice-cash',ruleVersion:'1.0+cfg.'+ 'a'.repeat(64),rake:{basisPoints:500,cap:300,noFlopNoDrop:true},policyVersions:['synthetic-cash-1.5.0'],changeReason:'session-start',disclosure:'Designed synthetic population; not human-calibrated.'};
it('shows only recorded Host choices and explicit synthetic evidence without resolving Unknown or Random',()=>{
 const html=configurationHistoryMarkup([row],0);expect(html).toContain('1 × Unknown');expect(html).toContain('1 × Random');expect(html).toContain('DESIGNED · Synthetic');expect(html).toContain('$12.50');expect(html).toContain('156.25');expect(html).not.toContain('personalitySeed');expect(html).not.toContain('stronger-reg');
});
it('keeps missing legacy metadata unavailable rather than borrowing a current population',()=>{
 const html=configurationHistoryMarkup([{...row,status:'LEGACY_UNKNOWN',population:null,tableMode:null,capacity:null,selectionMix:null,evidenceStatus:'LEGACY_UNRECORDED',changeReason:'legacy-unknown'}],0);
 expect(html).toContain('Legacy · metadata unavailable');expect(html).toContain('Unrecorded — not inferred');expect(html).toContain('current lineup is not a historical substitute');expect(html).not.toContain('Low-stakes mix');
});
it('retains exact accessible long rule version while escaping source labels and disclosures',()=>{
 const html=configurationHistoryMarkup([{...row,ruleId:'<script>',disclosure:'<unsafe>'}],0);expect(html).not.toContain('<script>');expect(html).toContain('&lt;unsafe&gt;');expect(html).toContain(row.ruleVersion);expect(html).toContain('sr-only');
});
it('bounds large histories to twenty groups with explicit navigation and does not mutate source order',()=>{
 const rows=Array.from({length:45},(_,index)=>({...row,key:`row-${index}`,firstHandNumber:index,lastHandNumber:index})),before=JSON.stringify(rows),html=configurationHistoryMarkup(rows,1);
 expect((html.match(/data-configuration-status=/g)??[]).length).toBe(20);expect(html).toContain('page 2 / 3');expect(html).toContain('data-configuration-first-hand="24"');expect(html).toContain('data-configuration-first-hand="5"');expect(html).not.toContain('data-configuration-first-hand="25"');expect(JSON.stringify(rows)).toBe(before);
});
it('handles an empty completed-hand history with no fake results or active-hand totals',()=>{
 const html=configurationHistoryMarkup([],0);expect(html).toContain('No completed cash hands yet');expect(html).not.toContain('data-configuration-status=');expect(html).toContain('data-configuration-page="1" disabled');
});
it('identifies a newly applied boundary with zero settled hands without inventing a final hand number',()=>{
 const html=configurationHistoryMarkup([{...row,firstHandNumber:5,lastHandNumber:null,hands:0,profit:0,bb100:null}],0);
 expect(html).toContain('Effective from hand 5 · No settled hands yet');expect(html).not.toContain('5–null');expect(html).toContain('$1.00 / $2.00');
});
