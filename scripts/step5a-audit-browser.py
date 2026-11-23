"""Independent arithmetic on downloaded public UI histories; no engine imports.

The endurance files deliberately omit replay frames. They are accounting audit
artifacts, not importable history exports or a substitute for hidden-deck tests.
"""
import json
import sys
import hashlib
from collections import Counter
from pathlib import Path

reports = []
for filename in sys.argv[1:]:
    history = json.loads(Path(filename).read_text())
    hands = history['hands']
    assert len({hand['handId'] for hand in hands}) == len(hands)
    totals = Counter()
    previous_hash = '0' * 64
    for hand in hands:
        view = hand['view']
        seats = {seat['id']: seat for seat in view['seats']}
        stacks = {key: seat['startingStack'] for key, seat in seats.items()}
        committed, awards = Counter(), Counter()
        paid = refunded = rake = 0
        events = view['events']
        assert len({event['id'] for event in events}) == len(events)
        decisions = [event['decisionId'] for event in events if event.get('decisionId')]
        assert len(decisions) == len(set(decisions)), hand['handId']
        for event in events:
            amount = event.get('amount', 0)
            assert isinstance(amount, int) and amount >= 0
            kind, seat_id = event['type'], event.get('seatId')
            if kind in ('blind', 'action'):
                stacks[seat_id] -= amount
                committed[seat_id] += amount
                paid += amount
                assert stacks[seat_id] >= 0
            elif kind == 'refund':
                stacks[seat_id] += amount
                committed[seat_id] -= amount
                refunded += amount
            elif kind == 'award':
                stacks[seat_id] += amount
                awards[seat_id] += amount
            elif kind == 'rake':
                rake += amount
        for seat_id, seat in seats.items():
            assert stacks[seat_id] == seat['stack'], (hand['handId'], seat_id)
            assert committed[seat_id] == seat['totalCommitted']
            assert awards[seat_id] == view['payouts'].get(str(seat_id), 0)
        assert paid - refunded == sum(awards.values()) + rake
        assert sum(stacks.values()) + rake == sum(seat['startingStack'] for seat in seats.values())
        assert rake == view['rake']
        assert sum(pot['amount'] for pot in view['pots']) == paid - refunded
        assert hand['net'] == seats[0]['stack'] - seats[0]['startingStack']
        cards = view['board'] + [card for seat in seats.values() for card in seat.get('hole', []) if card]
        assert len(cards) == len(set(cards)), hand['handId']
        for pot in view['pots']:
            assert set(pot['winners']) <= set(pot['eligible'])
            assert all(not seats[winner]['folded'] for winner in pot['winners'])
        if 'frames' in hand:
            assert hand['previousHash'] == previous_hash
            body = {key: value for key, value in hand.items() if key != 'hash'}
            encoded = json.dumps(body, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()
            assert hashlib.sha256(encoded).hexdigest() == hand['hash']
            previous_hash = hand['hash']
            assert hand['frames'][-1] == view
            for frame in hand['frames']:
                assert frame['board'] == view['board'][:len(frame['board'])]
                if frame['street'] != 'complete':
                    assert all(not seat['hole'] for seat in frame['seats'] if seat['id'] != 0)
            forbidden = {'deck', 'deckCursor', 'burned', 'privateProfiles', 'traits', 'seed',
                         'memory', 'drawToken', 'archetype', 'policyVersion', 'diagnostics'}
            def verify_public(value):
                if isinstance(value, dict):
                    assert not forbidden.intersection(value)
                    for item in value.values():
                        verify_public(item)
                elif isinstance(value, list):
                    for item in value:
                        verify_public(item)
            verify_public(hand)
            totals['replayBearingRecords'] += 1
        totals.update(hands=1, actions=len(decisions), paidCents=paid,
                      returnedCents=refunded, rakeCents=rake,
                      awardedCents=sum(awards.values()), heroNetCents=hand['net'],
                      refundHands=int(refunded > 0), sidePotHands=int(len(view['pots']) > 1),
                      splitHands=int(any(len(pot['winners']) > 1 for pot in view['pots'])))
    reports.append({'file': filename, 'status': 'PASS', **dict(totals)})
print(json.dumps({'status': 'PASS', 'scope': 'Independent public-event arithmetic, IDs, visible cards and eligibility; when frames exist, SHA256 chain, final-frame equality, board prefixes and hidden-card redaction. No hidden-deck or strategy-equity claim.', 'files': reports}, indent=2))
