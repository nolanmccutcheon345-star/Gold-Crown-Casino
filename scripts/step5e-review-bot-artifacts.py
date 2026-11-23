"""Independent integer event replay of executed candidate reports, not unit count.

No application engine, evaluator, statistics projection or bot module is imported.
Every output belongs to the retained input receipt and names this reviewer source.
"""
import argparse
import gzip
import hashlib
import json
import random
import statistics
import subprocess
from datetime import datetime, timezone
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('receipt')
parser.add_argument('output')
args = parser.parse_args()
root = Path.cwd()
base = (root / args.receipt).parent
out = root / args.output
assert out.resolve().is_relative_to(root / 'tests/step5e-gates/evidence')
hashes = {}


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read(path):
    path = Path(path)
    hashes[str(path.relative_to(root))] = sha(path)
    return json.loads(gzip.decompress(path.read_bytes()) if path.suffix == '.gz' else path.read_bytes())


def opening(hand, seat, after_blinds):
    stack = next(s['stack'] for s in hand['initial'] if s['id'] == seat)
    return stack + (sum(e.get('amount', 0) for e in hand['events'] if e['type'] == 'blind' and e['seatId'] == seat) if after_blinds else 0)


def replay(hand, after_blinds=False):
    balances = {s['id']: opening(hand, s['id'], after_blinds) for s in hand['initial']}
    ids, decisions = set(), set()
    paid = returned = awarded = rake = 0
    for event in hand['events']:
        assert event['id'] not in ids, 'Duplicate event ID'
        ids.add(event['id'])
        if event['type'] == 'action':
            assert event['decisionId'] not in decisions, 'Duplicate betting decision'
            decisions.add(event['decisionId'])
        amount = event.get('amount', 0)
        assert isinstance(amount, int) and amount >= 0, 'Invalid integer money'
        if event['type'] in ('blind', 'action'):
            paid += amount
            balances[event['seatId']] -= amount
        if event['type'] in ('refund', 'award'):
            balances[event['seatId']] += amount
            if event['type'] == 'refund':
                returned += amount
            else:
                awarded += amount
        if event['type'] == 'rake':
            rake += amount
        assert all(value >= 0 for value in balances.values()), 'Negative running stack'
    assert paid - returned == awarded + rake, 'Pot accounting mismatch'
    assert all(balances[s['id']] == s['stack'] for s in hand['final']), 'Final stack mismatch'
    assert sum(balances.values()) + rake == sum(opening(hand, s['id'], after_blinds) for s in hand['initial']), 'Chip conservation mismatch'
    return len(decisions)


manifest = read(root / args.receipt)
assert manifest['status'] == 'PASS'
source = manifest['sourceCommit']
for path, expected in manifest['buildHashes'].items():
    assert sha(root / path) == expected, 'Compiled bytes changed'
main = read(base / 'current-benchmark-summary.json')
paired = read(base / 'paired-reference/current-benchmark-summary.json')
assert main['sourceCommit'] == paired['sourceCommit'] == source
assert main['full'] and not main['paired'] and main['totalHands'] == 4032
assert paired['full'] and paired['paired'] and paired['totalHands'] == 1344
records, negative, actions = {}, [], 0
for tag, summary, directory in [('main', main, base), ('paired', paired, base / 'paired-reference')]:
    for row in summary['summary']:
        raw = read(directory / row['rawArtifact'])
        assert len(raw) == row['outcome']['hands'] == 96
        assert row['outcome']['blocks'] == 8 and sorted({h['block'] for h in raw}) == list(range(8))
        for hand in raw:
            actions += replay(hand, True)
        mean = statistics.mean((next(s['stack'] for s in h['final'] if s['id'] == 1) - opening(h, 1, True)) / h['profile']['bigBlind'] for h in raw)
        assert abs(mean - row['outcome']['meanBBPerHand']) < 1e-12
        records[(row['cell']['name'], row['reference'])] = raw
        if mean < 0:
            negative.append({'cohort': tag, 'cell': row['cell']['name'], 'reference': row['reference'], 'N': 96, 'blocks': 8, 'meanBBPerHand': mean, 'descriptive95': row['outcome']['blockBootstrap95']})
