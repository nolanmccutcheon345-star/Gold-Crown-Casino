import { beforeAll, describe, expect, it } from 'vitest';
import { TournamentController } from '../../src/tournament/controller';
import { MemoryTournamentPersistence, encodeTournamentCheckpoint } from '../../src/tournament/persistence';
import { fastForwardTournament } from '../../src/tournament/fast-forward';
import { allHeroHands } from '../../src/tournament/mtt-event';
import { entryCost, EVENT_PRESETS } from '../../src/tournament/presets';

/** Hero checks when free and folds otherwise; computer players act through the normal prepare/commit path. */
async function step(c: TournamentController): Promise<'round' | 'action'> {
  const e = c.data!.active!, g = c.gameView!;
  if (e.game.street === 'complete') { await c.nextHand(); return 'round'; }
  if (g.actor === 0) await c.act({ type: g.legal.check ? 'check' : 'fold' }, g.handId, g.revision);
  else { await c.prepareBot(); const cur = c.data!.active!; await c.commitBot(cur.game.handId, cur.game.revision); }
  return 'action';
}

describe('multi-table events through the controller and save', () => {
  it('registers an 18-player event: two tables, Hero seat 0, one entry charge', async () => {
    const c = new TournamentController(new MemoryTournamentPersistence()); await c.init();
    await c.startEvent('daily-125', 18, 'fast'); expect(c.error).toBe('');
    const e = c.data!.active!, preset = EVENT_PRESETS.find(p => p.id === 'daily-125')!;
    expect(e.mtt!.state.tables).toHaveLength(2); expect(e.game.seats.some(s => s.id === 0 && s.name === 'You')).toBe(true);
    expect(c.data!.balance).toBe(200_000 - entryCost(preset)); expect(c.view!.tablesLeft).toBe(2); expect(c.view!.hero!.table).toBeGreaterThan(0);
    await c.startEvent('daily-125', 18, 'fast'); expect(c.data!.ledger.filter(r => r.kind === 'entry')).toHaveLength(1);
  });
  describe.sequential('one complete event with bounded round batches', () => {
    const port = new MemoryTournamentPersistence(); let c: TournamentController; let rounds = 0;
    beforeAll(async () => { c = new TournamentController(port); await c.init(); await c.startEvent('daily-125', 18, 'fast'); expect(c.error).toBe(''); });
    // Each test owns at most five rounds. Keep the normal timeout: this exercises one
    // continuous save without putting the entire event under one timing deadline.
    for (let batch = 0; batch < 32; batch++) it(`commits round batch ${batch + 1}`, async () => {
      for (let n = 0; n < 5 && c.data!.active!.status !== 'complete'; n++) {
        const before = c.data!.active!.handNumber;
        if (c.data!.active!.status === 'running') {
          let actions = 0;
          while (c.data!.active!.handNumber === before && c.data!.active!.status === 'running') {
            await step(c); expect(c.error).toBe(''); expect(++actions).toBeLessThan(500);
          }
        } else {
          await fastForwardTournament(c, () => c.data!.active!.handNumber === before && c.data!.active!.status !== 'complete', async () => {});
        }
        rounds++; expect(c.error).toBe('');
        if (rounds % 7 === 0) { c.close(); c = new TournamentController(port); await c.init(); expect(c.status).toBe('ready'); }
        const blocks = c.data!.active!.mtt!.blocks;
        expect(blocks.every(b => Object.isFrozen(b) && Object.isFrozen(b.hands))).toBe(true);
        const { checkpoint, blocks: records } = encodeTournamentCheckpoint(c.data!);
        expect(records).toHaveLength(blocks.length);
        expect(JSON.stringify(checkpoint.payload.active!.mtt!.blocks)).toBe(JSON.stringify(records.map(r => ({ id: r.id, hash: r.hash }))));
        expect(c.data!.active!.history.length).toBeLessThanOrEqual(20 + 6);
      }
    });
    it('reconciles prizes and fully audits the finished event', () => {
      const e = c.data!.active!; expect(e.status).toBe('complete'); const state=e.mtt!.state, entries=state.players.length, registration=state.registration!;
      expect(e.entrants).toBe(18); expect(registration.entries.filter(r=>r.kind==='initial')).toHaveLength(18);
      const late=registration.entries.filter(r=>r.kind==='late').length, reEntries=registration.entries.filter(r=>r.kind==='re-entry').length;
      expect(entries).toBe(18+late+reEntries); expect(registration.entries).toHaveLength(entries);
      expect(new Set(registration.entries.map(r=>r.player)).size).toBe(entries);
      expect(state.players.reduce((sum,p)=>sum+p.stack,0)).toBe(entries*e.preset.startingStack);
      expect(e.prizePool).toBe(entries*e.preset.buyIn); expect(e.feeTotal).toBe(entries*e.preset.fee);
      expect(e.finishes).toHaveLength(entries); expect(new Set(e.finishes.map(f=>f.seatId)).size).toBe(entries);
      const charges=c.data!.ledger.filter(r=>r.kind==='entry');expect(charges).toHaveLength(1);expect(charges[0].amount).toBe(-entryCost(e.preset));
      expect(e.finishes.reduce((sum, f) => sum + f.prize, 0)).toBe(e.prizePool);
      expect(c.view!.result!.handsPlayed).toBe(allHeroHands(e).length);
      const hero = e.finishes.find(f => f.seatId === 0)!, prize = c.data!.ledger.filter(r => r.kind === 'prize');
      expect(prize).toHaveLength(1); expect(prize[0].amount).toBe(hero.prize);
      expect(c.auditHistory()).toBe(allHeroHands(e).length);
    });
    it('reloads and archives the completed event exactly once', async () => {
      const reloaded = new TournamentController(port); await reloaded.init(); expect(reloaded.status).toBe('ready');
      await reloaded.finishEvent(); expect(reloaded.data!.active).toBeNull(); expect(reloaded.records.at(-1)!.entrants).toBe(reloaded.data!.completed.at(-1)!.mtt!.state.players.length);
      const again = new TournamentController(port); await again.init(); expect(again.status).toBe('ready'); expect(again.data!.completed).toHaveLength(1);
    });
  });
  it('a stale round cannot be applied twice', async () => {
    const c = new TournamentController(new MemoryTournamentPersistence()); await c.init(); await c.startEvent('daily-125', 18, 'fast');
    while (c.data!.active!.game.street !== 'complete') await step(c);
    const before = c.data!.active!.handNumber; await Promise.all([c.nextHand(), c.nextHand()]);
    expect(c.data!.active!.handNumber).toBe(before + 1); expect(c.error).toBe('');
  });
});
