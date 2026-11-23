"""Audit current per-ID status accounting and actual fail-closed release command.
Z12 is a reporting/gating criterion, not permission to pass its unresolved gates.
V620's stricter unresolved room-provenance fields are reported separately.
"""
import argparse,csv,hashlib,json,pathlib,subprocess
p=argparse.ArgumentParser();p.add_argument('--receipt',required=True);p.add_argument('--qualification',required=True);p.add_argument('--output',required=True);a=p.parse_args()
read=lambda p:pathlib.Path(p).read_bytes();sha=lambda b:hashlib.sha256(b).hexdigest();j=lambda p:json.loads(read(p))
base=j(a.receipt);audit=j(a.qualification);original=j('docs/specs/acceptance-source.json');backlog=j('docs/specs/backlog-source.json');rows=list(csv.DictReader(pathlib.Path('ACCEPTANCE_STATUS.csv').open()));byid={r['id']:r for r in rows}
assert len(rows)==len(byid)==len(original)==302 and len(backlog)==86
assert audit['verifyBuild'] and not audit['candidateErrors']
assert audit['receipt']['sourceCommit']==base['sourceCommit'] and audit['receipt']['sha256']==sha(read(a.receipt))
assert base['status']=='PASS' and base['sourceCommitAtEnd']==base['sourceCommit']
assert len(audit['requirements'])==302 and len({r['id'] for r in audit['requirements']})==302
for item in original:
 for key,value in item.items():assert byid[item['id']][key]==value
for item in audit['requirements']:
 row=byid[item['id']];q=item['qualification'];assert item['criterion']==row['acceptance'] and item['originalStatus']==row['status']
 assert row['status'] in ['PASS','FAIL','BLOCKED','NOT_EXECUTED']
 assert row['r1_blocking'] in ['YES','NO']
 if q['status']=='QUALIFIED':
  assert q['sourceCommit']==base['sourceCommit'] and not q['errors']
  assert q['environment'] and q['engineVersion'] and q['policyVersion'] and q['expected'] and q['observed']
  assert q['executedCases'] or q['executedReports'] or q['executedBrowserCases']
 elif item['effectiveCriticalPass']:
  assert q['status']=='NOT_QUALIFIED' and q['errors'],item['id']
 else:
  assert q['status']=='NOT_REQUIRED_FOR_CURRENT_NONPASS'
  if row['r1_blocking']=='YES':assert row['next_action'],item['id']
actual_counts={s:sum(r['status']==s for r in rows) for s in ['PASS','FAIL','BLOCKED','NOT_EXECUTED']}
assert actual_counts==audit['originalStatusCounts']
assert base['testCounts']['passed']==len(base['testCases'])
assert all(c['status']=='passed' and c['testSourceSHA256']==base['sourceHashes'][c['file']] for c in base['testCases'])
assert base['environment'] and base['buildHashes'] and base['engineVersion'] and base['policyVersion']
assert base['testCounts']['passed']!=sum(r['status']=='PASS' for r in rows)
gate_output=str(pathlib.Path(a.output).with_name('status-honesty-release-refusal.json'))
command=['node','tests/step5l-acceptance/release-refusal.mjs','--candidate-receipt',a.receipt,'--qualification-audit',a.qualification,'--output',gate_output,'--enforce']
run=subprocess.run(command,capture_output=True,text=True);assert run.returncode==1,run.stdout+run.stderr
refusal=j(gate_output);assert refusal['decision']=='NOT_READY_FOR_R1' and not refusal['candidateVerificationErrors'] and refusal['qualificationUsable']
assert refusal['unqualifiedCriticalIds'] and refusal['unresolvedOriginalIds']
# Do not assume generic cfg descriptions are complete exact applied-version data.
provenance_gaps=[]
for item in audit['requirements']:
 q=item['qualification']
 if q['status']=='QUALIFIED' and any('<' in v for v in q['roomVersions']):
  provenance_gaps.append({'id':item['id'],'roomVersions':q['roomVersions'],'nextAction':'Enumerate the exact applied configuration version(s) from each linked actual capture/fixture; a placeholder is not an exact immutable profile version. Preserve all original assertion-source hashes.'})
report={'format':'step5e-status-honesty-review','version':1,'sourceCommit':base['sourceCommit'],'receipt':{'path':a.receipt,'sha256':sha(read(a.receipt))},'reviewedQualification':{'path':a.qualification,'sha256':sha(read(a.qualification))},'checks':{'originalIDs':302,'deferredFeatures':86,'originalCriteriaPreserved':True,'allStatusesExplicit':True,'candidatePassRequiresActualLinkedExecution':True,'unexecutedOrPartialCurrentEvidenceNeverPromoted':True,'testCountsSeparateFromRequirementCounts':True,'actualGateRefusedDespitePassingSuite':True},'observedOriginalCounts':actual_counts,'observedAutomatedTests':base['testCounts'],'actualGate':{'command':command,'exitCode':run.returncode,'output':gate_output,'sha256':sha(read(gate_output)),'decision':refusal['decision'],'unqualifiedCriticalIds':refusal['unqualifiedCriticalIds']},'Z12':'QUALIFIED_REPORTING_AND_FAIL_CLOSED_GATE_ONLY','V620':'NOT_EXECUTED_COMPLETE_PROVENANCE_AUDIT','V620SpecificMetadataGaps':provenance_gaps,'limitations':['This executed metadata/gate audit runs no poker or browser games.','Original historical PASS statuses are distinct from current candidate qualification; missing current evidence still blocks release.','Z12 reporting/gating correctness does not certify the outcomes of unresolved mandatory tests, or the stricter exact per-result provenance completion under V620.']}
pathlib.Path(a.output).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'output':a.output,'Z12':report['Z12'],'V620GenericProfileMetadataRows':len(provenance_gaps),'actualReleaseDecision':refusal['decision']}))
