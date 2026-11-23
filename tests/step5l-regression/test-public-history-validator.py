#!/usr/bin/env python3
"""Reproducible validator self-test using retained historical browser evidence.

This does not execute a browser or produce new poker hands.
"""
import argparse
import copy
import datetime
import hashlib
import importlib.util
import json
import pathlib

ROOT = pathlib.Path(__file__).parent
SPEC = importlib.util.spec_from_file_location('public_check', ROOT / 'verify-public-history.py')
CHECK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECK)
FIXTURES = ROOT / 'evidence/public-validator'


def sync_final(hand):
    hand['frames'][-1] = copy.deepcopy(hand['view'])


def mutate(data, case):
    hand = data['hands'][1]
    if case == 'bad-hash':
        hand['hash'] = 'f' * 64
    elif case == 'duplicate-hand':
        data['hands'].append(copy.deepcopy(hand))
    elif case == 'duplicate-decision':
        actions = [e for e in hand['view']['events'] if e['type'] == 'action']
        actions[1]['decisionId'] = actions[0]['decisionId']
        for frame in hand['frames']:
            frame['events'] = copy.deepcopy(hand['view']['events'][:len(frame['events'])])
    elif case == 'wrong-net':
        hand['net'] += 1
    elif case == 'wrong-ending':
        hand['view']['seats'][0]['stack'] += 1
        sync_final(hand)
    elif case == 'wrong-payout':
        key = next(iter(hand['view']['payouts']))
        hand['view']['payouts'][key] += 1
        sync_final(hand)
    elif case == 'premature-card':
        next(s for s in hand['frames'][0]['seats'] if s['id'] != 0)['hole'] = ['As', 'Kh']
    elif case == 'private-parameter':
        data['personalitySeed'] = 'must-not-be-exported'
    elif case == 'wrong-replay-board':
        hand['frames'][0]['board'] = ['As']
    else:
        raise AssertionError(case)
    if case != 'bad-hash':
        CHECK.reseal(data)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    target = pathlib.Path(args.output)
    assert not target.exists(), 'Choose a new evidence path; preserve previous execution'
    history = CHECK.load(FIXTURES / 'historical-upgrade-history.json')
    observations = CHECK.load(FIXTURES / 'historical-visible-observations.json')
    result = CHECK.validate([history], observations)
    assert (result['hands'], result['frames'], result['events'], result['actions'], result['totalNetCents']) == (2, 11, 21, 9, 318)
    assert result['handsBySeatCount'] == {'2': 2}
    assert result['visibleObservationCheck'] == 'MATCHED_VISIBLE_TOTALS_AND_ACCOUNT_EQUATION'
    batches = []
    for hand in history['hands']:
        batch = copy.deepcopy(history)
        batch['hands'] = [copy.deepcopy(hand)]
        CHECK.reseal(batch)
        batches.append(batch)
    assert CHECK.validate(batches, observations)['totalNetCents'] == 318
    cases = ['bad-hash', 'duplicate-hand', 'duplicate-decision', 'wrong-net', 'wrong-ending', 'wrong-payout', 'premature-card', 'private-parameter', 'wrong-replay-board', 'wrong-wallet']
    rejected = []
    for case in cases:
        data = copy.deepcopy(history)
        observed = copy.deepcopy(observations)
        if case == 'wrong-wallet':
            observed['walletCents'] += 1
        else:
            mutate(data, case)
        try:
            CHECK.validate([data], observed)
        except AssertionError:
            rejected.append({'case': case, 'status': 'REJECTED'})
        else:
            raise AssertionError(f'Accepted corruption: {case}')
    output = {
        'format': 'step5l-public-validator-self-test', 'status': 'PASS',
        'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'positiveChecks': ['historical two-hand export, 11 frames and 318-cent result', 'historical observed cashout wallet 1000318 cents and empty table', 'two independent public batch hash chains'],
        'corruptionChecks': rejected,
        'validatorSHA256': hashlib.sha256((ROOT / 'verify-public-history.py').read_bytes()).hexdigest(),
        'selfTestSHA256': hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
        'fixtures': {str(f): hashlib.sha256(f.read_bytes()).hexdigest() for f in FIXTURES.glob('historical-*.json') if 'verification' not in f.name},
        'scope': 'Validator self-test using retained historical browser exports. No new browser hands and no result for the forthcoming Step 5L export.'}
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(output, indent=2) + '\n')
    print(json.dumps({'status': 'PASS', 'positiveChecks': 3, 'corruptionsRejected': len(rejected)}))


if __name__ == '__main__':
    main()
