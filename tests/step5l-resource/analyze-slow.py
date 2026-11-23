#!/usr/bin/env python3
"""Attribute only observed slow operations, never the untraced historical stall."""
import gzip,json,sys
from pathlib import Path
p=Path(sys.argv[1]);report=json.loads((p/'0-report.json').read_text());assert report['status']=='PASS'
slow={r['span']['decision']:r for r in report['slow']};events={k:[] for k in slow}
with gzip.open(p/'0-trace.jsonl.gz','rt') as f:
 for line in f:
  row=json.loads(line);key=row['decision']
  if key in slow:
   span=slow[key]['span']
   if row['start']<span['end'] and row['end']>span['start']:events[key].append(row)
rows=[]
for decision,item in sorted(slow.items(),key=lambda x:-x[1]['span']['ms']):
 span=item['span'];families={}
 for event in events[decision]:
  if event['name']=='ordinary.bot.prepare':continue
  a=families.setdefault(event['name'],{'count':0,'maxMs':0,'sumNestedMs':0});a['count']+=1;a['maxMs']=max(a['maxMs'],event['ms']);a['sumNestedMs']+=event['ms']
 overlapping=[g for g in report['gc'] if g['start']<span['end'] and g['end']>span['start']]
 rows.append({'decision':decision,'ordinaryPreparationMs':span['ms'],'span':span,'measuredNestedOperations':families,'overlappingGC':overlapping,'gcOverlapMs':sum(max(0,min(span['end'],g['end'])-max(span['start'],g['start'])) for g in overlapping),'memoryAtCompletion':item['memory'],'hostLoad':item['hostLoad'],'observationRecordedInReport':True})
out={'status':'MEASURED_NEW_EVENTS_ONLY','applicationCommit':report['source']['applicationCommit'],'preparations':report['decisions'],'ordinaryMaximumMs':report['ordinaryPreparation']['max'],'slowSamplesRetained':len(rows),'retention':'20slowest observed ordinary preparations above250ms; full trace retains all measured spans.','samples':rows,'interpretation':['Nested spans overlap and their sums cannot be added as separate walltime.','GC overlap is measured, not proof that all overlapped walltime was caused by GC.','NoCPUprofile was captured in this sustained resource run.','Reported host load and concurrent-work.json disclose shared-host execution.','This does not attribute or resolve the original untraced10.072-second event.']}
(p/'slow-events.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({k:out[k] for k in ['status','preparations','ordinaryMaximumMs','slowSamplesRetained']}))
