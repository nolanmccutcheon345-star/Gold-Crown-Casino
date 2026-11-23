#!/usr/bin/env python3
"""Read a stable complete-line prefix of a live trace; never reports test PASS."""
from pathlib import Path
import json,hashlib,datetime,sys
folder=Path(sys.argv[1]);out=folder/sys.argv[2];assert not out.exists(), 'Preserve prior interim evidence'
p=folder/'0-trace.jsonl';limit=p.stat().st_size;complete=0;sha=hashlib.sha256();rows=[]
with p.open('rb') as f:
 while f.tell()<limit:
  b=f.readline()
  if not b.endswith(b'\n') or f.tell()>limit:break
  complete=f.tell();sha.update(b)
  if b'"name":"ordinary.bot.prepare"' in b:rows.append(json.loads(b))
peak=max(rows,key=lambda x:x['ms']);children=[];needle=('"decision":'+str(peak['decision'])+',').encode()
with p.open('rb') as f:
 while f.tell()<complete:
  b=f.readline()
  if needle in b:
   r=json.loads(b)
   if r['start']<peak['end'] and r['end']>peak['start']:children.append(r)
result={'status':'RUNNING_INTERIM_NOT_FINAL','observedAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'observedFileBytes':limit,'completeTracePrefixBytes':complete,'traceCompleteRowsSHA256':sha.hexdigest(),'ordinaryPreparations':len(rows),'overOneSecond':sum(r['ms']>1000 for r in rows),'maximum':peak,'overlappingMeasuredSpans':sorted(children,key=lambda x:-x['ms']),'limitations':['Full run has not completed; this is not U12 PASS.','GC overlap data remains in live profiler until final report; current nested spans do not independently prove causation.','Historical10.072-second event remains unattributed.']}
out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['status','ordinaryPreparations','overOneSecond','maximum']}))
