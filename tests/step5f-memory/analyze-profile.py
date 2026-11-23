"""Read actual V8 heap/CPU artifacts; no inferred production call attribution."""
import pathlib,sys,json,hashlib,gzip,shutil
folder=pathlib.Path(sys.argv[1]);target=sys.argv[2] if len(sys.argv)>2 else 'frozen'
assert target in ('frozen','immutableNodes')
p=folder/'after-unwind.heapsnapshot'
s=json.loads(p.read_text());meta=s['snapshot']['meta'];nf=meta['node_fields'];ef=meta['edge_fields'];nw=len(nf);ew=len(ef);ns=s['nodes'];es=s['edges'];strings=s['strings'];types=meta['node_types'][0];etypes=meta['edge_types'][0]
def node(offset):return {'offset':offset,'type':types[ns[offset+nf.index('type')]],'name':strings[ns[offset+nf.index('name')]],'selfBytes':ns[offset+nf.index('self_size')],'edgeCount':ns[offset+nf.index('edge_count')]}
starts={};offset=0;frozen=[]
for n in range(0,len(ns),nw):
 starts[n]=offset
 for e in range(offset,offset+ns[n+nf.index('edge_count')]*ew,ew):
  typ=etypes[es[e+ef.index('type')]]
  if typ=='context' and strings[es[e+ef.index('name_or_index')]]==target:frozen.append({'from':node(n),'edge':target,'to':node(es[e+ef.index('to_node')])})
 offset+=ns[n+nf.index('edge_count')]*ew
chains=[]
for ref in frozen:
 n=ref['to']['offset'];start=starts[n]
 for e in range(start,start+ns[n+nf.index('edge_count')]*ew,ew):
  typ=etypes[es[e+ef.index('type')]]
  if typ=='internal' and strings[es[e+ef.index('name_or_index')]]=='table':chains.append({'moduleToCache':ref,'cacheToTable':{'from':node(n),'edge':'table','to':node(es[e+ef.index('to_node')])}})
assert chains and all(c['moduleToCache']['to']['name']=='WeakSet' for c in chains)
raw_hash=hashlib.sha256(p.read_bytes()).hexdigest();out={'status':'OBSERVED','rawHeapSHA256':raw_hash,'modulePrivateFrozenTables' if target=='frozen' else 'modulePrivatePackedTables':chains,'method':f'Exact V8 heap graph context edge named {target} -> WeakSet -> internal table, after 8 event-loop/GC cycles. Does not infer original 10s bot cause.'}
(folder/'heap-retainers.json').write_text(json.dumps(out,indent=2)+'\n')
cpu=json.loads((folder/'cpu.cpuprofile.json').read_text());nodes={n['id']:n for n in cpu['nodes']};counts={}
for key,dt in zip(cpu.get('samples',[]),cpu.get('timeDeltas',[])):
 frame=nodes[key]['callFrame'];name=frame['functionName'] or '(anonymous)';row=counts.setdefault(name,{'function':name,'samples':0,'sampleIntervalUs':0});row['samples']+=1;row['sampleIntervalUs']+=dt
(folder/'cpu-summary.json').write_text(json.dumps({'scope':'Inspector sampling interval attribution, not direct process CPU or normal bot latency','sampledDurationUs':cpu['endTime']-cpu['startTime'],'topFunctions':sorted(counts.values(),key=lambda x:-x['sampleIntervalUs'])[:20]},indent=2)+'\n')
gz=p.with_suffix(p.suffix+'.gz')
with p.open('rb') as src,gz.open('wb') as dest:
 with gzip.GzipFile(filename='',mode='wb',fileobj=dest,mtime=0) as encoded:shutil.copyfileobj(src,encoded)
check=hashlib.sha256()
with gzip.open(gz,'rb') as file:
 for chunk in iter(lambda:file.read(1024*1024),b''):check.update(chunk)
assert check.hexdigest()==raw_hash
record={'format':'verified-gzip-heap-artifact','rawBytes':p.stat().st_size,'rawSHA256':raw_hash,'compressedBytes':gz.stat().st_size,'compressedSHA256':hashlib.sha256(gz.read_bytes()).hexdigest(),'parts':[]}
if gz.stat().st_size>20*1024*1024:
 with gz.open('rb') as source:
  i=0
  while chunk:=source.read(20*1024*1024):
   i+=1;name=gz.name+f'.part-{i:03d}';(folder/name).write_bytes(chunk);record['parts'].append({'path':name,'bytes':len(chunk),'sha256':hashlib.sha256(chunk).hexdigest()})
 gz.unlink()
else:record['parts']=[{'path':gz.name,'bytes':gz.stat().st_size,'sha256':record['compressedSHA256']}]
(folder/'heap-artifact.json').write_text(json.dumps(record,indent=2)+'\n');p.unlink()
print(json.dumps({'directory':str(folder),'tables':[c['cacheToTable']['to']['selfBytes'] for c in chains],'rawBytes':record['rawBytes'],'compressedBytes':record['compressedBytes']}))
