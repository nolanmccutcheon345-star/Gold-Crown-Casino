#!/usr/bin/env python3
"""Independent public-export checker. No engine/storage/application imports.
Multiple original export batches have separate public hash chains. Account match
requires separately recorded visible observations; an export cannot prove cashout IDs.
"""
import argparse,copy,datetime,hashlib,json,pathlib,sys
if not __debug__:
 raise RuntimeError('Run without Python -O; verification assertions must be enabled')
GENESIS='0'*64
FORBIDDEN={'deck','deckCursor','burned','privateProfiles','profiles','drawToken','pending','ownCards','seed','policyVersion','archetype','observationHash','lastActedBet','personalityId','personalitySeed','traits','memory','opponents','skill','aggression','looseness','ranges','foldedOpponents','rangeAnalysis','weightedCombos','distribution','diagnostics','preflop'}
def canonical(v):
 if isinstance(v,dict):return '{'+','.join(json.dumps(k,ensure_ascii=False)+':'+canonical(v[k]) for k in sorted(v,key=lambda k:k.encode('utf-16-be')))+'}'
 if isinstance(v,list):return '['+','.join(map(canonical,v))+']'
 if isinstance(v,float):raise AssertionError('Floating-point canonicalization needs explicit independent support; no hash PASS inferred')
 return json.dumps(v,ensure_ascii=False,separators=(',',':'))
def digest(v):return hashlib.sha256(canonical(v).encode()).hexdigest()
def integer(n,signed=False):
 assert type(n) is int and abs(n)<=9007199254740991 and (signed or n>=0),('unsafe amount',n)
 return n
def private(v):
 if isinstance(v,dict):
  assert not (set(v)&FORBIDDEN),('private key',set(v)&FORBIDDEN)
  for x in v.values():private(x)
 elif isinstance(v,list):
  for x in v:private(x)
def load(path):
 def unique(pairs):
  out={}
  for k,v in pairs:assert k not in out,('duplicate JSON key',k);out[k]=v
  return out
 return json.loads(pathlib.Path(path).read_bytes(),object_pairs_hook=unique)
