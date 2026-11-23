"""Read-only review of pinned executed bot artifacts; not another unit test count."""
import json, gzip, hashlib, random, statistics
from pathlib import Path
ROOT=Path('/workspace/sites/ai-texas-hold-em')
BASE=ROOT/'TEST_EVIDENCE/step5d/release-repaired'
OUT=Path(__file__).parent/'evidence/bot-evidence-review.json'
def read(p):
 p=Path(p)
 return json.loads(gzip.decompress(p.read_bytes()) if p.suffix=='.gz' else p.read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def opening(hand,seat,after_blinds=False):
 value=next(s['stack'] for s in hand['initial'] if s['id']==seat)
 return value+(sum(e.get('amount',0) for e in hand['events'] if e['type']=='blind' and e['seatId']==seat) if after_blinds else 0)
def replay(hand,after_blinds=False):
 initial=hand['initial'];balances={s['id']:opening(hand,s['id'],after_blinds) for s in initial};ids=set();decisions=set();paid=returned=awarded=rake=0
 for e in hand['events']:
  assert e['id'] not in ids;ids.add(e['id'])
  if e['type']=='action':assert e['decisionId'] not in decisions;decisions.add(e['decisionId'])
  if e['type'] in ('blind','action'):paid+=e.get('amount',0);balances[e['seatId']]-=e.get('amount',0)
  if e['type'] in ('refund','award'):
   amount=e.get('amount',0);balances[e['seatId']]+=amount
   if e['type']=='refund':returned+=amount
   else:awarded+=amount
  if e['type']=='rake':rake+=e.get('amount',0)
 assert paid-returned==awarded+rake
 assert all(balances[s['id']]==s['stack'] for s in hand['final'])
 assert sum(balances.values())+rake==sum(opening(hand,s['id'],after_blinds) for s in initial)
 return len(decisions)
manifest=read(BASE/'manifest.json');assert manifest['status']=='PASS'
main=read(BASE/'current-benchmark-summary.json');paired=read(BASE/'paired-reference/current-benchmark-summary.json')
assert main['full'] and not main['paired'] and main['totalHands']==4032
assert paired['full'] and paired['paired'] and paired['totalHands']==1344
source=manifest['sourceCommit'];assert main['sourceCommit']==paired['sourceCommit']==source
hashes={};records={};actions=0;negative=[]
for tag,summary,path in [('main',main,BASE),('paired',paired,BASE/'paired-reference')]:
 for row in summary['summary']:
  p=path/row['rawArtifact'];raw=read(p);hashes[str(p.relative_to(ROOT))]=sha(p)
  assert len(raw)==96 and row['outcome']['hands']==96 and row['outcome']['blocks']==8
  assert sorted({h['block'] for h in raw})==list(range(8))
  for h in raw:actions+=replay(h,True)
  mean=sum((next(s['stack'] for s in h['final'] if s['id']==1)-opening(h,1,True))/h['profile']['bigBlind'] for h in raw)/96
  assert abs(mean-row['outcome']['meanBBPerHand'])<1e-12
  records[(row['cell']['name'],row['reference'])]=raw
  if mean<0:negative.append({'cohort':tag,'cell':row['cell']['name'],'reference':row['reference'],'N':96,'blocks':8,'meanBBPerHand':mean,'descriptive95':row['outcome']['blockBootstrap95']})
assert actions==main['totalActions']+paired['totalActions']
comparisons=[];matched=0
for row in paired['summary']:
 cell=row['cell']['name'];ref=row['reference'];target='hu100' if cell=='paired-hu100-rake' else 'loose625'
 a=records[(target,ref)];b=records[(cell,ref)];deltas=[]
 for left,right in zip(a,b):
  assert all(left[k]==right[k] for k in ['seed','block','button','initial'])
  assert left['profiles'][1]==right['profiles'][1]
  if cell=='paired-hu100-rake':assert left['profiles']==right['profiles']
  else:assert left['profile']==right['profile']
  matched+=1
 for block in range(8):
  def net(rows):return statistics.mean((next(s['stack'] for s in h['final'] if s['id']==1)-opening(h,1,True))/h['profile']['bigBlind'] for h in rows if h['block']==block)
  deltas.append(net(b)-net(a))
 rng=random.Random(517610);samples=sorted(statistics.mean(rng.choices(deltas,k=8)) for _ in range(2000))
 comparisons.append({'treatment':cell,'control':target,'reference':ref,'N':96,'blocks':8,'blockDeltasBBPerHand':deltas,'meanDeltaBBPerHand':statistics.mean(deltas),'independentDescriptiveBootstrap95':[samples[49],samples[1949]],'method':'Python Random(517610), 2000 draws of eight whole paired blocks; finite synthetic descriptive interval, no multiplicity correction'})
assert matched==1344
# Current continuous nine-player ecology: every actor contributes, while stacks actually carry.
ecology=read(BASE/'Y10-ecology.json');assert ecology['full'] and ecology['totalHands']==800 and ecology['blocks']==8 and ecology['handsPerBlock']==50
nine=[]
for row in ecology['rows']:
 if row['cell']!='mixed-nine':continue
 raw=read(BASE/row['artifact']);counts=[0]*9
 for h in raw['records']:
  replay(h)
  for e in h['events']:
   if e['type']=='action':counts[e['seatId']]+=1
 assert all(counts) and row['stackStates']==50
 nine.append({'block':row['block'],'hands':row['hands'],'actionsBySeat':counts,'stackStates':row['stackStates'],'metrics':{k:v for k,v in row['metrics'].items() if k in ['limp','overlimp','isolation','rfi','threeBet']},'flopHands':row['flopHands'],'multiwayFlopHands':row['multiwayFlopHands'],'rake':row['rake'],'topups':row['topups']})
assert len(nine)==8
composition=read(BASE/'composition-summary.json');selfplay=read(BASE/'current-selfplay.json')
result={'kind':'independent-read-only-review-not-unit-test-count','sourceCommit':source,'sourceReceipt':str((BASE/'manifest.json').relative_to(ROOT)),'sourceReceiptSHA256':sha(BASE/'manifest.json'),'main':{'hands':4032,'actions':main['totalActions'],'cells':len(main['summary']),'handsPerCell':96,'blocksPerCell':8},'paired':{'hands':1344,'actions':paired['totalActions'],'cells':len(paired['summary']),'exactInputMatches':matched,'comparisons':comparisons},'replayedHands':4032+1344+400,'replayedFinancialFailures':0,'rawSHA256':hashes,'negativeOutcomeCells':negative,'nineSeatEcology':nine,'compositionObserved':{'full':composition['full'],'hands':composition['completedHands'],'decisions':composition['decisions'],'note':'Current receipt only24; supplemental full960 requested. Historical960 belongs to earlier policy1.5 and is not silently substituted.'},'selfplay':{'hands':selfplay['completedHands'],'actions':selfplay['actions'],'policy':selfplay['policy']},'limits':['References are independent frozen heuristics; shared rank evaluator requires its separate mechanics validation and is not a strategy gold standard.','Financial replay independently sums emitted events; it does not independently solve all poker payout eligibility from cards.','Matched follow-up reuses consumed baseline seeds; not a fresh blind holdout.','95% intervals are descriptive synthetic block intervals with eight clusters, unadjusted for many comparisons.','Negative cells remain research observations; neither a win nor a loss proves GTO, human realism, or real-world profitability.','Y10 only explicit cash component can qualify; automatic churn remains FUT032 and whole original NOT_EXECUTED.']}
OUT.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'source':source,'independentlyReplayedHands':result['replayedHands'],'matchedInputPairs':matched,'negativeCells':len(negative),'nineSeatBlocks':len(nine),'financialFailures':0,'output':str(OUT)}))

