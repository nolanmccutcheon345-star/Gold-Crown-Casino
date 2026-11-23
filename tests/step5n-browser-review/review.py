#!/usr/bin/env python3
"""Independent review of actual hosted public exports and numeric observations.

No application modules, browser control, hand generation or private game state.
"""
import argparse
import collections
import datetime
import hashlib
import importlib.metadata
import importlib.util
import json
import math
import pathlib
import subprocess

from pokerkit import StandardHighHand

if not __debug__:
    raise RuntimeError('Assertions must remain enabled')

APPLICATION = '3ecea1c2b71c8e8b9963547da676171f91f21716'
PACKAGE = '566f3b11032841c492e6e148bb9a1139e74247b7'
PHASES = ['gameplay-2-first', 'gameplay-6-first',
          'gameplay-6-second', 'gameplay-10-first', 'gameplay-10-second',
          'recovered-hand-complete']


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def summary(values):
    if not values:
        return {'count': 0}
    values = sorted(values)
    return {'count': len(values), 'p50': values[math.ceil(len(values) * .5) - 1],
            'p95': values[math.ceil(len(values) * .95) - 1],
            'p99': values[math.ceil(len(values) * .99) - 1], 'maximum': values[-1]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--project', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    project, output = pathlib.Path(args.project), pathlib.Path(args.output)
    assert not output.exists(), 'Preserve previous review evidence'
    base = project / 'tests/step5n-browser/evidence'
    used = set()

    def read(name):
        path = base / name
        used.add(path)
        return json.loads(path.read_bytes())

    legacy = project / 'tests/step5l-regression/verify-public-history.py'
    spec = importlib.util.spec_from_file_location('independent_public_history', legacy)
    verifier = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(verifier)
    payload = read('step5n-public-history.json')
    public = verifier.validate([payload])
    assert public['hands'] == 7 and public['totalNetCents'] == -9334
    assert public['handsBySeatCount'] == {'2': 2, '6': 2, '10': 3}
    assert [(s['hands'], s['netCents']) for s in public['sessions'].values()] == [(2, -500), (2, -699), (3, -8135)]
    observations = read('step5n-hand-observations.json')
    assert len(observations) == len(payload['hands'])
    for observed, hand in zip(observations, payload['hands']):
        assert observed['seats'] == len(hand['view']['seats'])
        assert f"Hand {hand['number']}. Hand settled." in observed['final']
        assert f"Your stack ${hand['view']['seats'][0]['stack']/100:.2f}." in observed['final']

    receipt_path = project / 'tests/step5l-recovery-audit/recovered-release-execution-receipt.json'
    receipt = json.loads(receipt_path.read_bytes())
    packaging_manifest = project.parent / 'ai-texas-hold-em-r1-test/dist/manifest.json'
    expected_identity = None

    def observation(name):
        nonlocal expected_identity
        data = read('step5n-' + name + '.json')
        identity = data['identity']
        assert identity['sourceCommit'] == APPLICATION
        assert identity['origin'] == 'https://ai-texas-hold-em-r1-test.stevemccutcheon89.chatgpt.site'
        assert identity['productionDatabaseAccessed'] is False and identity['applicationBytesChanged'] is False
        assert identity['executionReceiptSHA256'] == sha(receipt_path)
        assert identity['manifestSHA256'] == sha(packaging_manifest)
        assert {asset['source']: asset['sha256'] for asset in identity['assets']} == receipt['buildHashes']
        for asset in identity['assets']:
            assert sha(project / asset['source']) == asset['sha256']
        if expected_identity is None:
            expected_identity = identity
        else:
            assert identity == expected_identity, 'Different candidate/origin/run mixed into review'
        return data['measurements']

    before = observation('active-before')
    after = observation('active-after')
    assert before['publicDisplay'] == after['publicDisplay'], 'Paused visible state differs after reload'
    assert before['publicDisplay']['street'] == 'PREFLOP'
    assert before['publicDisplay']['pot'] == '$8.73'
    assert before['publicDisplay']['wallet'] == '$9,788.01'
    assert before['publicDisplay']['tableStack'] == '$124.38'
    assert 'Table paused' in before['publicDisplay']['announcement']
    phases, previous_end = {}, None
    for name in PHASES:
        measurement = observation(name)
        start = datetime.datetime.fromisoformat(measurement['startedAt'].replace('Z', '+00:00'))
        end = datetime.datetime.fromisoformat(measurement['capturedAt'].replace('Z', '+00:00'))
        assert start <= end
        if previous_end is not None:
            assert previous_end <= start, 'Overlapping phases cannot be aggregated'
        previous_end = end
        selected = {k: v for k, v in measurement['timings'].items()
                    if k in ['bot.prepare', 'bot.policy', 'ui.render', 'persistence.transaction',
                             'persistence.commit', 'recovery.fastRestore', 'history.browse',
                             'recovery.canonicalArchiveAudit']}
        raw_agreement = {}
        for key, values in selected.items():
            assert values['count'] == values['retained'] + values['dropped']
            if values['dropped'] == 0:
                assert values['quantileScope'] == 'All observed samples; nearest-rank quantiles.'
            if measurement['droppedTimingTrace'] == 0:
                actual = summary([e['milliseconds'] for e in measurement['timingTrace'] if e['name'] == key])
                assert actual['count'] == values['count'], (name, key, 'raw count')
                for metric in ['p50', 'p95', 'p99', 'maximum']:
                    if actual['count']:
                        assert abs(actual[metric] - values[metric]) < 1e-7, (name, key, metric)
                raw_agreement[key] = True
        lower = measurement['measurementStartTime']
        events = [e for e in measurement['eventTiming'] if e['startTime'] >= lower]
        longs = [e for e in measurement['longTasks'] if e['startTime'] >= lower]
        interactions = measurement['interactions']
        phases[name] = {
            'startedAt': measurement['startedAt'], 'capturedAt': measurement['capturedAt'],
            'selectedSummaries': selected,
            'rawTimingSummaryIndependentlyMatched': raw_agreement,
            'dropped': {k: v for k, v in measurement.items() if k.startswith('dropped')},
            'retainedRaw': {k: len(measurement[k]) for k in ['timingTrace', 'longTasks', 'eventTiming', 'interactions', 'memory']},
            'phaseLongTaskMs': summary([e['duration'] for e in longs]),
            'eventTimingOutsidePhase': len(measurement['eventTiming']) - len(events),
            'phaseEventHandlerMs': summary([e['processingEnd'] - e['processingStart'] for e in events]),
            'trustedVisibleConfirmationProxyMs': summary([e['visibleAfterMs'] for e in interactions if e['trusted'] and e.get('visibleAfterMs') is not None]),
            'heapSamples': measurement['memory'], 'publicDisplay': measurement['publicDisplay'],
            'coverage': measurement['coverage'],
        }
    reloads = {}
    for number in range(1, 3):
        m = observation(f'reload-empty-{number}')
        reloads[str(number)] = {k: m[k] for k in ['startedAt', 'capturedAt', 'firstPublicUIDOMMs', 'savedIndicatorDOMMs', 'publicDisplay']}
        reloads[str(number)]['timings'] = {k: v for k, v in m['timings'].items() if k.startswith('recovery.') or k == 'persistence.load'}

    audit_path = base / 'step5n-audit-cashout.txt'
    cashout_reload_path = base / 'step5n-cashout-after-reload.txt'
    used.update([audit_path, cashout_reload_path])
    audit_text, reloaded_text = audit_path.read_text(), cashout_reload_path.read_text()
    for text in [audit_text, reloaded_text]:
        assert 'No active table.' in text
        assert 'Available bankroll\n$9,906.66' in text
        assert 'Seated stack\n$0' in text
        assert 'Lifetime poker result\n−$93.34' in text
        assert text.count('Wallet +$118.65') == 1
        assert text.count('Wallet +$193.01') == 1
        assert text.count('Wallet +$195\n') == 1
        assert text.count('Wallet −$200') == 3
    assert 'Verified 7 hands and bankroll $9,906.66 at saved revision 344.' in audit_text
    assert 'Initial virtual bankroll\nWallet +$10,000\nTable $0\nPoker $0' in audit_text
    assert audit_text.count('\nHand Net\n') == 7 and audit_text.count('\nAdjustment\n') == 1
    assert 1000000 - 3 * 20000 + 19500 + 19301 + 11865 == 990666 == 1000000 + public['totalNetCents']
    public = verifier.validate([payload], {
        'evidence': [str(audit_path.relative_to(project)), str(cashout_reload_path.relative_to(project))],
        'totalHands': 7, 'totalPokerNetCents': -9334, 'completeCanonicalHistory': True,
        'initialWalletCents': 1000000, 'manualAdjustmentCents': 0,
        'walletCents': 990666, 'tableCents': 0,
    })

    assert importlib.metadata.version('pokerkit') == '0.7.7'
    ranked, uncontested = [], 0
    for hand in payload['hands']:
        view = hand['view']
        for index, pot in enumerate(view['pots']):
            if len(pot['eligible']) == 1:
                assert pot['winners'] == pot['eligible']
                uncontested += 1
                continue
            seats = {seat['id']: seat for seat in view['seats']}
            assert len(view['board']) == 5
            assert all(len(seats[s]['hole']) == 2 for s in pot['eligible'])
            ranks = {s: StandardHighHand.from_game(''.join(seats[s]['hole'] + view['board'])) for s in pot['eligible']}
            best = max(ranks.values())
            winners = sorted(s for s, rank in ranks.items() if rank == best)
            assert sorted(pot['winners']) == winners
            ranked.append({'handId': hand['handId'], 'pot': index, 'amount': pot['amount'], 'winners': winners})

    result = {
        'format': 'step5n-independent-hosted-review', 'status': 'PASS_WITH_EXPLICIT_SCOPE',
        'reviewedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'reviewSourceCommit': subprocess.check_output(['git', '-C', str(project), 'rev-parse', 'HEAD'], text=True).strip(),
        'hostedApplication': APPLICATION, 'hostedPackaging': PACKAGE, 'identity': expected_identity,
        'publicExportVerification': public, 'actualObservedHands': len(observations),
        'newHandsPlayedByReviewer': 0,
        'pokerKit': {'version': '0.7.7', 'rankedPots': ranked, 'uncontestedPots': uncontested},
        'pausedReload': {'visibleFieldsExactlyEqual': True, 'before': before['publicDisplay'], 'after': after['publicDisplay'], 'limits': 'Public UI equality; private deck equality is not inspected.'},
        'cashoutAccounting': {'initialWalletCents': 1000000, 'buyInsCents': [20000, 20000, 20000], 'cashoutsCents': [19500, 19301, 11865], 'finalWalletCents': 990666, 'finalTableCents': 0, 'netPokerCents': -9334, 'afterReloadBalancesUnchanged': True, 'visibleCashoutRowsExactlyOneEach': True, 'hostedFullHistoryAudit': 'Verified7hands at revision344, save unchanged', 'financialEventIdentityProvenByPublicExport': False},
        'disjointGameplayPhases': phases, 'emptyAccountWarmCacheReloads': reloads,
        'gameplayBotPreparationsObserved': sum(p['selectedSummaries'].get('bot.prepare', {}).get('count', 0) for p in phases.values()),
        'aggregateBotPreparationQuantiles': 'NOT_COMPUTED; phase summaries retained, not combined percentile values.',
        'excludedOverlappingCapture': 'step5n-active-before.json overlaps gameplay-10-second and includes start of hand3; excluded from aggregate sample counts.',
        'unretainedCaptures': ['step5n-gameplay-2-second.json', 'step5n-reload-empty-3.json'],
        'unretainedCaptureBoundary': 'Operator reported observation summaries but complete files were not retained. Excluded from independently verified timing counts and distributions; no synthetic replacement file created.',
        'sourceBinding': {'receiptSHA256': sha(receipt_path), 'packagingManifestSHA256': sha(packaging_manifest), 'allCompiledAssetsMatch': True},
        'artifactHashes': {str(p.relative_to(project)): {'bytes': p.stat().st_size, 'sha256': sha(p)} for p in sorted(used)},
        'scriptSHA256': sha(pathlib.Path(__file__)), 'publicValidatorSHA256': sha(legacy),
        'limits': [
            'Review consumes real root browser artifacts; it does not create extra gameplay, drive a browser, or provide physical-device evidence.',
            'Every original export hash, public redaction, frame/event arithmetic, chip conservation, pot payout, rake and revealed-hand rank is checked independently.',
            'Public export omits buy-in/cashout financial-ledger IDs; duplicate cashout identity cannot be proven from it alone.',
            'Phase preparation counts cover those disjoint intervals, not necessarily every preparation of every completed hand; pre-reload hand3 activity in an overlapping capture is excluded.',
            'DOM-visible confirmation is not physical paint, durable commit, INP or keyboard/screen-reader speech. Buffered EventTiming entries predating a phase are excluded from that phase handler summary.',
            'Reloads use a warm browser cache and almost empty history. They do not establish cold-cache startup, 10000-hand native browser memory, or mobile-device performance.',
            'Long tasks and coarse heap samples retain their observed scope. No forced GC, retained-object attribution or native origin-storage estimate is inferred.',
            'Historical10.07second stall remains unattributed; seven hands and these samples cannot demonstrate absence of rare stalls.',
            'Test-driver waiting limits are not measured browser stalls. No physical-device, VoiceOver, independent-human, GitHub-CI or R1-ready result is inferred.'
        ]}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'status': result['status'], 'hands': 7, 'netCents': public['totalNetCents'], 'rankedPots': len(ranked), 'uncontestedPots': uncontested, 'preparationSamples': result['gameplayBotPreparationsObserved']}))


if __name__ == '__main__':
    main()
