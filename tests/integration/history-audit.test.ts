import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { act, hand } from '../verification/helpers';
import { projectView } from '../../src/core/engine';

function exportedFold() {
  const game = act(hand([20000, 20000]), {type: 'fold'});
  return {format: 'ai-texas-hold-em-public-history', hands: [{kind: 'public-redacted', handId: game.handId, view: projectView(game, 0)}]};
}
function audit(payload: unknown) {
  const directory = mkdtempSync(join(tmpdir(), 'poker-accounting-'));
  try {
    const file = join(directory, 'history.json'); writeFileSync(file, JSON.stringify(payload));
    return JSON.parse(execFileSync(process.execPath, ['scripts/verify-public-history.mjs', file], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}));
  } finally { rmSync(directory, {recursive: true, force: true}); }
}
describe('Independent exported-history event audit', () => {
  it('reconciles forced bets, uncalled return, award and final stacks', () => {
    expect(audit(exportedFold()).hands[0]).toMatchObject({status: 'PASS', startingCents: 40000,
      committedCents: 300, refundedCents: 100, contestableCents: 200, awardedCents: 200, rakeCents: 0, endingCents: 40000});
  });
  it('rejects a lost chip even when the engine snapshot is otherwise valid', () => {
    const payload = exportedFold(); payload.hands[0].view.seats[0].stack--;
    expect(() => audit(payload)).toThrow();
  });
  it('rejects duplicate event/decision evidence instead of counting it twice', () => {
    const payload = exportedFold(); payload.hands[0].view.events.push(payload.hands[0].view.events.find(event => event.type === 'action')!);
    expect(() => audit(payload)).toThrow();
  });
  it('rejects manufactured winnings absent from the authoritative award events', () => {
    const payload = exportedFold(); payload.hands[0].view.payouts[1]++;
    expect(() => audit(payload)).toThrow();
  });
  it('rejects wrong rake even when modified events and balances still conserve chips', () => {
    const payload = exportedFold(); const view = payload.hands[0].view;
    view.rake = 1; view.payouts[1]--; view.pots[0].amount--; view.seats[1].stack--;
    view.events.find(event => event.type === 'award')!.amount!--;
    view.events.push({id: 'tampered-rake', handId: view.handId, revision: view.revision, type: 'rake', amount: 1});
    expect(() => audit(payload)).toThrow();
  });
});
