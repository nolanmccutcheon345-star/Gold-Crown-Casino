#!/usr/bin/env python3
"""Bind completed browser exports to visible balances and deployed byte evidence.

Run with the separately installed pinned PokerKit 0.7.7 environment. No
application modules are imported, browser records changed or new hands played.
"""
import argparse
import collections
import datetime
import hashlib
import importlib.metadata
import json
import pathlib
import re

from pokerkit import StandardHighHand

if not __debug__:
    raise RuntimeError('Assertions must remain enabled')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--project', required=True)
    parser.add_argument('--verification', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    project = pathlib.Path(args.project)
    output = pathlib.Path(args.output)
    assert not output.exists(), 'Preserve prior evidence'
    base = project / 'TEST_EVIDENCE/step5l/browser'
    verification_path = pathlib.Path(args.verification)
    verified = json.loads(verification_path.read_bytes())
    assert verified['status'] == 'PASS' and verified['hands'] == 105
    assert verified['visibleObservationCheck'] == 'MATCHED_VISIBLE_TOTALS_AND_ACCOUNT_EQUATION'
    exports = [base / f'step5l-public-history-{n:02}.json' for n in range(1, 7)]
    assert [sha(p) for p in exports] == [p['sha256'] for p in verified['inputArtifacts']]
    hands = [h for path in exports for h in json.loads(path.read_bytes())['hands']]
    observed = json.loads((base / 'step5l-visible-observations.json').read_bytes())
    assert sha(base / 'step5l-visible-observations.json') == verified['observationsArtifact']['sha256']
    sessions = []
    for session_id, summary in verified['sessions'].items():
        selected = [h for h in hands if h['sessionId'] == session_id]
        sessions.append({'id': session_id, 'hands': len(selected), 'netCents': summary['netCents'],
                         'handsBySeatCount': dict(collections.Counter(str(len(h['view']['seats'])) for h in selected)),
                         'nineSeatHandNumbers': [h['number'] for h in selected if len(h['view']['seats']) == 9]})
    assert [(s['hands'], s['netCents']) for s in sessions] == [(1, 3792), (104, -65093)]
    assert sessions[1]['handsBySeatCount'] == {'10': 100, '9': 4}
    assert sessions[1]['nineSeatHandNumbers'] == [57, 58, 59, 60]
    assert verified['totalNetCents'] == -61301 and observed['walletCents'] == 938699
    before = (base / 'step5l-cashout-before.txt').read_text()
    after = (base / 'step5l-cashout-after.txt').read_text()
    reloaded = (base / 'step5l-cashout-after-reload.txt').read_text()
    assert 'Available bankroll $9,218.63 · Seated stack $168.36' in before
    for text in [after, reloaded]:
        assert 'No active table.' in text
        assert re.search(r'Available bankroll\s*\n\s*- generic: \$9,386\.99', text)
        assert re.search(r'Lifetime poker result\s*\n\s*- generic: −\$613\.01', text)
        assert text.count('- generic: Wallet +$168.36') == 1
    assert 921863 + 16836 == 938699 == 1000000 - 61301
    final_dom = json.loads((base / 'step5l-native-final-hand.json').read_bytes())
    last = hands[-1]
    assert last['number'] == 104 and last['view']['board'] == ['3s', 'As', '2d', '8c', '6d']
    assert last['net'] == -200 and last['view']['payouts'] == {'6': 500}
    assert last['view']['seats'][0]['stack'] == 16836
    assert '104' in final_dom['summary'] and '−$650.93' in final_dom['summary'] and '−$613.01' in final_dom['summary']
    bb100 = sum(h['net'] / h['view']['profile']['bigBlind'] for h in hands if h['sessionId'] == sessions[1]['id']) / 104 * 100
    assert f'{bb100:.1f}' in final_dom['summary']
    assert importlib.metadata.version('pokerkit') == '0.7.7'
    ranked_pots = []
    uncontested = 0
    for hand in hands:
        view = hand['view']
        for pot_index, pot in enumerate(view['pots']):
            if len(pot['eligible']) == 1:
                assert pot['winners'] == pot['eligible']
                uncontested += 1
                continue
            assert len(view['board']) == 5
            seats = {s['id']: s for s in view['seats']}
            assert all(len(seats[seat]['hole']) == 2 for seat in pot['eligible'])
            ranks = {seat: StandardHighHand.from_game(''.join(seats[seat]['hole'] + view['board'])) for seat in pot['eligible']}
            best = max(ranks.values())
            expected = sorted(seat for seat, rank in ranks.items() if rank == best)
            assert sorted(pot['winners']) == expected, (hand['handId'], pot_index)
            ranked_pots.append({'handId': hand['handId'], 'pot': pot_index, 'amount': pot['amount'], 'winners': expected})
    observations = {}
    artifact_paths = exports + [base / name for name in ['step5l-export-batches.json', 'step5l-visible-observations.json', 'step5l-cashout-before.txt', 'step5l-cashout-after.txt', 'step5l-cashout-after-reload.txt', 'step5l-native-final-hand.json', 'step5l-completed-endurance.png', 'step5l-final-table.png']]
    for name in ['step5l-native-endurance-104.json', 'step5l-native-cashout.json', 'step5l-native-archive-audit.json']:
        path = base / name
        data = json.loads(path.read_bytes())
        artifact_paths.append(path)
        identity = data['identity']
        assert identity['sourceCommit'] == '3ecea1c2b71c8e8b9963547da676171f91f21716'
        assert identity['productionDatabaseAccessed'] is False and identity['applicationBytesChanged'] is False
        recovered_receipt = project / 'tests/step5l-recovery-audit/recovered-release-execution-receipt.json'
        assert sha(recovered_receipt) == identity['executionReceiptSHA256']
        packaging_manifest = project.parent / 'ai-texas-hold-em-r1-test/dist/manifest.json'
        assert sha(packaging_manifest) == identity['manifestSHA256']
        for asset in identity['assets']:
            assert sha(project / asset['source']) == asset['sha256']
        measurements = data['measurements']
        observations[name] = {k: measurements[k] for k in ['startedAt', 'capturedAt', 'browser', 'viewport', 'droppedTimingTrace', 'droppedInteractions', 'droppedLongTasks', 'droppedEventTiming', 'droppedMemorySamples', 'coverage']}
        observations[name]['retainedRaw'] = {k: len(measurements[k]) for k in ['timingTrace', 'interactions', 'longTasks', 'eventTiming', 'memory']}
        observations[name]['selectedPhaseSummaries'] = {k: measurements['timings'][k] for k in ['bot.prepare', 'bot.policy', 'ui.render', 'recovery.canonicalArchiveAudit'] if k in measurements['timings']}
    result = {
        'format': 'step5l-hosted-public-export-independent-review', 'status': 'PASS_WITH_EXPLICIT_SCOPE',
        'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'newHandsPlayedByThisReview': 0,
        'applicationSource': identity['sourceCommit'], 'packagingSource': '566f3b11032841c492e6e148bb9a1139e74247b7',
        'origin': identity['origin'], 'isolatedRun': identity['run'], 'identity': identity,
        'sourceBinding': {'recoveredExecutionReceipt': str(recovered_receipt.relative_to(project)), 'receiptSHA256': sha(recovered_receipt), 'packagingManifestSHA256': sha(packaging_manifest), 'allCompiledAssetsMatch': True},
        'publicVerificationSHA256': sha(verification_path), 'publicVerification': {k: verified[k] for k in ['hands', 'frames', 'events', 'actions', 'totalNetCents', 'totalRakeCents', 'refundHands', 'handsBySeatCount', 'visibleObservationCheck']},
        'sessions': sessions, 'enduranceBBPer100': bb100,
        'cashout': {'walletBeforeCents': 921863, 'tableBeforeCents': 16836, 'walletAfterCents': 938699, 'tableAfterCents': 0, 'postReloadUnchanged': True, 'matchingCashoutRowsInVisibleLedger': 1, 'ledgerIdentityUniquenessIndependentlyProvenFromPublicExport': False},
        'pokerKit': {'version': '0.7.7', 'showdownPotsIndependentlyRanked': len(ranked_pots), 'uncontestedPotsChecked': uncontested, 'rankedPots': ranked_pots},
        'finalHandExample': {'id': last['handId'], 'number': 104, 'board': last['view']['board'], 'netCents': last['net'], 'payouts': last['view']['payouts'], 'rake': last['view']['rake'], 'events': last['view']['events']},
        'observations': observations,
        'artifactHashes': {str(p.relative_to(project)): {'bytes': p.stat().st_size, 'sha256': sha(p)} for p in artifact_paths},
        'reviewScriptSHA256': sha(pathlib.Path(__file__)),
        'limitations': [
            'Actual root browser observations and original exports are reviewed; this script does not drive a browser or create additional played hands.',
            'All six original public export files came through the ordinary View/copy JSON fallback after browser download transport failed. No successful file-download or physical iPhone Files export is claimed.',
            'Source identity binds retained manifest/receipt hashes and identical compiled asset bytes. It does not recover the unavailable original Git commit object.',
            'The 104-hand endurance session includes exactly 100 ten-seat and four nine-seat hands. The earlier separate one-hand session is additional evidence, not part of the 100-hand endurance denominator.',
            'The independent public validator verifies event arithmetic, redaction, hashes, replay frames and payouts. PokerKit independently ranks each contestable showdown using only permitted revealed cards. Public exports omit buy-in/cashout ledger identities and cannot alone prove unique financial event IDs.',
            'Timing summaries cover their stated observation phase, not necessarily every one of the 104 hands. Raw timing/event traces are capped and dropped counts are retained. Browser DOM confirmation is not INP, physical paint, durable commit timing or actual screen-reader speech.',
            'Screenshots document the actual desktop candidate and final table; viewport clipping does not establish complete mobile layout coverage.',
            'This review does not qualify physical devices, VoiceOver, independent new users, hosted CI or R1 release readiness.'
        ]}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'status': result['status'], 'hands': 105, 'enduranceTenSeatHands': 100, 'pokerKitRankedPots': len(ranked_pots), 'uncontestedPots': uncontested, 'walletCents': 938699}))


if __name__ == '__main__':
    main()