assert actions == main['totalActions'] + paired['totalActions']
matched, comparisons = 0, []
for row in paired['summary']:
    cell, ref = row['cell']['name'], row['reference']
    target = 'hu100' if cell == 'paired-hu100-rake' else 'loose625'
    left, right = records[(target, ref)], records[(cell, ref)]
    for a, b in zip(left, right):
        assert all(a[k] == b[k] for k in ['seed', 'block', 'button', 'initial'])
        assert a['profiles'][1] == b['profiles'][1]
        assert a['profiles'] == b['profiles'] if cell == 'paired-hu100-rake' else a['profile'] == b['profile']
        matched += 1
    def net(rows, block):
        return statistics.mean((next(s['stack'] for s in h['final'] if s['id'] == 1) - opening(h, 1, True)) / h['profile']['bigBlind'] for h in rows if h['block'] == block)
    deltas = [net(right, block) - net(left, block) for block in range(8)]
    rng = random.Random(517610)
    draws = sorted(statistics.mean(rng.choices(deltas, k=8)) for _ in range(2000))
    comparisons.append({'treatment': cell, 'control': target, 'reference': ref, 'N': 96, 'blocks': 8, 'blockDeltasBBPerHand': deltas, 'meanDeltaBBPerHand': statistics.mean(deltas), 'independentDescriptiveBootstrap95': [draws[49], draws[1949]]})
assert matched == 1344
ecology = read(base / 'Y10-ecology.json')
assert ecology['sourceCommit'] == source and ecology['full'] and ecology['totalHands'] == 800
ecology_hands, ecology_actions, nine = 0, 0, []
for row in ecology['rows']:
    raw = read(base / row['artifact'])
    counts = {}
    for hand in raw['records']:
        ecology_actions += replay(hand)
        ecology_hands += 1
        for event in hand['events']:
            if event['type'] == 'action':
                counts[event['seatId']] = counts.get(event['seatId'], 0) + 1
    if row['cell'] == 'mixed-nine':
        assert len(counts) == 9 and all(counts.values()) and row['stackStates'] == 50
        nine.append({'block': row['block'], 'hands': row['hands'], 'actionsBySeat': counts, 'stackStates': row['stackStates']})
assert ecology_hands == 800 and ecology_actions == ecology['actions'] and len(nine) == 8
composition = read(base / 'composition-summary.json')
blocks = read(base / 'composition-blocks.json.gz')
assert composition['sourceCommit'] == source and composition['full'] and composition['completedHands'] == 960
assert len(composition['summaries']) == 6 and len(blocks) == 48
composition_hands = composition_actions = 0
for block in blocks:
    assert block['hands'] == len(block['records']) == 20
    for hand in block['records']:
        composition_actions += replay({**hand, 'final': hand['ending']}, True)
        composition_hands += 1
assert composition_hands == 960 and composition_actions == composition['decisions']
reviewer = Path(__file__).resolve()
result = {'kind': 'independent-integer-event-review-not-unit-test-count', 'sourceCommit': source, 'sourceReceipt': args.receipt, 'sourceReceiptSHA256': sha(root / args.receipt), 'reviewerSource': str(reviewer.relative_to(root)), 'reviewerSHA256': sha(reviewer), 'reviewerCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(), 'at': datetime.now(timezone.utc).isoformat(), 'main': {'hands': 4032, 'actions': main['totalActions']}, 'paired': {'hands': 1344, 'actions': paired['totalActions'], 'exactInputMatches': matched, 'comparisons': comparisons}, 'ecology': {'independentlyReplayedHands': ecology_hands, 'actions': ecology_actions}, 'nineSeatEcology': nine, 'composition': {'independentlyReplayedHands': composition_hands, 'actions': composition_actions}, 'replayedHands': 4032 + 1344 + ecology_hands + composition_hands, 'replayedFinancialFailures': 0, 'rawSHA256': hashes, 'negativeOutcomeCells': negative, 'limits': ['These are independent sums of actual emitted events, not independently solved poker eligibility or solver strategy.', 'Shared evaluation remains covered by separate PokerKit comparisons.', 'Paired seeded cases reuse baseline inputs; not a fresh blind holdout.', 'Intervals use eight synthetic clusters, unadjusted for many comparisons.', 'No expert, human calibration, physical-device or profitability evidence.']}
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'source': source, 'independentlyReplayedHands': result['replayedHands'], 'matchedPairs': matched, 'financialFailures': 0, 'output': args.output}))
