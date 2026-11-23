"""Import authoritative PDF text without inventing any requirement. Requires PyMuPDF."""
from pathlib import Path
import re, json, csv, hashlib
import pymupdf
root=Path(__file__).resolve().parents[1]

def lines(name):
    doc=pymupdf.open(root/'docs/specs'/name)
    return [line.strip() for page in doc for line in page.get_text().splitlines()
            if line.strip() and not re.fullmatch(r'Page \d+',line.strip())
            and 'AI TEXAS HOLD EM  /  VERIFIED SOURCE ATTACHMENT' not in line]

def write_csv(path, records):
    with path.open('w',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=list(records[0]));writer.writeheader();writer.writerows(records)

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()

t='\n'.join(lines('V7_All_302_Acceptance_Tests.pdf'))
records=[]
for m in re.finditer(r'^([A-Z]\d{2,3}) / ([^\n/]+) / (.*?)\nAcceptance: (.*?)\nSource: ([^|\n]+) \| Status: (\S+)',t,re.S|re.M):
    ident,scope,title,acceptance,source,status=m.groups()
    records.append(dict(id=ident,scope=scope.strip(),title=' '.join(title.split()),acceptance=' '.join(acceptance.split()),source=source.strip(),source_status=status))
assert len(records)==len({r['id'] for r in records})==302,len(records)
features=[]; group='';current=None;field=None
for line in lines('V7_Complete_86_Future_Features.pdf'):
    if line.startswith('R4 '): group=line;continue
    match=re.match(r'^(FUT\d{3}): (.+)',line)
    if match:
        current=dict(id=match[1],title=match[2],release=group,required_behavior='',dependencies='',priority='',status='',constraints='')
        features.append(current);field='title';continue
    if current is None:continue
    found=False
    for prefix,key in [('Required behavior: ','required_behavior'),('Dependencies: ','dependencies'),('Constraints: ','constraints')]:
        if line.startswith(prefix):current[key]=line[len(prefix):];field=key;found=True;break
    if found:continue
    if line.startswith('Priority: '):
        m=re.fullmatch(r'Priority: (.+) \| Status: (.+)',line);assert m,line
        current['priority']=m[1];current['status']=m[2];field=None;continue
    if field:current[field]+=' '+line
assert len(features)==len({f['id'] for f in features})==86,len(features)
assert [f['id'] for f in features]==[f'FUT{i:03d}' for i in range(1,87)]
assert all(f['status']=='DEFERRED_NOT_IMPLEMENTED' and f['dependencies'] and f['required_behavior'] for f in features)
(root/'docs/specs/acceptance-source.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
(root/'docs/specs/backlog-source.json').write_text(json.dumps(features,ensure_ascii=False,indent=2)+'\n')
write_csv(root/'Acceptance_Tracker_V7_302.csv',records)
write_csv(root/'BACKLOG_86.csv',features)
write_csv(root/'ACCEPTANCE_STATUS.csv',[{'id':r['id'],'status':'NOT_EXECUTED','evidence':'','notes':''} for r in records])
manifest=json.loads((root/'docs/specs/manifest.json').read_text())
manifest.update(available_exact_requirement_rows=302,missing_original_baseline_rows=0,available_exact_deferred_rows=86,source_gap_status='REGISTERS_COMPLETE_ORIGINAL_FIXTURE_ARCHIVE_NOT_SUPPLIED')
manifest['files']={p.name:digest(p) for p in sorted((root/'docs/specs').glob('*.pdf'))}
manifest['registers']={name:digest(root/name) for name in ['Acceptance_Tracker_V7_302.csv','BACKLOG_86.csv']}
manifest['normalization']='PDF headers and line-wrap whitespace removed; original IDs, source wording, dependencies, constraints and statuses retained. PDF bytes authoritative.'
(root/'docs/specs/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Imported 302 unique acceptance requirements and 86 exact deferred records. All acceptance statuses NOT_EXECUTED.')
