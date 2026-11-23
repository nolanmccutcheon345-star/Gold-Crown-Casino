"""Verify lossless diagnostic chunks; optionally restore original Git objects.

Default use is read-only. --git-dir adds historical objects but never changes a
branch or working tree. --heap-output writes the verified original gzip only to
a new explicit path. Receipts retain the actual original execution commit IDs.
"""
import argparse
import hashlib
import json
import pathlib
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--git-dir', type=pathlib.Path)
parser.add_argument('--heap-output', type=pathlib.Path)
args = parser.parse_args()
folder = pathlib.Path(__file__).resolve().parent
root = folder.parents[2]
manifest = json.loads((folder / 'manifest.json').read_text())

def assemble(path):
    meta = json.loads(path.read_text())
    result = bytearray()
    for part in meta['parts']:
        assert pathlib.Path(part['path']).name == part['path'], 'Unsafe part path'
        data = (path.parent / part['path']).read_bytes()
        assert len(data) == part['bytes']
        assert hashlib.sha256(data).hexdigest() == part['sha256']
        result.extend(data)
    assert len(result) == meta['bytes']
    assert hashlib.sha256(result).hexdigest() == meta['sha256']
    return bytes(result), meta

heap, heap_meta = assemble(root / manifest['heapPartsManifest'])
pack, pack_meta = assemble(folder / manifest['originalObjectsPackManifest'])
blob_id = hashlib.sha1(b'blob ' + str(len(heap)).encode() + b'\0' + heap).hexdigest()
assert blob_id == manifest['originalHeapGitBlob']
if args.heap_output:
    with args.heap_output.open('xb') as output:
        output.write(heap)
restored = False
if args.git_dir:
    prefix = ['git', f'--git-dir={args.git_dir.resolve()}']
    subprocess.run(prefix + ['cat-file', '-e', manifest['unchangedRemoteAncestor'] + '^{commit}'], check=True)
    subprocess.run(prefix + ['index-pack', '--stdin'], input=pack, check=True, stdout=subprocess.PIPE)
    observed = subprocess.check_output(prefix + ['hash-object', '-w', '--stdin'], input=heap).decode().strip()
    assert observed == blob_id
    subprocess.run(prefix + ['cat-file', '-e', manifest['originalHead'] + '^{commit}'], check=True)
    original = subprocess.check_output(prefix + ['rev-parse', manifest['originalHead'] + ':tests/step5e-performance/resource-cleanup-evidence/after-unwind.heapsnapshot.gz']).decode().strip()
    assert original == blob_id
    subprocess.run(prefix + ['diff', '--exit-code', '37aa22575baaf582f845a70e1862ba6e6409aa48', manifest['originalHead'], '--', 'src', 'package.json', 'package-lock.json', 'index.html', '.openai/hosting.json'], check=True)
    restored = True
print(json.dumps({'status': 'PASS', 'heapBytes': len(heap), 'heapSHA256': heap_meta['sha256'], 'originalGitBlob': blob_id, 'sourcePackBytes': len(pack), 'sourcePackSHA256': pack_meta['sha256'], 'originalHead': manifest['originalHead'], 'originalGitObjectsRestored': restored, 'branchOrWorkingTreeChanged': False}))
