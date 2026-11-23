import {describe,it,expect} from 'vitest';
import {fastForwardTournament} from '../../src/tournament/fast-forward';
import type {TournamentController} from '../../src/tournament/controller';
function fixture(){
 const calls:string[]=[];const data={revision:0,active:{status:'hero-out',paused:false,game:{actor:1,street:'preflop',handId:'h',revision:0},pending:null as {decision:object}|null}};
 const controller={data,status:'ready',busy:false,error:'',async nextHand(){calls.push('deal');data.revision++;data.active.game.street='preflop';},async prepareBot(){calls.push('prepare');data.revision++;data.active.pending={decision:{}};},async commitBot(){calls.push('commit');data.revision++;data.active.game.street='complete';data.active.status='complete';}};
 return {controller:controller as unknown as TournamentController,data,calls};
}
describe('post-elimination fast-forward safety',()=>{
 it('refuses to play for a live Hero',async()=>{const f=fixture();f.data.active.status='running';await expect(fastForwardTournament(f.controller,()=>true)).rejects.toThrow(/eliminated/);expect(f.calls).toEqual([]);});
 it('prepares and durably commits normal decisions, then stops at completion',async()=>{const f=fixture();let yields=0;expect(await fastForwardTournament(f.controller,()=>true,async()=>{yields++;})).toBe(1);expect(f.calls).toEqual(['prepare','commit']);expect(yields).toBe(1);});
 it('honors cancellation between preparation and commitment',async()=>{const f=fixture();expect(await fastForwardTournament(f.controller,()=>f.calls.length===0,async()=>{})).toBe(1);expect(f.calls).toEqual(['prepare']);expect(f.data.active.pending).not.toBeNull();});
 it('stops on pause or recovery failure without acting',async()=>{const f=fixture();f.data.active.paused=true;expect(await fastForwardTournament(f.controller,()=>true)).toBe(0);f.data.active.paused=false;f.controller.status='error';expect(await fastForwardTournament(f.controller,()=>true)).toBe(0);expect(f.calls).toEqual([]);});
 it('does not spin when a controller refuses a step',async()=>{const f=fixture();f.controller.prepareBot=async()=>{f.controller.error='Quota failure';};await expect(fastForwardTournament(f.controller,()=>true)).rejects.toThrow('Quota failure');});
});
