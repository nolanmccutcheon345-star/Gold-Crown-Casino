"""Independently reconcile supported public UI observations without an INP claim."""
from pathlib import Path
import json
import hashlib
import math

base = Path('tests/step5l-acceptance')
cp = 'TEST_EVIDENCE/step5l/browser/step5l-navigation-control.json'
rp = 'TEST_EVIDENCE/step5l/browser/step5l-navigation-roundtrip.json'
c = json.loads(Path(cp).read_bytes())
r = json.loads(Path(rp).read_bytes())
m = c['measurements']
start = m['measurementStartTime']


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def quantiles(values):
    values = sorted(values)
    return {'count': len(values), **{label: values[math.ceil(q * len(values)) - 1]
            for label, q in [('p50', .5), ('p95', .95), ('p99', .99)]},
            'maximum': values[-1]} if values else {'count': 0}


nav = [i for i in m['interactions'] if i['action'] == 'data-view']
assert len(nav) == len(r) == 8
assert all(i['outcome'] == 'VISIBLE_CHANGE_OBSERVED' and
           {i['before']['view'], i['after']['view']} == {'setup', 'table'} for i in nav)
assert [i['after']['view'] for i in nav] == [
    'setup' if x['action'] == 'Host setup' else 'table' for x in r]
for x in r:
    if 'dom' in x:
        assert ('Build your table' if x['action'] == 'Host setup' else 'Practice table') in x['dom']
    else:
        assert x['action'] == 'Live table' and x['state']['actions'].startswith('HAND 60 SETTLED')
assert c['identity']['sourceCommit'] == '3ecea1c2b71c8e8b9963547da676171f91f21716'
events = [x for x in m['eventTiming'] if x['startTime'] >= start and x.get('interactionId')]
result = {
    'format': 'step5l-supported-navigation-control-review', 'version': 1,
    'status': 'OBSERVATIONS_VERIFIED_PERFORMANCE_CAUSE_UNRESOLVED',
    'sourceCommit': c['identity']['sourceCommit'],
    'captures': [{'path': p, 'sha256': sha(p)} for p in [cp, rp]],
    'reviewer': {'path': str(Path(__file__).relative_to(Path.cwd())), 'sha256': sha(__file__)},
    'scope': 'Eight ordinary Host setup/Live transitions after settled hand60 on the selected visible supported cloud browser. Two additional summary/configuration interactions remain in the capture but are not navigation samples.',
    'method': 'Nearest-rank quantiles of observed records; no normalization or synthetic substitution. Whole-phase long-task/EventTiming measures remain separate from the eight navigation records.',
    'completedNavigationTransitions': 8,
    'navigationRoundTripMsIncludingAutomationTransport': quantiles([x['roundTripMs'] for x in r]),
    'navigationRAFConfirmationProxyMs': quantiles([x['visibleAfterMs'] for x in nav]),
    'navigationConfirmationToNextRAFMs': quantiles([x['nextFrameAfterMs'] - x['visibleAfterMs'] for x in nav]),
    'wholePhaseRenderMs': m['timings']['ui.render'],
    'wholePhaseLongTaskMs': quantiles([x['duration'] for x in m['longTasks'] if x['startTime'] >= start]),
    'wholePhaseNonzeroInteractionEventRecords': len(events),
    'wholePhaseEventInputQueueMs': quantiles([x['processingStart'] - x['startTime'] for x in events]),
    'wholePhaseEventHandlerMs': quantiles([x['processingEnd'] - x['processingStart'] for x in events]),
    'wholePhaseEventDurationMs': quantiles([x['duration'] for x in events]),
    'droppedCounts': {k: v for k, v in m.items() if k.startswith('dropped')},
    'interpretation': [
        'All eight expected public views appeared; no poker decision or hidden-state access was used.',
        'Direct round trips include browser-control transport. They are neither pure application latency nor independent physical-paint measurements.',
        'Approximately1-second rAF quantization persists during ordinary navigation with no bot.policy/prepare spans. This narrows the phenomenon beyond bot computation but does not establish a platform/renderer cause.',
        'No measured whole-phase main-thread task exceeded418ms. Large EventTiming durations follow much shorter handlers; they do not prove a multi-second poker-policy stall.',
        'Previously observed gameplay confirmation proxies up to5.07s and this control both remain evidence. They do not establish actual INP or no presentation/interaction regression.',
        'firstPublicUIDOMMs in this post-hand60 observation phase is not a fresh cold-start benchmark.'
    ],
    'z14CashQualification': 'NOT_QUALIFIED pending interpretable current responsiveness/regression evidence; not blocked solely by the unattributed historic10.07s sample.',
    'conditionalReleaseConclusion': 'If the completed10000hand experiment passes independent verification, U12 may qualify separately. Native100hands and this control do not automatically close Z14. Preserve original Z14 wholeNOT_EXECUTED for FUT050 and externalU10/U11/V518 separately.',
    'nextTechnicalAction': 'Use supported independent foreground browser/device measurements that distinguish visible DOM confirmation, frame/presentation timing and browser-control overhead. Preserve the candidate and observed delays. No source fix is justified by an unproven cause.',
    'statusRegistryChanged': False, 'overallINPClaimed': False
}
(base / 'navigation-control-review.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: result[k] for k in ['navigationRoundTripMsIncludingAutomationTransport',
      'navigationRAFConfirmationProxyMs', 'navigationConfirmationToNextRAFMs',
      'wholePhaseLongTaskMs', 'z14CashQualification']}, indent=2))