def cash(view,settled):
 seats=view['seats'];initial={s['id']:integer(s['startingStack']) for s in seats};assert len(initial)==len(seats) and 0 in initial
 assert 2<=len(seats)<=10;stacks=initial.copy();ids=set();decisions=set();awards={s:0 for s in stacks};paid=refunded=rake=0;revision=-1
 for e in view['events']:
  assert e['id'] not in ids and e['handId']==view['handId'];ids.add(e['id'])
  assert integer(e['revision'])>=revision;revision=e['revision']
  if e['type']=='action':assert e.get('decisionId') and e['decisionId'] not in decisions;decisions.add(e['decisionId'])
  if e['type'] not in ['blind','action','refund','award','rake']:continue
  n=integer(e['amount'])
  if e['type']=='rake':rake+=n;continue
  seat=e['seatId'];assert seat in stacks
  if e['type'] in ['blind','action']:stacks[seat]-=n;paid+=n
  elif e['type']=='refund':stacks[seat]+=n;refunded+=n
  else:stacks[seat]+=n;awards[seat]+=n
  assert stacks[seat]>=0
 assert stacks=={s['id']:integer(s['stack']) for s in seats},'event/frame stack mismatch'
 assert sum(initial.values())==sum(stacks.values())+integer(view['pot'])+integer(view['rake']),'frame conservation'
 assert rake==view['rake']
 cards=view['board']+[c for s in seats for c in s['hole']]
 assert len(cards)==len(set(cards)) and all(len(c)==2 and c[0] in '23456789TJQKA' and c[1] in 'cdhs' for c in cards)
 for s in seats:
  assert len(s['hole']) in [0,2]
  if s['id']!=0:
   if not settled or s['folded']:assert s['hole']==[],'premature/mucked opponent cards'
   if s['hole']:assert str(s['id']) in view.get('handLabels',{}),'unpermitted showdown reveal'
 if settled:
  assert view['street']=='complete' and view['actor'] is None and view['pot']==0
  assert paid-refunded==sum(awards.values())+rake
  assert {int(k):v for k,v in view['payouts'].items() if v}=={k:v for k,v in awards.items() if v}
  pot_awards={s:0 for s in stacks};unit=integer(view['profile']['chipUnit']);assert unit>0
  for pot in view['pots']:
   amount=integer(pot['amount']);assert amount%unit==0
   winners=pot['winners'];assert winners and len(set(winners))==len(winners)
   assert all(w in pot['eligible'] and not next(s for s in seats if s['id']==w)['folded'] for w in winners)
   order=sorted(winners,key=lambda s:(s<=view['button'],s));share,extra=divmod(amount//unit,len(order))
   for i,s in enumerate(order):pot_awards[s]+=(share+(i<extra))*unit
  assert pot_awards==awards,'pot/split/odd-chip disagreement'
  rule=view['profile']['rake'];netpot=paid-refunded
  if rule['noFlopNoDrop'] and len(view['board'])<3:expected_rake=0
  else:
   whole,remainder=divmod(netpot*integer(rule['basisPoints']),10000*unit)
   if rule.get('rounding','floor')=='half-even' and (remainder*2>10000*unit or remainder*2==10000*unit and whole%2):whole+=1
   else:assert rule.get('rounding','floor') in ['floor','half-even']
   expected_rake=min(integer(rule['cap']),whole*unit)
  assert expected_rake==rake,'analytical rake mismatch'
 return {'net':stacks[0]-initial[0],'events':len(ids),'decisions':len(decisions),'rake':rake,'refunds':refunded,'awards':sum(awards.values())}
def validate(payloads,observations=None):
 seen=set();sessions={};rows=[];frames=0;reveal_frames=0
 for payload in payloads:
  assert payload['format']=='ai-texas-hold-em-public-history' and payload['version']=='0.3.0'
  assert isinstance(payload['hands'],list);private(payload);previous=GENESIS
  for h in payload['hands']:
   assert h['kind']=='public-redacted' and h['version']=='0.3.0'
   assert h['handId'] not in seen;seen.add(h['handId'])
   assert h['previousHash']==previous and h['hash']==digest({k:v for k,v in h.items() if k!='hash'}),'public chain/hash mismatch';previous=h['hash']
   start=datetime.datetime.fromisoformat(h['startedAt'].replace('Z','+00:00'));end=datetime.datetime.fromisoformat(h['endedAt'].replace('Z','+00:00'));assert end>=start
   view=h['view'];assert view['handId']==h['handId'];result=cash(view,True);assert integer(h['net'],True)==result['net']
   assert h['frames'] and h['frames'][-1]==view;last=-1;eventcount=0
   for f in h['frames']:
    assert f['handId']==h['handId'] and f['revision']>last and len(f['events'])>=eventcount
    assert f['profile']==view['profile'] and f['button']==view['button']
    assert f['events']==view['events'][:len(f['events'])] and f['board']==view['board'][:len(f['board'])],'replay prefix mismatch'
    cash(f,f['street']=='complete');frames+=1;reveal_frames+=sum(bool(s['hole']) for s in f['seats'] if s['id']!=0)
    last=f['revision'];eventcount=len(f['events'])
   s=sessions.setdefault(h['sessionId'],{'hands':0,'netCents':0,'numbers':[]});s['hands']+=1;s['netCents']+=h['net'];s['numbers'].append(h['number'])
   rows.append({'handId':h['handId'],'sessionId':h['sessionId'],'number':h['number'],'seats':len(view['seats']),**result})
 for s in sessions.values():
  assert len(set(s['numbers']))==s['hands'] and all(b>a for a,b in zip(s['numbers'],s['numbers'][1:]))
 total=sum(r['net'] for r in rows);observed='NOT_SUPPLIED'
 if observations is not None:
  assert observations.get('evidence'),'Visible observations need evidence references'
  assert observations['totalHands']==len(rows) and observations['totalPokerNetCents']==total
  for s in observations.get('sessions',[]):
   actual=sessions[s['id']];assert s['hands']==actual['hands'] and s['netCents']==actual['netCents']
  if observations.get('completeCanonicalHistory'):
   for s in sessions.values():assert s['numbers']==list(range(1,s['hands']+1))
   initial=integer(observations['initialWalletCents']);manual=integer(observations.get('manualAdjustmentCents',0),True)
   assert integer(observations['walletCents'])+integer(observations['tableCents'])==initial+manual+total,'visible account/hand P&L disagreement'
   observed='MATCHED_VISIBLE_TOTALS_AND_ACCOUNT_EQUATION'
  else:observed='MATCHED_VISIBLE_HAND_AND_RESULT_TOTALS_ONLY'
 seatCounts=sorted({r['seats'] for r in rows})
 return {'hands':len(rows),'sessions':sessions,'frames':frames,'totalNetCents':total,'totalRakeCents':sum(r['rake'] for r in rows),'events':sum(r['events'] for r in rows),'actions':sum(r['decisions'] for r in rows),'refundHands':sum(r['refunds']>0 for r in rows),'seatCounts':seatCounts,'handsBySeatCount':{str(n):sum(r['seats']==n for r in rows) for n in seatCounts},'perHand':rows,'visibleObservationCheck':observed}
def reseal(payload):
 previous=GENESIS
 for h in payload['hands']:
  h['previousHash']=previous;h['hash']=digest({k:v for k,v in h.items() if k!='hash'});previous=h['hash']
def main():
 p=argparse.ArgumentParser();p.add_argument('inputs',nargs='+');p.add_argument('--output',required=True);p.add_argument('--observations');p.add_argument('--expected-hands',type=int);a=p.parse_args()
 out=pathlib.Path(a.output);assert not out.exists(),'Preserve previous evidence; choose a new output path'
 files=[pathlib.Path(s) for s in a.inputs];payloads=[load(f) for f in files];obs=load(a.observations) if a.observations else None;result=validate(payloads,obs)
 if a.expected_hands is not None:assert result['hands']==a.expected_hands
 result={'format':'ai-texas-step5l-independent-public-history-verification','version':1,'status':'PASS','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'validatorSHA256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),'inputArtifacts':[{'path':str(f),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in files],'observationsArtifact':{'path':a.observations,'sha256':hashlib.sha256(pathlib.Path(a.observations).read_bytes()).hexdigest()} if a.observations else None,**result,'limitations':['Independent public event arithmetic, public hash chain, redaction, replay, rake and split-pot verification; no production imports. This is not an independent hand-ranking or full betting-legality evaluator.','Public exports lack private deck/seed and compiled build identity. Link actual browser/source evidence separately; do not infer unseen cards or source commit from this file.','Public export contains no buy-in/cashout financial event IDs. Matching visible account totals does not independently prove uniqueness of those ledger IDs.','Actual browser execution and device identity come from separately retained observations; this validator does not drive a browser or create test hands.']}
 out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['status','hands','frames','events','actions','totalNetCents','visibleObservationCheck']}))
if __name__=='__main__':main()
