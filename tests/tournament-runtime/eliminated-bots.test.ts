import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {settleTournamentHand,tournamentProfile,type TournamentData} from '../../src/tournament/runtime';
import {nextTournamentHand,replayTournamentHand} from '../../src/core/engine';
it('prepares and commits real policies after Hero elimination with an empty physical button',async()=>{
 let fixture:TournamentData|null=null;
 for(const seats of [6,9]){const source=JSON.parse(gunzipSync(readFileSync(`tests/tournament-runtime/fixtures/expanded-${seats}.json.gz`)).toString()) as TournamentData;
 for(let n=0;n<source.active!.history.length-1;n++){const prior=source.active!.history[n].state;if(prior.seats.filter(s=>s.stack>0).length<3)continue;const next=nextTournamentHand(prior,`spectator:${seats}:${n}`,tournamentProfile(source.active!,n+2));if(next.seats.some(s=>s.id===0)||next.seats.some(s=>s.id===next.button))continue;
 const data=structuredClone(source),event=data.active!;data.revision=0;data.ledger=data.ledger.filter(row=>row.kind!=='prize');data.balance=data.ledger.at(-1)!.balance;event.history=[];event.finishes=[];event.status='running';event.finishedAt=null;event.paused=false;event.pending=null;
 for(const hand of source.active!.history.slice(0,n+1)){event.game=structuredClone(hand.state);event.handNumber=hand.number;event.frames=replayTournamentHand(event.game);settleTournamentHand(data,event,hand.settledAt);}
 event.game=next;event.handNumber=n+2;event.frames=replayTournamentHand(next);fixture=data;break;}if(fixture)break;}
 expect(fixture,'Immutable full-event fixtures must exercise a dead-button spectator hand').not.toBeNull();const port=new MemoryTournamentPersistence();await port.commit(null,fixture!);const c=new TournamentController(port);await c.init();expect(c.error).toBe('');expect(c.data!.active!.status).toBe('hero-out');
 for(let actions=0;actions<10&&c.data!.active!.game.street!=='complete';actions++){await c.prepareBot();expect(c.error).toBe('');const p=c.data!.active!.pending;expect(p?.decision).toBeTruthy();const restored=new TournamentController(port);await restored.init();expect(restored.error).toBe('');expect(restored.data!.active!.pending).toEqual(p);const revision=c.data!.active!.game.revision;await c.commitBot(p!.handId,p!.revision);expect(c.error).toBe('');expect(c.data!.active!.game.revision).toBe(revision+1);}
});