# Supplemental current-policy executions are source-identical to the compiled RC.
SUP=ROOT/'TEST_EVIDENCE/step5d'
cm=read(SUP/'composition-supplement/manifest.json');pm=read(SUP/'probes-supplement/manifest.json')
runtime_extra={'index.html','package.json','package-lock.json','vite.config.ts','tsconfig.json','.openai/hosting.json'}
def runtime(hashes):return {k:v for k,v in hashes.items() if k.startswith(('src/','public/')) or k in runtime_extra}
for m in [cm,pm]:
 assert m['status']=='PASS' and runtime(m['sourceHashes'])==runtime(manifest['sourceHashes'])
 assert m['buildHashes']==manifest['buildHashes']
 assert m['qualificationBase']['sha256']==sha(BASE/'manifest.json')
 for p,digest in m['buildHashes'].items():assert sha(ROOT/p)==digest
comp=read(SUP/'composition-supplement/composition-summary.json');cr=read(SUP/'composition-supplement/composition-blocks.json.gz')
assert comp['full'] and comp['completedHands']==960 and len(comp['summaries'])==6 and len(cr)==48
composition_replayed=0
for block in cr:
 assert block['hands']==20 and len(block['records'])==20
 for record in block['records']:
  record['final']=record['ending'];replay(record,True);composition_replayed+=1
assert composition_replayed==960
probes=read(SUP/'probes-supplement/probes/exploit-probes.json');provenance=read(SUP/'probes-supplement/probes/execution-provenance.json')
assert probes['repetitions']==32 and probes['completedHands']==3072 and len(probes['rows'])==96 and len(probes['paired'])==48
assert list(probes['definitions'])==['minbet','hyper-overbet','limp-all','never-bluff','always-call','max-aggression']
assert provenance['observedVersions']['candidate-1.1']=='synthetic-cash-1.6.0'
assert sha(ROOT/provenance['rawReport']['path'])==provenance['rawReport']['sha256']
for row in probes['rows']:
 assert len(row['rawNetBB'])==32 and row['outcomes']['n']==32
 assert abs(statistics.mean(row['rawNetBB'])-row['outcomes']['meanBB'])<1e-12
 assert abs(statistics.stdev(row['rawNetBB'])-row['outcomes']['standardDeviationBB'])<1e-12
