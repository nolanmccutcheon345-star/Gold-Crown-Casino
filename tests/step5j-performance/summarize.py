"""Validate and summarize executed Step 5J diagnostic receipts, never invent a run."""
import gzip
import hashlib
import json
import math
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
sha = lambda b: hashlib.sha256(b).hexdigest()


def quantiles(values):
    ordered = sorted(values)
    return dict(samples=len(ordered), **{
        name: ordered[max(0, math.ceil(len(ordered) * p) - 1)] if ordered else None
        for name, p in (("p50", .5), ("p95", .95), ("p99", .99), ("max", 1))
    })


source = json.loads((root / 'source.json').read_text())
assert sha((root / 'profile.mjs.bin').read_bytes()) == source['bundleSHA256']
assert sha((root / 'prepare-ready.mjs.bin').read_bytes()) == source['readySHA256']
executions = json.loads((root / 'executions.json').read_text())
scenarios = []
for execution in executions:
    file = root / execution['report']
    report = json.loads(file.read_text())
    assert report['status'] == 'PASS' and report['profileCaptureComplete']
    assert report['financialAndStatisticsFullReplayAgreement']
    assert report['finalCompactAccount']['table'] == 0
    assert report['finalStorage']['groups']['canonicalHands']['records'] == report['size'] + report['completedHands']
    assert report['source'] == json.loads((file.parent / 'source.json').read_text())
    with gzip.open(file.parent / report['trace']['path'], 'rt') as stream:
        trace = [json.loads(line) for line in stream]
    assert len(trace) == report['trace']['rows']
    preparations = [w for w in report['windows'] if w['name'] == 'ordinary.bot.prepare']
    assert len(preparations) == report['decisions'] == len(report['decisionContexts'])
    assert len([w for w in trace if w['phase'] == 'ordinary.bot.prepare' and w['name'] == 'bot.prepare']) == len(preparations)
    assert quantiles([w['ms'] for w in preparations]) == report['ordinaryPreparation']
    assert set(report['seatDecisionCounts']) == {'2', '6', '10'}, 'Each workload must actually exercise every nominated table size'
    if report['sustained']:
        assert report['forcedGCCalls'] == 0 and report['reloads'] == []
    for artifact in report['profiles'].values():
        if artifact.get('parts'):
            chunks = []
            for part in artifact['parts']:
                chunk = (file.parent / part['path']).read_bytes()
                assert len(chunk) == part['bytes'] and sha(chunk) == part['sha256']
                chunks.append(chunk)
            raw = b''.join(chunks)
        else:
            raw = (file.parent / artifact['path']).read_bytes()
        assert len(raw) == artifact['bytes'] and sha(raw) == artifact['sha256']
        json.loads(gzip.decompress(raw))
    slowest = []
    for window in sorted(preparations, key=lambda w: -w['ms'])[:5]:
        nested = sorted(({'name': w['name'], 'ms': w['ms']} for w in trace
                         if w['phase'] == window['phase'] and w['decision'] == window['decision']
                         and w['start'] >= window['start'] - .1 and w['end'] <= window['end'] + .1),
                        key=lambda w: -w['ms'])
        context = next(c for c in report['decisionContexts'] if c['decision'] == window['decision'])
        slowest.append(dict(window, context=context, nestedStages=nested))
    phases = {name: quantiles([w['ms'] for w in report['windows'] if w['name'] == name])
              for name in ['freshCheckpoint.controllerInit', 'history.explicitFullLoad', 'audit.explicitCanonical', 'afterHistory.fastRecovery']}
    scenarios.append(dict(
        name=execution['scenario'], report=execution['report'], reportSHA256=sha(file.read_bytes()),
        initialHands=report['size'], completedHands=report['completedHands'], decisions=report['decisions'],
        preparation=report['ordinaryPreparation'], preparationBySeat=report['preparationBySeat'],
        ordinaryPolicy=quantiles([w['ms'] for w in trace if w['phase'] == 'ordinary.bot.prepare' and w['name'] == 'bot.policy']),
        over250ms=sum(w['ms'] > 250 for w in preparations), over1000ms=sum(w['ms'] > 1000 for w in preparations),
        profiled=report['profiled'], naturalGCOnly=report['sustained'], forcedGCCalls=report['forcedGCCalls'],
        fastRecovery=report['fastRecovery'], phases=phases, nodeEventLoopDelay=report['nodeEventLoopDelay'],
        memory=report['memory'], maxSampledHeapBytes=max(m['memory']['heapUsed'] for m in report['memory']),
        maxSampledRSSBytes=max(m['memory']['rss'] for m in report['memory']),
        pendingReloads=report['reloads'], independentAccountingAndStatisticsAgreement=True,
        firstAccount=report['firstAccount'], finalAccount=report['finalCompactAccount'],
        initialStorageBytes=report['initialStorage']['totalBytes'], finalStorageBytes=report['finalStorage']['totalBytes'],
        slowest=slowest, policies=report['policies'], streetCounts=report['streetCounts'],
        seatDecisionCounts=report['seatDecisionCounts'], environment=report['environment']))

result = dict(format='step5j-performance-qualification', status='PASS' if len(scenarios) == 7 else 'INCOMPLETE', source=source,
              plannedScenarios=7, allPlannedScenariosCompleted=len(scenarios) == 7,
              scenarios=scenarios, scenarioCount=len(scenarios),
              preparations=sum(s['decisions'] for s in scenarios),
              completedHands=sum(s['completedHands'] for s in scenarios),
              requirementsAutomaticallyPassed=0,
              historical10072msOutlier='UNATTRIBUTED; absent original per-decision execution trace',
              scope='Node disk-backed request reference, not native browser storage, rendering, INP or physical-device performance. Cohorts with different history sizes/profiling/GC are not pooled. Nested timings overlap.')
(root / 'summary.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: result[k] for k in ('status', 'scenarioCount', 'preparations', 'completedHands')}))
