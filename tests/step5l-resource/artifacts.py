#!/usr/bin/env python3
"""Lossless source-friendly parts for large resource evidence; Python stdlib only."""
import argparse,hashlib,json,os
from pathlib import Path
CHUNK=8*1024*1024
NAMES=('0-trace.jsonl.gz','canonical-segments.jsonl.gz')
p=argparse.ArgumentParser();p.add_argument('mode',choices=('pack','verify','restore'));p.add_argument('directory',type=Path);a=p.parse_args();root=a.directory;manifest_path=root/'archive-parts.json'
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for block in iter(lambda:f.read(CHUNK),b''):h.update(block)
 return h.hexdigest()
if a.mode=='pack':
 assert not manifest_path.exists(),'Refusing to overwrite archive manifest'
 report=json.loads((root/'0-report.json').read_text());independent=json.loads((root/'independent-archive-verification.json').read_text())
 assert report['status']==independent['status']=='PASS'
 assert report['completedHands']==independent['canonicalHands']
 folder=root/'archives';folder.mkdir(exist_ok=True);entries=[]
 for name in NAMES:
  original=root/name;parts=[];total=hashlib.sha256();size=0
  with original.open('rb') as f:
   for n,block in enumerate(iter(lambda:f.read(CHUNK),b''),1):
    path=folder/f'{name}.part-{n:03d}';assert not path.exists(),'Refusing to overwrite evidence part'
    with path.open('xb') as output:output.write(block)
    digest=hashlib.sha256(block).hexdigest();assert sha(path)==digest
    parts.append({'path':str(path.relative_to(root)),'bytes':len(block),'sha256':digest});size+=len(block);total.update(block)
  assert size==original.stat().st_size and total.hexdigest()==sha(original)
  entries.append({'original':name,'bytes':size,'sha256':total.hexdigest(),'parts':parts})
 manifest={'format':'step5l-lossless-resource-parts-1','partByteLimit':CHUNK,'applicationCommit':report['source']['applicationCommit'],'completedHands':report['completedHands'],'entries':entries}
 manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
manifest=json.loads(manifest_path.read_text());assert manifest['format']=='step5l-lossless-resource-parts-1'
assert tuple(e['original'] for e in manifest['entries'])==NAMES
for entry in manifest['entries']:
 original=root/entry['original'];total=hashlib.sha256();count=0;temporary=None;output=None
 if a.mode=='restore' and not original.exists():
  temporary=original.with_name(original.name+'.reassembling');output=temporary.open('xb')
 try:
  for part in entry['parts']:
   relative=Path(part['path']);assert not relative.is_absolute() and '..' not in relative.parts and relative.parts[0]=='archives'
   file=root/relative;assert file.stat().st_size==part['bytes']<=CHUNK
   block=file.read_bytes();assert hashlib.sha256(block).hexdigest()==part['sha256'];total.update(block);count+=len(block)
   if output:output.write(block)
  assert count==entry['bytes'] and total.hexdigest()==entry['sha256']
  if output:output.close();output=None;os.replace(temporary,original);temporary=None
  if original.exists():assert original.stat().st_size==entry['bytes'] and sha(original)==entry['sha256']
 finally:
  if output:output.close()
  if temporary and temporary.exists():temporary.unlink()
print(json.dumps({'status':'PASS','mode':a.mode,'completedHands':manifest['completedHands'],'files':[{'path':e['original'],'bytes':e['bytes'],'sha256':e['sha256'],'parts':len(e['parts'])} for e in manifest['entries']]}))
