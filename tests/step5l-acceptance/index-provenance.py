"""Per-case applied-room provenance from actual captures and observed reruns.
Never substitutes an all-test union for an individual assertion's inputs.
"""
import argparse,collections,hashlib,json,pathlib,re,subprocess
p=argparse.ArgumentParser();p.add_argument('--audit',required=True);p.add_argument('--gaps',required=True);p.add_argument('--supplements',nargs='+',required=True);p.add_argument('--output',required=True);p.add_argument('--browser-supplement');a=p.parse_args()
read=lambda p:pathlib.Path(p).read_bytes();sha=lambda b:hashlib.sha256(b).hexdigest();j=lambda p:json.loads(read(p));audit=j(a.audit);base=j(audit['receipt']['path']);gaps=j(a.gaps);ids={r['id'] for r in gaps['V620SpecificMetadataGaps']}|{'V429','V513'};unit=collections.defaultdict(list)
for manifest_path in a.supplements:
 m=j(manifest_path);assert m['status']=='PASS' and m['candidateSource']==base['sourceCommit'] and not m['changedInputs'] and m['sourceCommitAtEnd']==m['sourceCommit']
 for f,h in m['sourceHashes'].items():assert sha(subprocess.check_output(['git','show',f"{m['sourceCommit']}:{f}"]))==h
 vr=j(m['testResults']['path']);assert sha(read(m['testResults']['path']))==m['testResults']['sha256']
 passed=collections.Counter((('tests/'+f['name'].split('/tests/',1)[1] if '/tests/' in f['name'] else f['name']),c['fullName']) for f in vr['testResults'] for c in f['assertionResults'] if c['status']=='passed')
 observed=collections.Counter()
 for path,h in m['metadataFiles'].items():
  assert sha(read(path))==h;x=j(path);key=(x['file'],x['name']);observed[key]+=1
  unit[key].append({'manifest':manifest_path,'executedSource':m['sourceCommit'],'metadata':{'path':path,'sha256':h},'value':x})
 assert passed==observed,'Metadata counts differ from actually passing test cases'
def profiles(v,path='$'):
 out=[]
 if isinstance(v,dict):
  if all(k in v for k in ['id','version','smallBlind','bigBlind']):out.append({'path':path,'version':str(v['id'])+'@'+str(v['version']),'profile':v})
  for key in ['ruleVersion','rulesVersion','roomVersion']:
   if isinstance(v.get(key),str) and re.match(r'^\d',v[key]):out.append({'path':path+'.'+key,'version':v[key],'exactRecordedVersionField':True})
  if v.get('type')=='start' and isinstance(v.get('detail'),str) and '@' in v['detail']:out.append({'path':path+'.detail','version':v['detail']})
  for k,z in v.items():out+=profiles(z,path+'.'+k)
 elif isinstance(v,list):
  for i,z in enumerate(v):out+=profiles(z,path+'.'+str(i))
 elif isinstance(v,str) and v[:1] in ['{','[']:
  try:out+=profiles(json.loads(v),path+'[parsed-canonical-json]')
  except (ValueError,RecursionError):pass
 return out
raw_cache={}
def loadref(ref):
 path=ref['path'];assert sha(read(path))==ref['sha256']
 if path not in raw_cache:raw_cache[path]=j(path)
 return raw_cache[path]
def handids(v):
 out=set()
 if isinstance(v,dict):
  for k,z in v.items():
   if k in ['handId','newHandId','priorHandId'] and isinstance(z,str):out.add(z)
   out.update(handids(z))
 elif isinstance(v,list):
  for z in v:out.update(handids(z))
 return out
fresh=j(a.browser_supplement) if a.browser_supplement else None
if fresh:
 assert fresh['sourceCommit']==base['sourceCommit']
 for cap in fresh['captures']:assert sha(read(cap['path']))==cap['sha256']
 for item in fresh['assertionContinuity']:
  assert item['originalPredicatesUnchanged']
  for prefix in ['prior','execution']:assert sha(subprocess.check_output(['git','show',f"{item[prefix+'Source']}:{item['file']}"]))==item[prefix+'SHA256']
 def fresh_cases(family,basename=None):
  captures={c['path'] for c in fresh['captures'] if c['family']==family and (basename is None or pathlib.Path(c['path']).name==basename)}
  return [c for c in fresh['cases'] if c['capture']['path'] in captures]
else:
 def fresh_cases(*args):return []
