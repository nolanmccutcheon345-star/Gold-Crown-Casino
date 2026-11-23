import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import process from 'node:process';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(await readFile('tests/browser/step5e-fixtures/compiled/manifest.json','utf8'));
if(manifest.status!=='BUILD_BYTES_VERIFIED'||!/^[0-9a-f]{40}$/.test(manifest.sourceCommit))throw Error('Prepare the exact compiled fixture first');
const sourceFiles=execFileSync('git',['ls-files','src'],{encoding:'utf8'}).trim().split('\n');
const sourceHashes={};for(const file of sourceFiles){const current=await readFile(file),compiledSource=execFileSync('git',['show',`${manifest.sourceCommit}:${file}`]);if(!current.equals(compiledSource))throw Error(`Fixture authority differs from compiled source ${file}`);sourceHashes[file]=sha(current);}
const fixtures=['tests/step5d-browser/mixed-stats-fixture.ts','tests/step5d-browser/mixed-stats-fixture.test.ts','tests/browser/step5e-mixed-stats-frame.ts','tests/browser/step5e-mixed-stats.ts','tests/browser/step5e-mixed-stats.html','tests/browser/step5e-mixed-stats-frame.html'];const fixtureHashes={};for(const path of fixtures)fixtureHashes[path]=sha(await readFile(path));
const receipt={format:'step5e-populated-compiled-stats-source',version:1,status:'SOURCE_BYTES_VERIFIED_NOT_BROWSER_EXECUTED',compiledSourceCommit:manifest.sourceCommit,sourceHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),compiledBuildReceipt:manifest.executionReceipt,compiledAssets:manifest.assets,sourceHashes,fixtureHashes,fixtureHandsPerCohort:200,actualUIPlayedHands:0};
await writeFile('tests/browser/step5e-fixtures/compiled/mixed-stats-source.json',JSON.stringify(receipt,null,2)+'\n');process.stdout.write(JSON.stringify({status:receipt.status,compiledSourceCommit:receipt.compiledSourceCommit,fixtureHashes})+'\n');
