"""Independent dev oracle. No application imports. JSON protocol on stdin/stdout."""
import json
import sys
from importlib.metadata import version
from pokerkit import Automation, Mode, NoLimitTexasHoldem, StandardHighHand

EXPECTED_VERSION = '0.7.7'
assert version('pokerkit') == EXPECTED_VERSION, 'Oracle version mismatch'
AUTOMATIONS = tuple(a for a in Automation if a not in (
    Automation.HOLE_DEALING, Automation.BOARD_DEALING, Automation.CARD_BURNING,
))

def state(stacks):
    return NoLimitTexasHoldem.create_state(AUTOMATIONS, True, 0, (1, 2), 2, stacks, len(stacks), mode=Mode.CASH_GAME)

def board(s, cards, burn):
    s.burn_card(burn)
    s.deal_board(cards)

def short_opening():
    s = state((100, 3, 100))
    for hole in ('AsAc', 'KsKc', 'QsQc'):
        s.deal_hole(hole)
    for _ in range(3):
        s.check_or_call()
    board(s, '2c3d4h', '5s')
    s.check_or_call()  # SB checks.
    s.complete_bet_or_raise_to(1)  # BB's remaining one chip.
    first_min = s.min_completion_betting_or_raising_to_amount
    s.check_or_call()  # BTN calls short opening.
    return {'next_min_raise_to': first_min,
            'prior_checker_min_raise_to': s.min_completion_betting_or_raising_to_amount,
            'prior_checker_can_raise_3': s.can_complete_bet_or_raise_to(3)}

def sidepot():
    # PokerKit positions SB, BB, BTN; application seat IDs mapped separately.
    s = state((200, 300, 100))
    for hole in ('KsKd', 'QsQd', 'AsAd'):
        s.deal_hole(hole)
    actors = [s.actor_index]
    s.complete_bet_or_raise_to(100)
    actors.append(s.actor_index)
    s.complete_bet_or_raise_to(200)
    actors.append(s.actor_index)
    s.check_or_call()
    board(s, '2c4h7s', '3c')
    board(s, '9d', '5c')
    board(s, 'Jc', '6c')
    assert not s.status, 'PokerKit did not settle sidepot'
    return {'stacks_sb_bb_btn': s.stacks, 'actors_sb_bb_btn': actors,
            'payoffs_sb_bb_btn': s.payoffs, 'settled': not s.status}

def folded_tie():
    # Legal 5-handed cash sequence with folded totals 1, 2, 5 and tied live 7, 7.
    s = state((100,) * 5)
    for hole in ('4c5d', '6c7d', '8c9d', 'TcJd', '2c3d'):
        s.deal_hole(hole)
    s.complete_bet_or_raise_to(5)
    s.check_or_call()
    s.check_or_call()
    s.fold()
    s.fold()
    board(s, 'AsKsQs', '2h')
    s.complete_bet_or_raise_to(2)
    s.fold()
    s.check_or_call()
    board(s, 'Js', '3h')
    s.check_or_call()
    s.check_or_call()
    board(s, 'Ts', '4h')
    s.check_or_call()
    s.check_or_call()
    assert not s.status
    return {'stacks_sb_bb_utg_co_btn': s.stacks,
            'payoffs_sb_bb_utg_co_btn': s.payoffs, 'settled': not s.status}

def flop_state(stacks):
    s = state(stacks)
    for hole in ('AsAd', 'KsKd', 'QsQd', 'JsJd')[:len(stacks)]:
        s.deal_hole(hole)
    for _ in stacks:
        s.check_or_call()
    board(s, '2c3d4h', '5c')
    return s

def step2():
    s = flop_state((1000, 1000))
    s.complete_bet_or_raise_to(100)
    s.complete_bet_or_raise_to(260)
    b05 = {'increment': 160, 'next_min_raise_to': s.min_completion_betting_or_raising_to_amount}
    cumulative = []
    for b, c in ((140, 180), (150, 200)):
        s = flop_state((1000, b + 2, c + 2, 1000))
        s.complete_bet_or_raise_to(100)
        s.complete_bet_or_raise_to(b)
        s.complete_bet_or_raise_to(c)
        s.check_or_call()
        cumulative.append({'b': b, 'c': c, 'can_raise': s.can_complete_bet_or_raise_to(c + 100),
                           'next_min_raise_to': s.min_completion_betting_or_raising_to_amount})
    s = state((120, 300, 300, 50))
    for hole in ('KsKd', 'QsQd', 'JhJd', 'AsAd'):
        s.deal_hole(hole)
    s.check_or_call()
    s.complete_bet_or_raise_to(50)
    s.complete_bet_or_raise_to(120)
    s.complete_bet_or_raise_to(300)
    s.check_or_call()
    pots = [{'amount': p.unraked_amount, 'eligible_positions': list(p.player_indices)} for p in s.pots]
    board(s, '2c4h7s', '3c')
    board(s, '9d', '5c')
    board(s, 'Tc', '6c')
    c01 = {'pots': pots, 'stacks_sb_bb_utg_btn': s.stacks, 'settled': not s.status}
    h = state((1000, 1000))
    h.deal_hole('AsAd')
    h.deal_hole('KsKd')
    pre = h.actor_index
    h.check_or_call()
    h.check_or_call()
    board(h, '2c3d4h', '5c')
    hu = {'preflop_position': pre, 'postflop_position': h.actor_index,
          'position_definition': '0=BB/nonbutton,1=SB/button; between-hand selection not modeled'}
    return {'B05': b05, 'B07_B08': cumulative, 'C01_C02': c01, 'heads_up': hu}

def comparisons(request):
    results=[]
    for case in request['cases']:
        a=StandardHighHand.from_game(''.join(case['a']))
        b=StandardHighHand.from_game(''.join(case['b']))
        results.append((a>b)-(a<b))
    return results

request = json.load(sys.stdin)
result = {'oracle':'PokerKit', 'version':EXPECTED_VERSION}
if request['mode'] == 'compare':
    result['comparisons'] = comparisons(request)
elif request['mode'] == 'step2':
    result['step2'] = step2()
elif request['mode'] == 'rules':
    result.update(short_opening=short_opening(), sidepot=sidepot(), folded_tie=folded_tie())
else:
    raise ValueError('Unknown oracle mode')
json.dump(result,sys.stdout)