for ex in probes['examples']:
 rec=ex['record'];normalized={'initial':[{'id':s['id'],'stack':s['startingStack']} for s in rec['players']],'final':[{'id':s['id'],'stack':s['endingStack']} for s in rec['players']],'events':rec['events']}
 replay(normalized)
 assert all(t['observation']['policyVersion']==provenance['observedVersions'][ex['model']] for t in ex['traces'])
strong=[r for r in probes['rows'] if r['model']=='candidate-1.1' and r['archetype']=='stronger-reg']
examples=[]
for ex in probes['examples']:
 if ex['model']!='candidate-1.1' or ex['archetype']!='stronger-reg' or ex['probe'] not in ['minbet','hyper-overbet','max-aggression']:continue
 t=ex['traces'][-1];o=t['observation'];detail=t['detail'];examples.append({'probe':ex['probe'],'seed':ex['seed'],'handId':ex['record']['handId'],'ownCards':o['ownCards'],'board':o['board'],'pot':o['pot'],'legal':o['legal'],'decision':t['action'],'distribution':detail['distribution'],'estimatedRangeEquity':(detail.get('ranges') or {}).get('equity'),'contextPrice':detail['context']['price'],'events':ex['record']['events'],'netCents':ex['record']['players'][0]['net']})
supp={'kind':'independent-supplement-inspection-not-unit-test-count','sourceCommit':cm['sourceCommit'],'qualifiedBaseCommit':source,'runtimeInputsMatched':len(runtime(cm['sourceHashes'])),'compiledAssetsMatchedAndRead':len(cm['buildHashes']),'composition':{'full':True,'hands':960,'actions':comp['decisions'],'casesPassed':2,'independentlyReplayedHands':960,'rows':[{'mix':s['mix'],'hero':s['hero'],'hands':s['hands'],'blocks':s['blocks'],'netBB':s['netBB']} for s in comp['summaries']]},'probes':{'full':True,'hands':3072,'actions':probes['totalLegalDecisions'],'selectedCasePassed':1,'unselectedCasesSkipped':2,'rowsChecked':96,'repetitions':32,'independentlyReplayedExampleHands':len(probes['examples']),'observedVersions':provenance['observedVersions'],'strongerRegular':strong,'representativeAdverseTraces':examples},'causeReview':['All emitted examples reconcile and selected complete-hand harness asserts legality/termination/conservation in all3072 hands. No duplicate-action/settlement or numeric pricing failure was demonstrated by these outcomes.','Minbet example: A9hh on5d5h6h6s5s calls small flop/turn prices then folds river200 into2596. Modelled showdown share0.067708 is near price0.071531 after repeated synthetic raise updates; actual opponent77 beats board-only full house. This is a prior/range-sensitive stochastic fold, not folding the nuts.','Hyper-overbet and max-aggression example: first-hand A9hh opens to499c at20BB, faces remaining3501c call into4499c pot, exact price3501/8000=0.437625, fold probability0.836018. The true any-two probe identity is deliberately unavailable; conservative initial facing-3bet prior explains this sample action. Whether later public adaptation is too slow remains policy research.','Across32 current strong-profile max-aggression hands, continuation is1/24 all-in opportunities. This is a new distinct cohort, not replacement of the original0/30 probe-shove finding; no forced calling quota is introduced.','Negative aggregate means and broad intervals are retained; a finite adverse sample does not alone establish a coding defect or unrealistic play. Only run0 detailed traces are retained for each probe/archetype/model; complete3072 per-hand traces were not independently re-executed by this review.'],'limitations':['Normal32-sample intervals in the legacy probe report are descriptive only; public memory evolves across seeds, heavy tails and dependence limit frequentist interpretation.','Supplied source-match proof permits supplement attribution to unchanged runtime; supplement sourcecommit differs because test/CI metadata changed.','No expert, human-data calibration, solver validation or live-profit claim.']}
(OUT.parent/'bot-supplement-review.json').write_text(json.dumps(supp,indent=2)+'\n')
print(json.dumps({'supplementSource':supp['sourceCommit'],'runtimeInputsMatched':supp['runtimeInputsMatched'],'compiledAssetsMatched':supp['compiledAssetsMatchedAndRead'],'compositionRawReplays':960,'probeExampleReplays':len(probes['examples']),'output':str(OUT.parent/'bot-supplement-review.json')}))
