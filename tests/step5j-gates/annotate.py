"""Post-execution metadata only; never promote original requirement statuses."""
import csv, hashlib, io, json, pathlib, subprocess
root=pathlib.Path('.')
p=root/'ACCEPTANCE_STATUS.csv'
old=p.read_bytes(); rows=list(csv.DictReader(io.StringIO(old.decode())))
qualified=list(csv.DictReader((root/'tests/step5j-gates/release-status.csv').open()))
index={r['id']:r for r in qualified}; assert len(index)==len(rows)==302
frozen=subprocess.check_output(['git','show','138cdcf325129c69f127d0e16bc94942abea752f:ACCEPTANCE_STATUS.csv'])
columns=['candidate_source','candidate_qualification','candidate_basis','candidate_evidence','candidate_next_action','candidate_execution_register_sha256','candidate_annotation_basis']
for r in rows:
 q=index[r['id']]
 for k in r:
  if k not in columns: assert r[k]==q[k],(r['id'],k)
 r.update(candidate_source=q['step5j_candidate'],candidate_qualification=q['step5j_qualification'],candidate_basis=r['r1_gate_basis'],candidate_evidence=q['step5j_evidence'],candidate_next_action=q['step5j_next_action'],candidate_execution_register_sha256=hashlib.sha256(frozen).hexdigest(),candidate_annotation_basis='POST_EXECUTION_METADATA; Step5J reviewed evidence; original statuses and immutable executed inputs preserved')
 q.update({k:r[k] for k in columns})
for path,items in [(p,rows),(root/'tests/step5j-gates/release-status.csv',qualified)]:
 with path.open('w',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(items[0]),quoting=csv.QUOTE_ALL,lineterminator='\n');w.writeheader();w.writerows(items)
receipt={'originalStatusPromotions':[],'candidateSource':'138cdcf325129c69f127d0e16bc94942abea752f','beforeRegisterSHA256':hashlib.sha256(old).hexdigest(),'afterRegisterSHA256':hashlib.sha256(p.read_bytes()).hexdigest(),'executedRegisterSHA256':hashlib.sha256(frozen).hexdigest(),'annotationOnly':True}
(root/'TEST_EVIDENCE/step5j/registry-annotation.json').write_text(json.dumps(receipt,indent=2))
print('302 original rows/statuses preserved; current candidate columns updated from independent Step5J review')
