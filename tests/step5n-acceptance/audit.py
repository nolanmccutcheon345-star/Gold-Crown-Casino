"""Read-only provenance inventory. A passing inventory is not U16/Z02 signoff."""
import hashlib, json, subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "tests/step5n-acceptance/evidence"
def git(*args, check=True):
    return subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True, check=check)
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
head = git("rev-parse", "HEAD").stdout.strip()
manifest = json.loads((ROOT / ".openai/hosting.json").read_text())
path_history = git("log", "--format=%H", "HEAD", "--", ".openai/hosting.json").stdout.splitlines()
hosting = []
for commit in path_history:
    text = git("show", f"{commit}:.openai/hosting.json").stdout
    hosting.append({"commit": commit, "sha256": hashlib.sha256(text.encode()).hexdigest(), "projectId": json.loads(text)["project_id"]})
paths = [
    "TEST_EVIDENCE/publication.json", "TEST_EVIDENCE/step3/publication.json", "TEST_EVIDENCE/step36/publication.json",
    "TEST_EVIDENCE/step4a/publication.json", "TEST_EVIDENCE/step4b/publication.json", "TEST_EVIDENCE/step4c/publication.json",
    "TEST_EVIDENCE/step5l/deployments-before.json", "TEST_EVIDENCE/step5l/deployments-final.json",
    "tests/step5j-gates/historical-project-write-audit.json", "tests/step5l-recovery-audit/recovery-audit.json",
    "tests/step5l-acceptance/runtime-proof.json", "TEST_EVIDENCE/step5l/final-checks/build-agreement.json",
    "tests/step5l-acceptance/execution-qualification.json", "tests/step5b-acceptance/Z14_SCOPE_DECISION.md",
]
files = [{"path":p,"bytes":(ROOT/p).stat().st_size,"sha256":sha(ROOT/p)} for p in paths]
missing = {}
for commit in ["3ecea1c2b71c8e8b9963547da676171f91f21716", "1805380"]:
    result = git("cat-file", "-t", commit, check=False)
    missing[commit] = {"present": result.returncode == 0, "objectType": result.stdout.strip() or None}
original = json.loads((ROOT / "docs/specs/acceptance-source.json").read_text())
backlog = json.loads((ROOT / "docs/specs/backlog-source.json").read_text())
assert len(original) == len({x["id"] for x in original}) == 302
assert len(backlog) == len({x["id"] for x in backlog}) == 86
assert all(x["projectId"] == manifest["project_id"] for x in hosting)
result = {"format":"ai-texas-step5n-preserved-provenance-review-v1", "reviewSourceCommit":head,
          "representedCommitCount":int(git("rev-list", "--count", "HEAD").stdout),
          "rootCommits":git("rev-list", "--max-parents=0", "HEAD").stdout.splitlines(),
          "projectId":manifest["project_id"], "hostingFileHistory":hosting,
          "retainedEvidence":files, "originalObjectAvailability":missing,
          "originalRequirements":302,"deferredFeatures":86,
          "sourceAndBuildEquivalentEvidence":"Exact file/build hashes support source equivalence; they do not prove every historical remote write.",
          "U16":{"status":"BLOCKED","missing":"Complete original-sites nonmutation evidence across all write calls"},
          "Z02":{"status":"BLOCKED","missing":"Historical old-project unchanged proof; independent identity/build/browser receipts cover only their own components"},
          "equivalentEvidenceAllowedByOriginalWording":"Neither criterion prescribes a particular vendor audit format. Complete independently verifiable pre/post immutable project state plus complete write records could establish the fact. Current project-only files and missing-object reconstruction do not establish it.",
          "providerExportNeeded":{"start":"initial project creation","end":"final candidate source handoff","fields":["timestamp","action","target project","result","source/version/deployment identity"],"alsoRequired":"Completeness bounds or independently verifiable historical old-project pre/post state"},
          "otherProjectAccessed":False,"otherProjectMutated":False,
          "wholeReleaseQualified":False}
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "provenance-review.json").write_text(json.dumps(result,indent=2)+"\n")
print(json.dumps({"inventory":"PASS","head":head,"hostingVersions":len(hosting),"evidenceFiles":len(files),"U16":"BLOCKED","Z02":"BLOCKED","originals":302,"deferred":86}))