rows=[]
for r in audit['requirements']:
 if r['id'] not in ids:continue
 q=r['qualification'];q=next((c['qualification'] for c in audit.get('additionalOriginalCandidates',[]) if c['id']==r['id']),q);assert q['status']=='QUALIFIED';row={'id':r['id'],'unitCases':[],'browserCases':[],'reportCases':[],'unresolved':[]}
 for c in q['executedCases']:
  match=unit.get((c['file'],c['name']),[])
  if not match:row['unresolved'].append({'kind':'unit','file':c['file'],'name':c['name'],'missing':'No executed observer case; rerun original case with declared required environment.'});continue
  for m in match:
   x=m['value'];record={k:v for k,v in m.items() if k!='value'};record.update({'file':x['file'],'name':x['name'],'occurrence':x['occurrence'],'profiles':x['profiles'],'observedPolicyVersions':x['observedPolicyVersions'],'actualDealInputsRetained':len(x['deals'])})
   if x['profiles']:record['status']='ACTUAL_SUCCESSFUL_RETURNED_PROFILES'
   elif x['engineCalls']==0:record['status']='NO_SUCCESSFUL_ENGINE_CALL_IN_THIS_CASE';record['roomApplicability']='No authoritative game profile was applied by this unit case. Original literal input fixtures/assertion source remain attached; no fabricated runtime room version.'
   elif c['file']=='tests/session-bots4a.test.ts' and 'old saved policy and unsampled reservation' in c['name']:
    f='tests/step36/fixtures/populated-v3.json';assert sha(read(f))==base['sourceHashes'][f];v=j(f)['streets']['flop']['active']['game']['profile'];record['profiles']=[{'via':['Original imported populated-v3.json $.streets.flop.active.game.profile used verbatim by this named legacy-restore test'],'profile':v}];record['status']='EXACT_RETAINED_INPUT_PROFILE';record['fixture']={'path':f,'sha256':sha(read(f)),'pointer':'$.streets.flop.active.game.profile'}
   else:record['status']='MISSING_APPLIED_PROFILE';row['unresolved'].append({'kind':'unit','file':c['file'],'name':c['name'],'missing':'Successful engine interaction did not retain applied profile'})
   row['unitCases'].append(record)
 for b in q['executedBrowserCases']:
  raw=loadref(b['capture']);cid=b['commandId'];command=b['command'];body=None;pointer=None
  if raw.get('format')=='step5e-native-gate-matrix':pointer=f'$.results.{cid-1}';body=raw['results'][cid-1];assert body['case']['kind']==command
  elif 'reports' in raw:
   candidates=[(i,z) for i,z in enumerate(raw['reports']) if z.get('id')==cid and z.get('name')==command]
   if not candidates and 'populated' in raw.get('format',''):candidates=[(i,z) for i,z in enumerate(raw['reports']) if z.get('name')==command]
   if len(candidates)==1:i,body=candidates[0];pointer=f'$.reports.{i}'
  elif 'checks' in raw and 1<=cid<=len(raw['checks']):body=raw['checks'][cid-1];pointer=f'$.checks.{cid-1}'
  found=profiles(body,pointer or '$') if body is not None else [];references=[]
  if not found and raw.get('reports') and body is not None:
   wanted=handids(body)
   for i,other in enumerate(raw['reports']):
    if wanted and handids(other)&wanted:
     pf=profiles(other,f'$.reports.{i}');found+=pf
     if pf:references.append({'sameActualHandIds':sorted(handids(other)&wanted),'record':i})
  if not found and raw.get('reports') and command in ['history','statistics','results-filters'] and body is not None:
   contributors={}
   for i,other in enumerate(raw['reports']):
    if other.get('id',10**9)>=cid:continue
    value=other.get('result',{});finished=value.get('completed',value)
    if finished.get('handId') and finished.get('events') and any(e.get('type')=='award' for e in finished['events']):contributors[finished['handId']]=(i,finished)
   expected=body.get('result',{}).get('hands')
   if len(contributors)==expected:
    for hid,(i,value) in contributors.items():found+=profiles(value,f'$.reports.{i}.result');references.append({'datasetMemberHandId':hid,'record':i})
  if not found and raw.get('reports') and command in ['erase','deleted'] and body is not None:
   prior=[(i,z) for i,z in enumerate(raw['reports']) if z.get('run')==body.get('run') and z.get('name')=='statistics' and z.get('id',10**9)<cid]
   if prior:
    i,stat=prior[-1];metadata=stat['result']['metadata'];assert metadata['fixtureHands']==200
    # The original strict mixed-statistics verifier checks this same run's typed
    # deletion/reload chain and canonical dataset hash before the erasure.
    found=profiles(metadata,f'$.reports.{i}.result.metadata');references.append({'sameIsolatedRun':body['run'],'inputCanonicalHandsSHA256':metadata['canonicalHandsSHA256'],'record':i})
  supplement=[]
  if not found and raw.get('checks') and command=='pace-statistics':
   matches=fresh_cases('statistics',pathlib.Path(b['capture']['path']).name)
   for candidate in matches:
    if candidate['label']==f"{body['check']}:{body.get('assumedHandsPerHour','paging')}":
     supplement.append(candidate);found+=profiles(candidate['appliedProvenance'])
  record={'freshObservationalExecutions':supplement,'execution':b['execution'],'command':command,'commandId':cid,'capture':b['capture'],'pointer':pointer,'profiles':found,'sameHandOrExactInputDatasetReferences':references}
  if found:record['status']='ACTUAL_CAPTURED_PER_CASE_PROFILE'
  elif body and (command=='high-stakes-disclosure' and body.get('result',{}).get('startedHands')==0 or command=='preset' and body.get('result',{}).get('sessions')==0 and body.get('result',{}).get('hands')==0 and body.get('result',{}).get('active') is False):record['status']='NOT_APPLICABLE_NO_HAND_STARTED'
  else:record['status']='MISSING_CAPTURED_PROFILE';row['unresolved'].append({'kind':'browser','execution':b['execution'],'command':command,'commandId':cid,'capture':b['capture']['path'],'missing':'Exact applied rules/configuration not present in this actual case or its specifically linked same-hand/dataset records. Requires narrow metadata capture; do not infer an unexecuted configuration hash.'})
  row['browserCases'].append(record)
 for rep in q['executedReports']:
  raw=loadref(rep);selected=[]
  # Independent report assertions choose the specific named group, not all captures.
  groups=set()
  for claim in rep.get('observed',[]):
   path=claim.get('claim',{}).get('path','');m=re.match(r'checks\.([^.]+)\.',path)
   if m:groups.add(m.group(1))
  for group in groups:
   alias={'persona':'step5k-persona','privacy':'step5k-integrity','entropy':'step5k-entropy','configuration':'step5k-configuration-history','resource':'step5k-resource-repaired','popup':'step5k-two-tabs','accessibility':'step5k-accessibility-import','pace':'step5k-pace'}.get(group,group);capture=raw.get('captures',{}).get(alias)
   if group=='tabClose' and capture and 'review' in capture:
    linked=loadref({'path':capture['review'],'sha256':capture['sha256']})
    matches=[{'path':path,**ref} for path,ref in linked['captures'].items() if pathlib.Path(path).name=='step5k-tab-close.json']
    assert len(matches)==1
    capture=matches[0]
   if not capture and group in ['quickstart','stress']:
    matches=[{'path':path,**ref} for path,ref in raw.get('captures',{}).items() if ((group=='quickstart' and pathlib.Path(path).name=='step5k-quickstart.json') or (group=='stress' and pathlib.Path(path).name=='step5l-recovered-stress10.json'))]
    if len(matches)==1:capture=matches[0]
   if capture and 'path' in capture:
    found=profiles(loadref(capture));selected.append({'group':group,'capture':capture,'profiles':found})
  # Recovered native/rollback/warning reports retain exact capture references.
  # Select only this report's actual observed cases, never a global version union.
  if pathlib.Path(rep['path']).name in ['native-qualified-review.json','rollback-qualified-review.json']:
   capture=raw['capture'];selected.append({'group':pathlib.Path(rep['path']).stem,'capture':capture,'profiles':profiles(loadref(capture))})
  if pathlib.Path(rep['path']).name=='warning-qualified-review.json':
   for case in raw['cases']:
    capture=case['capture'];selected.append({'group':'warning:'+case['kind'],'capture':capture,'profiles':profiles(loadref(capture))})
  fresh_groups=set(groups)
  name=pathlib.Path(rep['path']).name
  if name=='native-qualified-review.json':fresh_groups.add('native')
  if name=='rollback-qualified-review.json':fresh_groups.add('rollback')
  if name=='warning-qualified-review.json':fresh_groups.add('warning')
  fresh_records=[case for group in sorted(fresh_groups) for case in fresh_cases(group)]
  found=profiles(raw)
  if not found:found=[p for s in selected for p in s['profiles']]
  if not found and fresh_records:found=[p for case in fresh_records for p in profiles(case['appliedProvenance'])]
  record={'freshObservationalExecutions':fresh_records,'report':rep,'selectedGroups':selected,'profiles':found,'status':'ACTUAL_REPORTED_PROFILES' if found else 'NEEDS_EXACT_APPLICABILITY_REVIEW'}
  if not found and raw.get('format')=='ai-texas-ci-execution':record['status']='NOT_APPLICABLE_EXECUTION_RECEIPT_ONLY'
  elif not found:row['unresolved'].append({'kind':'report','path':rep['path'],'groups':sorted(groups),'missing':'Derived report links omit exact applied profiles or the check is non-game metadata; inspect its actual selected group for precise N/A applicability or capture missing fields.'})
  row['reportCases'].append(record)
 row['status']='RESOLVED' if not row['unresolved'] else 'PARTIAL';rows.append(row)
result={'format':'step5e-per-case-room-provenance-index','version':1,'sourceCommit':base['sourceCommit'],'qualification':{'path':a.audit,'sha256':sha(read(a.audit))},'observedSupplementManifests':[{'path':p,'sha256':sha(read(p))} for p in a.supplements],'browserSupplement':{'path':a.browser_supplement,'sha256':sha(read(a.browser_supplement))} if a.browser_supplement else None,'originalPlaceholderRows':84,'additionalCandidateRows':['V429','V513'],'rows':rows,'resolvedIDs':[r['id'] for r in rows if r['status']=='RESOLVED'],'remainingIDs':[r['id'] for r in rows if r['status']!='RESOLVED'],'limitations':['This is per-case extraction from recorded outcomes, not global-version union or reproduction of unexecuted settings.','Successful unit observer runs supplement original default execution; original source identity and assertion bytes remain distinct.','No-successful-engine-call classification is narrow unit applicability, not a claim that a related browser workflow used no room rules.']}
pathlib.Path(a.output).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'output':a.output,'resolved':len(result['resolvedIDs']),'remaining':result['remainingIDs']}))
