from pathlib import Path
import argparse,json,gzip,hashlib,shutil,csv,collections,statistics
parser=argparse.ArgumentParser();parser.add_argument('--baseline',required=True);parser.add_argument('--heldout',required=True);parser.add_argument('--out',default='tests/step4c/evidence');args=parser.parse_args()
base=Path(args.baseline);held=Path(args.heldout);out=Path(args.out);out.mkdir(exist_ok=True,parents=True);manifest=[]
def read(p):return json.loads(gzip.decompress(p.read_bytes()))if p.suffix=='.gz'else json.loads(p.read_text())
def save(name,obj):
 raw=json.dumps(obj,separators=(',',':')).encode();dest=out/(name+'.json.gz');dest.write_bytes(gzip.compress(raw,mtime=0));manifest.append({'file':dest.name,'rawSha256':hashlib.sha256(raw).hexdigest(),'rawBytes':len(raw),'compressedBytes':dest.stat().st_size})
for folder,cohort,model in [(base,'development','baseline-1.1'),(held,'heldout','baseline-1.1'),(held,'heldout','candidate-1.2')]:
 for mode in ['population','probe']:
  paths=sorted(folder.glob(f'{model}-{cohort}-population-block-*.json.gz'))if mode=='population'else sorted(p for p in folder.glob(f'{model}-{cohort}-*.json.gz')if'population-block-'not in p.name)
  save(f'{model}-{cohort}-{mode}-blocks',[read(p)for p in paths]);save(f'{model}-{cohort}-{mode}-summary',read(folder/f'{model}-{cohort}-{mode}-summary.json'));save(f'{model}-{cohort}-{mode}-run',read(folder/f'{model}-{cohort}-{"population"if mode=="population"else"probes"}-run.json'))
for folder,model in [(base,'baseline-1.1'),(held,'candidate-1.2')]:save(f'{model}-conditional',read(folder/f'{model}-conditional.json.gz'))
save('candidate-1.2-sidepots',read(held/'candidate-1.2-sidepots.json.gz'))
sizes={}
for path in held.glob('candidate-1.2-heldout-population-block-*.json.gz'):
 for row in read(path)['sizing']:
  if row['street']!='preflop':sizes.setdefault((row['archetype'],row['street'],row['category']),[]).append(row['incrementPot'])
sizingRows=[]
for key,values in sorted(sizes.items()):
 sizingRows.append(dict(zip(['archetype','street','handClass'],key))|{'n':len(values),'medianIncrementPot':statistics.median(values),'min':min(values),'max':max(values),'bins':dict(collections.Counter('<=.4'if x<=.4 else'(.4,.75]'if x<=.75 else'(.75,1.25]'if x<=1.25 else'>1.25'for x in values)),'status':'SPARSE_CONFOUNDED'if len(values)<100 else'OBSERVED_DESCRIPTIVE_NOT_TELL_FREE'})
save('sizing-diagnostics',{'definition':'Actual postflop raise increment/(pot after raiser calls). Exact evaluator hand class. Confounded by board, price, position and multiway context. Overlap or association alone neither establishes nor rules out exploitable tells.','rows':sizingRows})
old=read(held/'baseline-1.1-heldout-population-summary.json');new=read(held/'candidate-1.2-heldout-population-summary.json')
with(out/'population-key-rates.csv').open('w')as f:
 w=csv.writer(f);w.writerow(['archetype','metric','before_count','before_opportunities','after_count','after_opportunities','after_percent','cluster_low','cluster_high','blocks','coverage'])
 for a,ms in new['rates'].items():
  for m,v in ms.items():
   o=old['rates'].get(a,{}).get(m,{});ci=v['clusterBootstrap95']or['',''];w.writerow([a,m,o.get('count',''),o.get('opportunities',''),v['count'],v['opportunities'],v['percent'],*ci,v['blocks'],v['coverage']])
