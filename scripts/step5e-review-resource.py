"""Verify the ACTUAL 10k resource execution at its original source.
Only identical imported modules qualify the candidate's non-UI U12 experiment.
This is a new evidence review, not a renamed execution or a performance PASS.
"""
import argparse, gzip, hashlib, json, pathlib, subprocess
p=argparse.ArgumentParser();p.add_argument('--receipt',required=True);p.add_argument('--resource',required=True);p.add_argument('--output',required=True);a=p.parse_args()
read=lambda x:pathlib.Path(x).read_bytes()
sha=lambda x:hashlib.sha256(x).hexdigest()
j=lambda x:json.loads(read(x))
git=lambda c,f:subprocess.check_output(['git','show',f'{c}:{f}'])
base=j(a.receipt);root=pathlib.Path(a.resource);source=j(root/'source.json');report=j(root/'report.json');deps=j(root/'bundle-dependencies.json');done=j(root/'completion.json');replay=j(root/'archive-verification.json');provenance=j(root/'candidate-provenance.json')
assert base['status']=='PASS' and report['status']=='PASS' and done['functionalStatus']=='PASS'
assert source['sourceCommit']==report['sourceCommit']==provenance['executedSourceCommit']
assert provenance['candidateCommit']==base['sourceCommit']
assert done['exitCode']==done['archiveVerificationExitCode']==0
inputs=deps['inputs'];assert len(inputs)==98 and deps['reproducedByteIdentically']
matched_src=[];matched_repo=[];matched_dependencies=[]
for path,entry in inputs.items():
 assert sha(read(path))==entry['sha256'],f'Current input differs:{path}'
 if not (path.startswith('node_modules/') or '/node_modules/' in path):
  assert sha(git(source['sourceCommit'],path))==entry['sha256'],f'Executed immutable input differs:{path}'
  assert sha(git(base['sourceCommit'],path))==entry['sha256'],f'Candidate immutable input differs:{path}'
  matched_repo.append(path)
  if path.startswith('src/'):matched_src.append(path)
 else:matched_dependencies.append(path)
assert len(matched_repo)==94 and len(matched_src)==93
assert 'src/ui/app.ts' not in inputs
assert sha(git(base['sourceCommit'],'package-lock.json'))==provenance['packageLockSHA256']==sha(read('package-lock.json'))
assert sha(read(root/'resource.bundle.mjs.bin'))==deps['bundleSHA256']==provenance['bundleSHA256']
assert report['completedHands']==replay['completedHands']==done['completedHands']==10000
assert report['decisions']==done['decisions']==69055 and report['sessionCount']==replay['sessions']==101
assert report['canonicalSHA256']==replay['canonicalSHA256']==done['canonicalSHA256']
assert replay['status']=='PASS' and done['independentArchiveMatches']
assert replay['wallet']==report['finalWallet']==98646795 and replay['tableBalance']==0
assert sha(read(root/'canonical-segments.jsonl.gz'))==done['archiveSHA256']
# Inspect retained archive identities/counts independently of either reported PASS.
keys=set();indices={};header=None
with gzip.open(root/'canonical-segments.jsonl.gz','rt') as stream:
 for line in stream:
  row=json.loads(line);key=row['key'];assert key not in keys;keys.add(key)
  if key=='current':header=row['value']
  if key.startswith('v2:'):
   _,kind,index=key.split(':');index=int(index);assert row['value']['index']==index
   indices.setdefault(kind,[]).append(index)
assert len(keys)==replay['records']==20331
assert header and len(keys)==sum(s['count'] for s in header['segments'].values())+2
for kind,segment in header['segments'].items():
 assert sorted(indices.get(kind,[]))==list(range(segment['count'])),f'Missing/duplicate archive segment:{kind}'
assert header['segments']['hands']['count']==10000
assert header['segments']['ledger']['count']==replay['ledgerEvents']==10228
assert report['maximumTimers']==1 and report['timersAfterClose']==0
assert report['maxMemoryWindow']<=120 and report['maxSegmentWritesPerCommit']<=2
assert report['baseline']['heapUsed']>0
assert [r['hands'] for r in report['checkpoints']]==[0,100,*range(1000,10001,1000)]
for row in report['checkpoints']:
 assert row['resources']['heapUsed']>0 and row['storageBytes']>0
 assert row['liveTimers']==1 and row['cacheEntries']['shape']<=4 and row['cacheEntries']['analysis']<=8
assert report['checkpoints'][-1]['storageRecords']==len(keys)
assert done['performanceAndMemoryStatus']=='NOT_RESOLVED' and len(done['unresolved'])==2
artifacts={str(f):sha(read(f)) for f in [root/n for n in ['source.json','report.json','completion.json','bundle-dependencies.json','candidate-provenance.json','archive-verification.json','resource.bundle.mjs.bin','canonical-segments.jsonl.gz']]}
result={'format':'step5e-candidate-resource-evidence-review','version':1,'sourceCommit':base['sourceCommit'],'sourceIdentityMeaning':'Candidate whose imported non-UI modules were independently compared; NOT the source commit of the original run.','receipt':{'path':a.receipt,'sha256':sha(read(a.receipt))},'actualExecutedSourceCommit':source['sourceCommit'],'actualExecutionEnvironment':report['environment'],'assertionSource':'tests/step5b-resource/run-resource.ts','assertionSHA256':inputs['tests/step5b-resource/run-resource.ts']['sha256'],'inputs':{'entropySeed':'0x51a7e5b','targetHands':10000,'tableSizes':[2,6,10],'policyVersions':report['versions']},'matchedImportedProductionModules':len(matched_src),'matchedImportedRepositoryFiles':len(matched_repo),'matchedInstalledDependencyFiles':len(matched_dependencies),'artifacts':artifacts,'checks':{'completedHands':10000,'independentArchiveAgrees':True,'uniqueCanonicalRecords':len(keys),'memoryBaselineAndTrendRecorded':True,'storageRecordCountExactlyCanonicalPlusTwoHeaders':True,'boundedRangeCacheAndPublicObservationWindow':True,'oneTimerThenZeroOnClose':True,'candidateImportGraphExact':True},'measurements':{'baseline':report['baseline'],'immediateReleased':report['released'],'botPreparation':report['botPreparationLatency'],'policy':report['policyLatency'],'storageBytes':report['checkpoints'][-1]['storageBytes'],'archiveBytes':report['archiveBytes']},'functionalResourceCriterion':'QUALIFIED_FOR_LITERAL_U12_EXPERIMENT','performanceAndMemoryStatus':'NOT_RESOLVED','limitations':done['unresolved']+['Node controller/segmented-reference experiment. No BrowserPersistence fast-path, rendered UI, whole candidate browser, physical-device or complete heap reclamation claim.','Source hashes establish only the exact imported dependency graph; later app.ts changes were not exercised by this experiment.']}
pathlib.Path(a.output).parent.mkdir(parents=True,exist_ok=True);pathlib.Path(a.output).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'output':a.output,'actualExecutedSourceCommit':source['sourceCommit'],'candidateImportedGraph':base['sourceCommit'],'completedHands':10000,'performanceAndMemoryStatus':'NOT_RESOLVED'}))
