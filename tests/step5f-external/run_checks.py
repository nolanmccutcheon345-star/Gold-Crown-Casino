"""Run this external-verification pack's software checks, never human tests."""
import hashlib
import json
import pathlib
import platform
import subprocess
import sys
import time

root = pathlib.Path(__file__).resolve().parents[2]
def git(*args):
    return subprocess.check_output(['git', *args], cwd=root, text=True).strip()
source = git('rev-parse', 'HEAD')
output = root / 'tests/step5f-external/evidence' / source[:12]
output.mkdir(parents=True, exist_ok=False)
inputs = sorted([*root.glob('tests/step5f-external/*.ts'), *root.glob('tests/browser/step5f-external*'), *root.glob('tests/browser/step5g-external*'), *root.glob('tests/step5f-external/*.py'), *root.glob('tests/step5f-external/*.mjs')])
hashes = {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs if p.is_file()}
receipt = {'format': 'step5f-external-pack-execution', 'version': 1, 'sourceCommit': source, 'sourceHashes': hashes, 'environment': {'node': subprocess.check_output(['node', '--version'], text=True).strip(), 'platform': platform.system(), 'python': platform.python_version()}, 'checks': [], 'physicalDeviceTests': 'NOT_EXECUTED', 'screenReaderTests': 'NOT_EXECUTED', 'humanParticipants': 0, 'browserExecution': 'NOT_EXECUTED by this runner; integrator must run the prepared candidate', 'limitations': ['These software validators do not authenticate human or physical-device evidence.', 'No passing original acceptance ID is inferred from the test count.']}
commands = [
 ('typecheck', ['npm', 'run', 'typecheck']),
 ('lint', ['node', 'node_modules/eslint/bin/eslint.js', *[str(p.relative_to(root)) for p in inputs if p.suffix in ('.ts', '.mjs')]]),
 ('unit', ['node', 'node_modules/vitest/vitest.mjs', 'run', 'tests/step5f-external/contracts.test.ts', 'tests/step5f-external/navigation.test.ts', 'tests/step5c-accessibility', 'tests/step5d-accessibility', '--reporter=json', f'--outputFile={output / "vitest.json"}']),
 ('packaging-contracts', ['node', '--test', 'tests/step5f-external/package.test.mjs']),
 ('manual-bundle', ['node', '--input-type=module', '-e', "import {build} from 'esbuild';import{writeFileSync}from'node:fs';const p=" + json.dumps(str(output)) + ";const result=await build({entryPoints:['tests/browser/step5f-external.ts'],bundle:true,format:'esm',outfile:p+'/manual.js',metafile:true});writeFileSync(p+'/manual-metafile.json',JSON.stringify(result.metafile,null,2));"]),
 ('specification', ['node', 'scripts/check-spec-integrity.mjs']),
]
for name, command in commands:
    started = time.time()
    result = subprocess.run(command, cwd=root, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    (output / f'{name}.log').write_text(result.stdout)
    receipt['checks'].append({'name': name, 'command': command, 'expectedExit': 0, 'observedExit': result.returncode, 'durationMs': round((time.time() - started) * 1000, 3), 'status': 'PASS' if result.returncode == 0 else 'FAIL', 'log': f'{name}.log'})
    print(name, result.returncode, flush=True)
if (output / 'vitest.json').exists():
    results = json.loads((output / 'vitest.json').read_text())
    receipt['testCounts'] = {key: results[key] for key in ('numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests')}
if (output / 'manual-metafile.json').exists():
    graph = json.loads((output / 'manual-metafile.json').read_text())
    receipt['manualModuleGraph'] = list(graph['inputs'])
    receipt['manualGraphReadsProductionModules'] = any(p.startswith('src/') for p in graph['inputs'])
    receipt['manualBundleSHA256'] = hashlib.sha256((output / 'manual.js').read_bytes()).hexdigest()
receipt['sourceUnchangedDuringChecks'] = all(hashlib.sha256((root / p).read_bytes()).hexdigest() == h for p, h in hashes.items())
receipt['status'] = 'PASS' if all(c['observedExit'] == 0 for c in receipt['checks']) and receipt['sourceUnchangedDuringChecks'] and not receipt.get('manualGraphReadsProductionModules', True) else 'FAIL'
(output / 'manifest.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'status': receipt['status'], 'source': source, 'testCounts': receipt.get('testCounts'), 'receipt': str(output.relative_to(root) / 'manifest.json')}))
sys.exit(0 if receipt['status'] == 'PASS' else 1)
