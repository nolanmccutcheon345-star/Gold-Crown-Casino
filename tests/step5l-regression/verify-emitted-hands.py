#!/usr/bin/env python3
"""Independent Python replay of emitted hand events; imports no application code."""
import sys,json,pathlib,gzip,hashlib,copy,datetime
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def integer(x):
 assert type(x) is int and 0<=x<=9007199254740991,('unsafe money',x)
 return x
def hand(r,post_blinds):
 events=r['events'];assert events and events[0]['type']=='start'
 ids=[e['id'] for e in events];assert len(ids)==len(set(ids)),'duplicate event'
 hid=events[0]['handId'];assert all(e['handId']==hid for e in events)
 initial={s['id']:integer(s['stack']) for s in r['initial']};assert len(initial)==len(r['initial'])
 if post_blinds:
  for e in events:
   if e['type']=='blind':initial[e['seatId']]+=integer(e['amount'])
 stacks=initial.copy();debits=refunds=rake=0;awards={k:0 for k in stacks};folded=set()
 previous=-1
 for e in events:
  assert e['revision']>=previous,'reordered revision';previous=e['revision']
  if e.get('action',{}).get('type')=='fold':folded.add(e['seatId'])
  kind=e['type']
  if kind not in ['blind','action','refund','award','rake']:continue
  n=integer(e['amount'])
  if kind=='rake':rake+=n;continue
  seat=e['seatId'];assert seat in stacks
  if kind in ['blind','action']:stacks[seat]-=n;debits+=n
  elif kind=='refund':stacks[seat]+=n;refunds+=n
  else:stacks[seat]+=n;awards[seat]+=n
  assert stacks[seat]>=0,'negative replay stack'
 final={s['id']:integer(s['stack']) for s in r.get('final',r.get('ending',[]))}
 assert final==stacks,'ending stacks disagree with event replay'
 assert sum(initial.values())==sum(stacks.values())+rake,'chip conservation'
 assert debits-refunds==sum(awards.values())+rake,'pot event reconciliation'
 payouts={int(k):integer(v) for k,v in r['payouts'].items()}
 assert {k:v for k,v in payouts.items() if v}=={k:v for k,v in awards.items() if v},'payout map mismatch'
 pot_payouts={k:0 for k in stacks};total_pots=0
 for pot in r['pots']:
  amount=integer(pot['amount']);total_pots+=amount
  winners=pot['winners'];eligible=pot['eligible']
  assert winners and len(winners)==len(set(winners)) and all(w in eligible and w not in folded for w in winners),'illegal pot winner'
  # Engine rule: odd chips clockwise from dealer, with actual seat IDs.
  order=sorted(winners,key=lambda s:(s-r['button']-1)%len(stacks))
  share,extra=divmod(amount,len(order))
  for i,s in enumerate(order):pot_payouts[s]+=share+(i<extra)
 assert total_pots==sum(awards.values()),'pot amounts mismatch'
 assert pot_payouts==awards,'split/odd chip payout mismatch'
 cards=[c for s in r['initial'] for c in s['cards']]+r['board']
 assert len(cards)==len(set(cards)) and all(len(c)==2 and c[0] in '23456789TJQKA' and c[1] in 'cdhs' for c in cards),'duplicate or invalid card'
 money=r.get('money',r.get('financial'))
 if money:
  assert {k:money[k] for k in ['paid','returned','awarded','rake','total']}=={'paid':debits,'returned':refunds,'awarded':sum(awards.values()),'rake':rake,'total':sum(initial.values())}
 return {'id':hid,'events':len(events),'rake':rake,'sidePots':int(len(r['pots'])>1),'refund':int(refunds>0),'split':int(any(len(p['winners'])>1 for p in r['pots']))}
def main(root,out):
 manifest=json.loads((root/'manifest.json').read_bytes());assert manifest['status']=='PASS';source=manifest['sourceCommit'];artifacts=[];result=[];first=None
 def consume(path,records,post):
  nonlocal first
  seen=set();n=0
  for r in records:
   got=hand(r,post);assert got['id'] not in seen;seen.add(got['id']);result.append(got);n+=1
   if first is None and any(e['type']=='award' and e.get('amount',0)>0 for e in r['events']):first=(r,post)
  artifacts.append({'path':str(path.relative_to(root)),'sha256':sha(path),'hands':n,'initialStacks':'after blind posting' if post else 'before blind posting'})
 for rel in ['','paired-reference']:
  base=root/rel;s=json.loads((base/'current-benchmark-summary.json').read_bytes());assert s['sourceCommit']==source and s['full']
  for row in s['summary']:
   p=base/row['rawArtifact'];consume(p,json.loads(gzip.decompress(p.read_bytes())),True)
 p=root/'composition-blocks.json.gz';blocks=json.loads(gzip.decompress(p.read_bytes()));consume(p,(r for b in blocks for r in b['records']),True)
 s=json.loads((root/'Y10-ecology.json').read_bytes());assert s['sourceCommit']==source and s['full']
 for row in s['rows']:
  p=root/row['artifact'];d=json.loads(gzip.decompress(p.read_bytes()));consume(p,d['records'],False)
 assert len(result)==7136,len(result)
 negative=[]
 for mutation in ['duplicate-event','wrong-ending','wrong-award','wrong-pot','wrong-payout','duplicate-card']:
  r=copy.deepcopy(first[0]);post=first[1]
  if mutation=='duplicate-event':r['events'].append(copy.deepcopy(r['events'][-1]))
  elif mutation=='wrong-ending':r.get('final',r.get('ending'))[0]['stack']+=1
  elif mutation=='wrong-award':next(e for e in r['events'] if e['type']=='award')['amount']+=1
  elif mutation=='wrong-pot':r['pots'][0]['amount']+=1
  elif mutation=='wrong-payout':k=next(iter(r['payouts']));r['payouts'][k]+=1
  elif mutation=='duplicate-card':r['initial'][1]['cards'][0]=r['initial'][0]['cards'][0]
  try:hand(r,post)
  except AssertionError:negative.append({'mutation':mutation,'status':'REJECTED'})
  else:raise AssertionError(('corruption accepted',mutation))
 report={'format':'ai-texas-step5l-independent-hand-replay','version':1,'status':'PASS','sourceCommit':source,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'manifestSHA256':sha(root/'manifest.json'),'scriptSHA256':sha(pathlib.Path(__file__)),'hands':len(result),'events':sum(r['events'] for r in result),'rakeCents':sum(r['rake'] for r in result),'sidePotHands':sum(r['sidePots'] for r in result),'refundHands':sum(r['refund'] for r in result),'splitHands':sum(r['split'] for r in result),'artifacts':artifacts,'corruptionChecks':negative,'limitations':['Independent arbitrary precision Python integer event/payout replay; no application imports.','This does not independently evaluate hand ranks or betting legality; separate PokerKit and engine tests cover those.','These7136 emitted hands are part of the executed release scenarios, not additional newly played hands or acceptance IDs.','Reference/composition initial stacks are documented postblind snapshots; ecology initial stacks are preblind startingStack.']}
 out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['status','sourceCommit','hands','events','sidePotHands','refundHands','splitHands']}))
if __name__=='__main__':main(pathlib.Path(sys.argv[1]),pathlib.Path(sys.argv[2]))
