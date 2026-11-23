"""Exact V8 retaining edges plus lossless heap artifact archival."""
import pathlib,sys,json,gzip,hashlib,shutil
folder=pathlib.Path(sys.argv[1]);p=folder/'after-unwind.heapsnapshot';report=json.loads((folder/'report.json').read_text())
s=json.loads(p.read_text());m=s['snapshot']['meta'];nf=m['node_fields'];ef=m['edge_fields'];nw=len(nf);ew=len(ef);ns=s['nodes'];es=s['edges'];strings=s['strings'];types=m['node_types'][0];etypes=m['edge_types'][0]
def node(o):return {'offset':o,'type':types[ns[o+nf.index('type')]],'name':strings[ns[o+nf.index('name')]],'selfBytes':ns[o+nf.index('self_size')]}
starts={};edge=0;targets={}
for n in range(0,len(ns),nw):
 starts[n]=edge;properties={}
 for e in range(edge,edge+ns[n+nf.index('edge_count')]*ew,ew):
  if etypes[es[e+ef.index('type')]]=='property':properties[strings[es[e+ef.index('name_or_index')]]]=es[e+ef.index('to_node')]
 edge+=ns[n+nf.index('edge_count')]*ew
 if 'id'in properties and node(properties['id'])['name']==report['firstHandId']:targets[n]={'node':node(n),'properties':list(properties),'fullHand':all(k in properties for k in ['view','frames','privateProfiles'])}
def incoming(offsets):
 result=[]
 for n,start in starts.items():
  for e in range(start,start+ns[n+nf.index('edge_count')]*ew,ew):
   to=es[e+ef.index('to_node')]
   if to not in offsets:continue
   typ=etypes[es[e+ef.index('type')]];raw=es[e+ef.index('name_or_index')];name=raw if typ in ('element','hidden') else strings[raw]
   if typ not in ('weak',):result.append({'from':node(n),'edgeType':typ,'edge':name,'to':node(to)})
 return result
values=[e for e in incoming(targets) if e['from']['type']=='array'];tables=[e for e in incoming({e['from']['offset'] for e in values}) if e['edge']=='table' and e['from']['name']=='Map'];owners=[e for e in incoming({e['from']['offset'] for e in tables}) if e['edge']=='hands']
chains=[]
for owner in owners:
 for table in tables:
  if table['from']['offset']!=owner['to']['offset']:continue
  for value in values:
   if value['from']['offset']==table['to']['offset']:chains.append({'checkpointHands':owner,'mapTable':table,'tableValue':value,'hand':targets[value['to']['offset']]})
assert chains,'Expected exact checkpoint.hands Map path not found'
assert all(c['hand']['fullHand']==(not report['expectCollected']) for c in chains)
rawsha=hashlib.sha256(p.read_bytes()).hexdigest();(folder/'checkpoint-retainers.json').write_text(json.dumps({'status':'OBSERVED','method':'Exact heap graph checkpoint object property hands -> Map internal table -> first archived hand identity; compact snapshot remains live, original AppData and reader rows released. WeakRef assertion is independent.','rawHeapSHA256':rawsha,'firstHandId':report['firstHandId'],'paths':chains},indent=2)+'\n')
gz=p.with_suffix(p.suffix+'.gz')
with p.open('rb') as source,gz.open('wb') as dest:
 with gzip.GzipFile(filename='',mode='wb',fileobj=dest,mtime=0) as encoded:shutil.copyfileobj(source,encoded)
check=hashlib.sha256()
with gzip.open(gz,'rb') as f:
 for chunk in iter(lambda:f.read(1024*1024),b''):check.update(chunk)
assert check.hexdigest()==rawsha
record={'rawBytes':p.stat().st_size,'rawSHA256':rawsha,'compressedBytes':gz.stat().st_size,'compressedSHA256':hashlib.sha256(gz.read_bytes()).hexdigest(),'parts':[]}
if gz.stat().st_size>20*1024*1024:
 with gz.open('rb') as f:
  i=0
  while chunk:=f.read(20*1024*1024):
   i+=1;part=gz.with_name(gz.name+f'.part-{i:03d}');part.write_bytes(chunk);record['parts'].append({'path':part.name,'bytes':len(chunk),'sha256':hashlib.sha256(chunk).hexdigest()})
 gz.unlink()
else:record['parts']=[{'path':gz.name,'bytes':gz.stat().st_size,'sha256':record['compressedSHA256']}]
(folder/'heap-artifact.json').write_text(json.dumps(record,indent=2)+'\n');p.unlink()
print(json.dumps({'directory':str(folder),'paths':len(chains),'retainedFullHand':any(c['hand']['fullHand'] for c in chains),'valueProperties':[c['hand']['properties'] for c in chains],'compressedBytes':record['compressedBytes']}))
