"""Read and independently sum emitted probe events; never relabel old runs."""
import json
import argparse
import hashlib
import statistics
import subprocess
from pathlib import Path
from datetime import datetime, timezone
parser = argparse.ArgumentParser()
parser.add_argument('--receipt', default='TEST_EVIDENCE/step5e/release-final/manifest.json')
parser.add_argument('--probes', default='TEST_EVIDENCE/step5e/probes-final/manifest.json')
parser.add_argument('--output', default='tests/step5e-gates/evidence/candidate-probes-review.json')
args = parser.parse_args()
root = Path.cwd()
base_path = root / args.receipt
probe_path = root / args.probes
directory = probe_path.parent
out = root / args.output
sha = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
read = lambda path: json.loads(Path(path).read_text())
base, receipt = read(base_path), read(probe_path)
assert base['status'] == receipt['status'] == 'PASS'
assert receipt['qualificationBase']['sha256'] == sha(base_path)
assert receipt['qualificationBase']['sourceCommit'] == base['sourceCommit']
runtime_extra = {'index.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', '.openai/hosting.json'}
runtime = lambda hashes: {k:v for k,v in hashes.items() if k.startswith(('src/', 'public/')) or k in runtime_extra}
assert runtime(base['sourceHashes']) == runtime(receipt['sourceHashes'])
assert receipt['buildHashes'] == base['buildHashes']
for path, expected in base['buildHashes'].items():
    assert sha(root / path) == expected
raw_path = directory / 'probes/exploit-probes.json'
provenance_path = directory / 'probes/execution-provenance.json'
raw, provenance = read(raw_path), read(provenance_path)
assert provenance['sourceCommit'] == receipt['sourceCommit']
assert provenance['rawReport']['sha256'] == sha(raw_path)
assert raw['repetitions'] == 32 and raw['completedHands'] == 3072 and len(raw['rows']) == 96
assert receipt['testCounts'] == {'total':3,'passed':1,'failed':0,'skipped':2,'files':1}
assert list(raw['definitions']) == ['minbet', 'hyper-overbet', 'limp-all', 'never-bluff', 'always-call', 'max-aggression']
for row in raw['rows']:
    assert len(row['rawNetBB']) == row['outcomes']['n'] == 32
    assert abs(statistics.mean(row['rawNetBB']) - row['outcomes']['meanBB']) < 1e-12
    assert abs(statistics.stdev(row['rawNetBB']) - row['outcomes']['standardDeviationBB']) < 1e-12
replayed = 0
for example in raw['examples']:
    hand = example['record']
    balances = {s['id']:s['startingStack'] for s in hand['players']}
    initial = sum(balances.values())
    ids, decisions = set(), set()
    paid = refunded = awarded = rake = 0
    for event in hand['events']:
        assert event['id'] not in ids
        ids.add(event['id'])
        if event['type'] == 'action':
            assert event['decisionId'] not in decisions
            decisions.add(event['decisionId'])
        amount = event.get('amount', 0)
        assert isinstance(amount, int) and amount >= 0
        if event['type'] in ('blind', 'action'):
            paid += amount
            balances[event['seatId']] -= amount
        if event['type'] in ('refund', 'award'):
            balances[event['seatId']] += amount
            if event['type'] == 'refund': refunded += amount
            else: awarded += amount
        if event['type'] == 'rake': rake += amount
        assert all(value >= 0 for value in balances.values())
    assert paid - refunded == awarded + rake
    assert sum(balances.values()) + rake == initial
    assert all(balances[s['id']] == s['endingStack'] for s in hand['players'])
    assert all(trace['observation']['policyVersion'] == provenance['observedVersions'][example['model']] for trace in example['traces'])
    replayed += 1
assert replayed == 96
result = {'kind':'independent-probe-review-not-unit-test-count','at':datetime.now(timezone.utc).isoformat(),'sourceCommit':receipt['sourceCommit'],'qualifiedBaseCommit':base['sourceCommit'],'sourceReceipt':str(probe_path.relative_to(root)),'sourceReceiptSHA256':sha(probe_path),'runtimeInputsMatched':len(runtime(base['sourceHashes'])),'compiledAssetsMatchedAndRead':len(base['buildHashes']),'probes':{'full':True,'hands':3072,'actions':raw['totalLegalDecisions'],'selectedCasePassed':1,'unselectedCasesSkipped':2,'rowsChecked':96,'repetitions':32,'independentlyReplayedExampleHands':replayed,'observedVersions':provenance['observedVersions'],'strongerRegular':[row for row in raw['rows'] if row['model']=='candidate-1.1' and row['archetype']=='stronger-reg']},'rawSHA256':{str(path.relative_to(root)):sha(path) for path in [raw_path,provenance_path]},'reviewerSource':str(Path(__file__).relative_to(root)),'reviewerSHA256':sha(__file__),'reviewerCommit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'limitations':['Only96 retained detailed examples are independently replayed; full3072 hands execute in the separate probe runner.','Two unselected benchmark cases are not passed tests.','No expert/human/solver calibration or profitability claim.','Original0/30 finding remains distinct; aggregate adverse outcomes are not alone mechanical defects.']}
out.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'source':receipt['sourceCommit'],'replayedExamples':replayed,'matchedRuntimeInputs':result['runtimeInputsMatched'],'financialFailures':0,'output':str(out.relative_to(root))}))
