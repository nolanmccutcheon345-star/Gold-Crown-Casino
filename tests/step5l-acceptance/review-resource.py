"""Qualify only U12's completed resource experiment, not Z14 performance claims.
The executed uncommitted harness is identified by immutable bytes, separately
from the repository baseline and its later archival commit.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--archive-commit', required=True)
args = parser.parse_args()
base_path = 'TEST_EVIDENCE/step5h/step5l-release/manifest.json'
directory = Path('tests/step5l-resource/evidence/full-10000')
output = Path('tests/step5l-acceptance/resource-qualified-review.json')
read = lambda p: Path(p).read_bytes()
sha = lambda p: hashlib.sha256(read(p)).hexdigest()
j = lambda p: json.loads(read(p))
git = lambda commit, path: subprocess.check_output(['git', 'show', f'{commit}:{path}'])
base = j(base_path)
subprocess.run(['python3', 'tests/step5l-resource/artifacts.py', 'restore', str(directory)], check=True, capture_output=True)
source = j(directory / 'source.json')
report = j(directory / '0-report.json')
execution = j(directory / 'execution-receipt.json')
independent = j(directory / 'independent-archive-verification.json')
verified = j(directory / 'resource-verification.json')
harness_review = j('tests/step5l-regression/resource-harness-review.json')
assert base['status'] == report['status'] == execution['status'] == independent['status'] == verified['status'] == 'PASS'
assert execution['code'] == 0 and execution['signal'] is None and execution['finished']
assert source['initialHands'] == report['initialHands'] == 0
assert source['goalHands'] == report['goalHands'] == report['completedHands'] == independent['canonicalHands'] == 10000
assert verified['checkCount'] == 9 and all(c['status'] == 'PASS' for c in verified['checks'])
assert report['source'] == source and execution['sourceSHA256'] == verified['sourceSHA256'] == sha(directory / 'source.json')
assert verified['reportSHA256'] == sha(directory / '0-report.json')
assert verified['independentVerificationSHA256'] == sha(directory / 'independent-archive-verification.json')
assert source['applicationCommit'] == independent['applicationCommit'] == '3ecea1c2b71c8e8b9963547da676171f91f21716'
assert source['bundleSHA256'] == sha(directory / 'profile.mjs.bin')
# Explicit later archival Git identity verifies retained bytes, not the execution date.
for path in ['tests/step5l-resource/profile.ts', str(directory / 'source.json'), str(directory / '0-report.json'), str(directory / 'execution-receipt.json'), str(directory / 'independent-archive-verification.json'), str(directory / 'resource-verification.json')]:
    assert hashlib.sha256(git(args.archive_commit, path)).hexdigest() == sha(path)
production = {p: h for p, h in source['files'].items() if p.startswith('src/')}
assert len(production) == 94
for path, digest in production.items():
    assert base['sourceHashes'][path] == digest == sha(path)
    assert hashlib.sha256(git(base['sourceCommit'], path)).hexdigest() == digest
assert harness_review['verifiedInputs']['sourceMapGetterOnly']
for path, value in harness_review['reviewedHashes'].items():
    assert sha(path) == value['sha256']
# Recheck source-map contents ourselves. Only the documented test-only size getter
# may differ from original production text; it cannot change decisions or state.
source_map = j(directory / 'profile.mjs.bin.map')
telemetry = source['testOnlyRangeTelemetry']
assert telemetry == "\nObject.defineProperty(globalThis,'__resourceRangeCache',{value:()=>({shape:shapeCache.size,analysis:analysisCache.size})});\n"
for path, digest in source['files'].items():
    assert sha(path) == digest
    matches = [text for name, text in zip(source_map['sources'], source_map['sourcesContent']) if name.endswith('/' + path)]
    if not matches:
        assert path == 'src/core/replay.ts'  # Imported but tree-shaken from this bundle.
        continue
    assert len(matches) == 1
    text = matches[0]
    if path == 'src/bots/ranges.ts':
        assert text.endswith(telemetry)
        text = text[:-len(telemetry)]
    assert hashlib.sha256(text.encode()).hexdigest() == digest
assert report['maximumTimers'] == 1 and report['timersAfterClose'] == 0
points = report['resourceCheckpoints']
assert points[0]['completedHands'] == 0 and points[-1]['completedHands'] == 10000
assert {0, 100, *range(1000, 10001, 1000)} <= {p['completedHands'] for p in points}
for point in points:
    assert point['naturalMemory']['heapUsed'] > 0 and point['postGCMemory']['heapUsed'] > 0
    assert point['liveTimers'] == 1 and point['cache']['shape'] <= 4 and point['cache']['analysis'] <= 8
    groups = point['storage']['groups']
    assert groups.get('canonicalHands', {}).get('records', 0) == point['completedHands']
    assert groups.get('packedHandReplicas', {}).get('records', 0) <= 120
    assert groups.get('checkpointGenerations', {}).get('records', 0) <= 2
    assert groups.get('incrementalJournal', {}).get('records', 0) <= 126
assert independent['independentCanonicalHashChains'] and independent['independentBigIntEventReplay'] and independent['exactCheckpointAndFullArchiveAgreement']
assert report['financialAndStatisticsFullReplayAgreement']
assert report['finalCompactAccount'] == independent['financial']
financial = independent['financial']
assert financial['table'] == 0 and financial['wallet'] == financial['manual'] + financial['poker']
assert report['decisions'] == report['ordinaryPreparation']['samples'] == 74117
assert len(report['reloads']) == 74 and all(r['pendingStable'] for r in report['reloads'])
# Independently count unique canonical hands/indices and extract exact applied
# rule/policy versions for V620; no hidden cards are copied into this review.
keys, hand_ids, indices, rules, policies = set(), set(), set(), {}, set()
with gzip.open(directory / 'canonical-segments.jsonl.gz', 'rt') as stream:
    for line in stream:
        row = json.loads(line)
        assert row['key'] not in keys
        keys.add(row['key'])
        if not row['key'].startswith('v2:hands:'):
            continue
        segment, hand = row['value'], row['value']['value']
        index = int(row['key'].split(':')[-1])
        assert segment['index'] == index and index not in indices and hand['id'] not in hand_ids
        indices.add(index)
        hand_ids.add(hand['id'])
        profile = hand['view']['profile']
        version = profile['id'] + '@' + profile['version']
        rules[version] = profile
        for bot in hand.get('privateProfiles', {}).values():
            policies.add(bot['policyVersion'])
assert indices == set(range(10000)) and len(hand_ids) == 10000 and len(keys) == independent['storageRecords'] == 20979
parts = j(directory / 'archive-parts.json')
assert hashlib.sha256(git(args.archive_commit, str(directory / 'archive-parts.json'))).hexdigest() == sha(directory / 'archive-parts.json')
part_refs = [{'path': str(directory / part['path']), 'sha256': part['sha256']} for entry in parts['entries'] for part in entry['parts']]
artifacts = [{'path': str(directory / name), 'sha256': sha(directory / name)} for name in ['source.json', 'execution-receipt.json', '0-report.json', 'independent-archive-verification.json', 'resource-verification.json', 'profile.mjs.bin', 'profile.mjs.bin.map', 'archive-parts.json', 'canonical-segments.jsonl.gz']]
result = {
    'format': 'step5l-candidate-resource-applicability-review', 'version': 1,
    'status': 'PASS_LITERAL_U12_EXPERIMENT', 'sourceCommit': base['sourceCommit'],
    'sourceIdentityMeaning': 'Fresh release candidate whose imported production files match the actual resource execution; not a retagged run.',
    'actualApplicationSource': source['applicationCommit'],
    'executionRepositoryBaseline': source['repositoryHead'],
    'executedHarnessWasUncommitted': True,
    'executedHarness': {'path': 'tests/step5l-resource/profile.ts', 'sha256': source['files']['tests/step5l-resource/profile.ts']},
    'postExecutionArchiveCommit': args.archive_commit,
    'receipt': {'path': base_path, 'sha256': sha(base_path)},
    'actualExecutionEnvironment': report['environment'],
    'matchedImportedProductionModules': len(production),
    'inputs': {'seed': source['seed'], 'initialHands': 0, 'goalHands': 10000, 'actualHandsBySeats': report['handsBySeats'], 'exactAppliedRules': rules, 'actualAppliedPolicyVersions': sorted(policies)},
    'artifacts': artifacts,
    'losslessArchiveParts': part_refs,
    'cleanCheckoutReconstructionCommand': 'python3 tests/step5l-resource/artifacts.py restore tests/step5l-resource/evidence/full-10000',
    'checks': {'completedHands': 10000, 'independentArchiveAgrees': True, 'uniqueCanonicalHandIds': len(hand_ids), 'memoryBaselineAndTrendRecorded': True, 'storageOverheadBoundedWithoutDeletingCanonicalHands': True, 'boundedRangeCaches': True, 'oneTimerThenZeroOnClose': True, 'candidateImportGraphExact': True, 'pendingDecisionReloadsStable': len(report['reloads'])},
    'measurements': {'ordinaryPreparationMs': report['ordinaryPreparation'], 'finalFinancialAccount': financial, 'resourceCheckpoints': points, 'bulkAuditMemory': report['memory']},
    'functionalResourceCriterion': 'QUALIFIED_FOR_LITERAL_U12_EXPERIMENT',
    'performanceAndMemoryStatus': 'NOT_RESOLVED_AS_Z14_OR_PHYSICAL_DEVICE_QUALIFICATION',
    'limitations': ['Uncommitted execution harness bytes are identified separately from baseline and post-execution archival Git identity.', 'Node disk-backed IndexedDB request reference with documented read-only size getter; not actual browser storage/performance.', 'Bulk full-audit memory and storage pressure remain limitations; bounded overhead is not an unlimited-storage guarantee.', 'Historical10.072-second stall remains unattributed. The current browser presentation/confirmation ambiguity is separate; neither is declared fixed.'],
}
output.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'output': str(output), 'U12': result['functionalResourceCriterion'], 'completedHands': 10000, 'rules': list(rules), 'policies': sorted(policies), 'Z14': 'NOT_QUALIFIED'}))
