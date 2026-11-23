"""Fresh isolated metadata-observation rerun; original assertions unchanged.
No result is retroactively attached to the earlier default-suite execution.
"""
import argparse,hashlib,json,pathlib,subprocess,os,platform,datetime
p=argparse.ArgumentParser();p.add_argument('--receipt',required=True);p.add_argument('--qualification',required=True);p.add_argument('--gaps',required=True);p.add_argument('--output',required=True);p.add_argument('--files',nargs='+');a=p.parse_args()
read=lambda x:pathlib.Path(x).read_bytes();sha=lambda b:hashlib.sha256(b).hexdigest();j=lambda x:json.loads(read(x));git=lambda *args:subprocess.check_output(['git',*args]).decode().strip();now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
base=j(a.receipt);audit=j(a.qualification);gaps=j(a.gaps);ids={r['id'] for r in gaps['V620SpecificMetadataGaps']};files=sorted({c['file'] for r in audit['requirements'] if r['id'] in ids for c in r['qualification'].get('executedCases',[])})
if a.files:
 assert set(a.files)<=set(files);files=a.files
assert base['status']=='PASS' and files
for f in files:assert sha(read(f))==base['sourceHashes'][f],f
runtime={f:h for f,h in base['sourceHashes'].items() if f.startswith(('src/','public/')) or f in ['package.json','package-lock.json','index.html','vite.config.ts','tsconfig.json','.openai/hosting.json']}
for f,h in runtime.items():assert sha(read(f))==h,f
out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True);observer=['tests/step5e-gates/provenance-observer.setup.ts','tests/step5e-gates/provenance-observer.config.mts','scripts/step5e-run-provenance-supplement.py'];source=git('rev-parse','HEAD');inputs={f:sha(read(f)) for f in sorted(set(files+list(runtime)+observer))}
for f,h in inputs.items():assert sha(subprocess.check_output(['git','show',f'{source}:{f}']))==h,f
command=['npx','vitest','run','--config','tests/step5e-gates/provenance-observer.config.mts',*files,'--reporter=json',f'--outputFile={out}/vitest.json']
receipt={'format':'step5e-observational-unit-provenance-run','version':1,'status':'RUNNING','sourceCommit':source,'candidateSource':base['sourceCommit'],'candidateReceipt':{'path':a.receipt,'sha256':sha(read(a.receipt))},'startedAt':now(),'command':command,'sourceHashes':inputs,'runtimeHashesMatched':len(runtime),'testAssertionFilesUnchanged':files,'environment':{'node':subprocess.check_output(['node','--version']).decode().strip(),'platform':platform.system(),'arch':platform.machine(),'RUN_ACCOUNTING_BATCH':os.environ.get('RUN_ACCOUNTING_BATCH','unset')},'scope':'Original tests rerun with a separate observational setup recording only successful returned engine profiles/decks and public policy-version fields. Default full-suite results remain unchanged; this is not browser, performance, human or physical-device evidence.'}
(out/'manifest.json').write_text(json.dumps(receipt,indent=2)+'\n');env={**os.environ,'STEP5E_PROVENANCE_OUT':str(out.resolve()/'cases')}
with (out/'execution.log').open('w') as log:run=subprocess.run(command,env=env,stdout=log,stderr=subprocess.STDOUT)
result=j(out/'vitest.json');receipt.update({'exitCode':run.returncode,'finishedAt':now(),'sourceCommitAtEnd':git('rev-parse','HEAD'),'changedInputs':[f for f,h in inputs.items() if sha(read(f))!=h],'testCounts':{'total':result['numTotalTests'],'passed':result['numPassedTests'],'failed':result['numFailedTests'],'skipped':result['numPendingTests']},'testResults':{'path':str(out/'vitest.json'),'sha256':sha(read(out/'vitest.json'))},'metadataFiles':{str(f):sha(read(f)) for f in sorted((out/'cases').glob('*.json'))}})
receipt['status']='PASS' if run.returncode==0 and result['success'] and not receipt['changedInputs'] and receipt['sourceCommitAtEnd']==source else 'FAIL'
(out/'manifest.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({'status':receipt['status'],'source':source,'candidate':base['sourceCommit'],'testCounts':receipt['testCounts'],'metadataFiles':len(receipt['metadataFiles'])}));raise SystemExit(0 if receipt['status']=='PASS' else 1)