bc=read(base/'baseline-1.1-conditional.json.gz');cc=read(held/'candidate-1.2-conditional.json.gz');packet=[]
for model,data in [('baseline-1.1',bc),('candidate-1.2',cc)]:
 for e in data['examples']:
  if e['variant']==0 and(e['family'],e['archetype'])in[('small-river-pair','tag'),('large-river-pair','station'),('missed-river-draw','lag'),('river-air','maniac'),('short-price','stronger-reg'),('multiway-price','nit')]:
   classification='MECHANICAL_DEFECT_CONFIRMED'if model=='baseline-1.1'and e['family']in['short-price','multiway-price']else'ANALYTICAL_REVIEW_CANDIDATE'
   packet.append({'reviewStatus':'NOT_REVIEWED_BY_EXTERNAL_EXPERT','classification':classification,'model':model,'reason':'Independent pot-price arithmetic confirms baseline defect'if classification.startswith('MECHANICAL')else'Complete legal line selected for evaluation; strategic quality requires independent review, not inferred from winning.',**e})
probe=read(held/'candidate-1.2-heldout-probe-shove-stronger-reg-1.json.gz');packet.append({'reviewStatus':'NOT_REVIEWED_BY_EXTERNAL_EXPERT','classification':'HYPOTHETICAL_WEAKNESS','model':'candidate-1.2','reason':'A5 top pair folds a large turn shove against a fixed pressure probe. This individual fold can be reasonable under uncertain public ranges; combined0/30 continuation sample motivates longer adaptation evaluation, not a confirmed mechanical bug.','record':probe['hands'][1]})
side=read(held/'candidate-1.2-sidepots.json.gz');packet.append({'reviewStatus':'NOT_REVIEWED_BY_EXTERNAL_EXPERT','classification':'MECHANICS_VERIFIED_STRATEGY_NOT_EXTERNALLY_JUDGED','reason':'Private top set continues, main/side-pot settlement independently reconciles.',**side['examples'][0]})
save('expert-review-packet',{'status':'AWAITING_EXTERNAL_EXPERT','notice':'All cards in this test-only packet are post-hand audit data, never sent to another acting bot. Scripted prefixes identified. Not production history export.','hands':packet})
(out/'manifest.json').write_text(json.dumps({'protocol':'tests/step4c/PROTOCOL.md','artifacts':manifest,'humanValidation':'NOT_EXECUTED','expertReview':'NOT_EXECUTED'},indent=2)+'\n')
for name in ['step4c-baseline-population.log','step4c-baseline-probes.log','step4c-baseline-conditional.log','step4c-heldout-baseline-population.log','step4c-heldout-candidate-population.log','step4c-heldout-baseline-probes.log','step4c-heldout-candidate-probes.log','step4c-heldout-candidate-conditional.log','step4c-sidepots.log']:
 shutil.copyfile(base.parent/name,out/name)
print(json.dumps({'artifacts':len(manifest),'totalBytes':sum(p.stat().st_size for p in out.iterdir()),'reviewHands':len(packet)}))
summary={'datasets':[],'model':'synthetic-cash-1.2.0','statisticalScope':'Synthetic controlled experiments; not human calibration or mathematical exploitability.'};total=actions=0
for folder,cohort,model in [(base,'development','baseline-1.1'),(held,'heldout','baseline-1.1'),(held,'heldout','candidate-1.2')]:
 for mode in ['population','probe']:
  p=read(folder/f'{model}-{cohort}-{mode}-summary.json');summary['datasets'].append({'model':model,'cohort':cohort,'mode':mode,'hands':p['completedHands'],'actions':p['decisions']});total+=p['completedHands'];actions+=p['decisions']
for folder,model in [(base,'baseline-1.1'),(held,'candidate-1.2')]:
 p=read(folder/f'{model}-conditional.json.gz');n=len(p['examples']);a=sum(e['record']['money']['actions']for e in p['examples']);summary['datasets'].append({'model':model,'cohort':'conditional-heldout','mode':'conditional','hands':n,'actionsIncludingScriptedPrefixes':a,'firstResponseSamples':p['totalSampledDecisions'],'allSamplesIndependentlyLegal':p['allSamplesIndependentlyLegal']});total+=n;actions+=a
p=read(held/'candidate-1.2-sidepots.json.gz');n=p['completedHands'];a=sum(e['record']['money']['actions']for e in p['examples']);summary['datasets'].append({'model':'candidate-1.2','cohort':'coverage-followup','mode':'sidepot','hands':n,'actionsIncludingScriptedPrefixes':a});total+=n;actions+=a
summary['completedHands']=total;summary['legalActionEventsIncludingIdentifiedScriptedPrefixes']=actions;summary['firstResponseSamples']=sum(x.get('firstResponseSamples',0)for x in summary['datasets']);(out/'analysis-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
