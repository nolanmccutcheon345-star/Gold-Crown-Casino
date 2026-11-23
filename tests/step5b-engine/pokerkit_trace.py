"""V502 independent state trace. PokerKit 0.7.7, no application imports.

Supported: cash NLHE, no rake/ante/straddle, all integer chip denominations via
exact integer-unit conversion, ordinary/all-in showdown including folded money.
All-fold endings are omitted: PokerKit's uncollected winner bets are combined
with ChipsPulling, unlike separate engine refund/award events. That representation
needs a separately reviewed adapter, not a silently weakened equality assertion.
"""
import json
import sys
from importlib.metadata import version
from pokerkit import Automation, Mode, NoLimitTexasHoldem

assert version('pokerkit') == '0.7.7'
AUTOMATIONS = (Automation.ANTE_POSTING, Automation.BET_COLLECTION,
               Automation.BLIND_OR_STRADDLE_POSTING, Automation.RUNOUT_COUNT_SELECTION)


def trace(case):
    unit = case['unit']
    assert unit > 0 and all(value % unit == 0 for value in case['stacks'] + [case['smallBlind'], case['bigBlind']])
    count = len(case['stacks'])
    # PokerKit fixes position 0=SB in multiway and 0=BB in heads-up.
    order = [1, 0] if count == 2 else list(range(1, count)) + [0]
    starting = [case['stacks'][i] // unit for i in order]
    s = NoLimitTexasHoldem.create_state(
        AUTOMATIONS, True, 0, (case['smallBlind'] // unit, case['bigBlind'] // unit),
        case['bigBlind'] // unit, starting, count, mode=Mode.CASH_GAME)
    for seat in order:
        s.deal_hole(''.join(case['holes'][seat]))
    paid = [starting[i] - s.stacks[i] for i in range(count)]
    refunds = [0] * count
    awards = [0] * count
    board_cursor = 0
    burn_cursor = 0
    final_pots = None
    forced_checks = []

    def advance():
        nonlocal board_cursor, burn_cursor, final_pots, refunds
        while s.status:
            if s.actor_index is not None:
                funded = [i for i in range(count) if s.statuses[i] and s.stacks[i] > 0]
                # PokerKit sometimes exposes a no-choice check where the app
                # automatically runs out. Preserve the normalization explicitly.
                if len(funded) == 1 and s.checking_or_calling_amount == 0 and not s.can_complete_bet_or_raise_to():
                    operation = s.check_or_call()
                    assert operation.amount == 0
                    forced_checks.append({'seatId': order[operation.player_index], 'boardCards': board_cursor, 'amount': 0})
                    continue
                break
            if s.can_show_or_muck_hole_cards():
                s.show_or_muck_hole_cards(True)
            elif s.can_burn_card():
                s.burn_card(case['burns'][burn_cursor])
                burn_cursor += 1
                amount = 3 if board_cursor == 0 else 1
                s.deal_board(''.join(case['board'][board_cursor:board_cursor + amount]))
                board_cursor += amount
            elif s.can_kill_hand() or s.can_push_chips():
                final_pots = [{'amount': p.unraked_amount * unit,
                               'eligible': sorted(order[i] for i in p.player_indices)}
                              for p in s.pots]
                # Before awards: actual reference stacks expose its returns.
                refunds = [s.stacks[i] - starting[i] + paid[i] for i in range(count)]
                while s.can_kill_hand():
                    s.kill_hand()
                while s.can_push_chips():
                    s.push_chips()
                while s.can_pull_chips():
                    operation = s.pull_chips()
                    awards[operation.player_index] += operation.amount
            else:
                raise AssertionError(f'Unrecognized independent oracle phase: {case["id"]}, board={board_cursor}, operations={s.operations[-5:]}')

    def mapped(values):
        result = [0] * count
        for i, seat in enumerate(order):
            result[seat] = values[i] * unit
        return result

    def snapshot(wager=None):
        if s.status:
            pots = None if any(s.bets) else [
                {'amount': p.unraked_amount * unit,
                 'eligible': sorted(order[i] for i in p.player_indices)} for p in s.pots]
        else:
            pots = final_pots
        return {'actor': None if s.actor_index is None else order[s.actor_index],
                'street': 'complete' if not s.status else {0: 'preflop', 3: 'flop', 4: 'turn', 5: 'river'}[board_cursor],
                'stacks': mapped(s.stacks), 'streetCommitted': mapped(s.bets),
                'refunds': mapped(refunds), 'awards': mapped(awards),
                'wager': wager, 'pots': pots}

    results = [snapshot()]
    for action in case['actions']:
        actor = s.actor_index
        assert actor is not None
        assert order[actor] == action['seatId'], 'Independent actor disagreement'
        before = s.bets[actor]
        kind = action['type']
        if kind == 'fold':
            s.fold()
            wager = 0
        elif kind in ('check', 'call'):
            wager = s.check_or_call().amount * unit
        elif kind == 'raise':
            assert action['to'] % unit == 0
            target = action['to'] // unit
            s.complete_bet_or_raise_to(target)
            wager = (target - before) * unit
        else:
            raise AssertionError('Unknown action')
        paid[actor] += wager // unit
        advance()
        results.append(snapshot(wager))
    assert not s.status, f'Fixture did not end: {case["id"]}, actor={s.actor_index}, bets={s.bets}, operations={s.operations[-6:]}'
    return {'id': case['id'], 'snapshots': results, 'administrativeZeroCostChecks': forced_checks}


request = json.load(sys.stdin)
json.dump({'oracle': 'PokerKit', 'version': version('pokerkit'),
           'scope': 'no-rake cash showdown with fixed initial button; exact unit conversion',
           'traces': [trace(case) for case in request['cases']]}, sys.stdout)
