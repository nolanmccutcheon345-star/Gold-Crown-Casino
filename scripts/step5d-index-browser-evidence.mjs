/** Index an already executed native capture without editing its original bytes. */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {dirname,resolve,relative} from 'node:path';
import process from 'node:process';
import console from 'node:console';
import {verifyBrowser,browserHarnessFiles} from './step5d-qualify-browser.mjs';
const [basePath,capturePath,proofPath,harnessCommit,id,output,...extra]=process.argv.slice(2);
if(extra.length||![basePath,capturePath,proofPath,harnessCommit,id,output].every(Boolean)||!/^[0-9a-f]{40}$/.test(harnessCommit))throw Error('Usage: node scripts/step5d-index-browser-evidence.mjs BASE_MANIFEST CAPTURE_JSON PREPARED_PROOF HARNESS_COMMIT EXECUTION_ID OUTPUT_INDEX');
const root=process.cwd(),safe=path=>{const full=resolve(root,path),p=relative(root,full);if(!p||p.startsWith('..')||p.startsWith('/'))throw Error('Evidence path must remain inside repository');return full;},read=path=>readFileSync(safe(path)),exists=path=>existsSync(safe(path)),sha=value=>createHash('sha256').update(value).digest('hex');
const receipt=JSON.parse(read(basePath)),raw=JSON.parse(read(capturePath));
if(receipt.status!=='PASS'||!Object.keys(receipt.buildHashes??{}).length)throw Error('Successful compiled base execution is required');
for(const [path,hash]of Object.entries(receipt.buildHashes))if(sha(read(path))!==hash)throw Error(`Compiled bytes changed: ${path}`);
const workflow=raw.format==='step5d-exact-compiled-populated-statistics'?'populated-statistics':'cash',files=browserHarnessFiles(workflow);
const sourceAtCommit=(commit,path)=>{safe(path);return execFileSync('git',['show',`${commit}:${path}`],{cwd:root,maxBuffer:64*1024*1024});};
const entry={format:'ai-texas-native-compiled-workflows',version:1,id,workflow,sourceCommit:receipt.sourceCommit,harnessCommit,
 capture:{path:capturePath,sha256:sha(read(capturePath))},proof:{path:proofPath,sha256:sha(read(proofPath))},
 harnessHashes:Object.fromEntries(files.map(path=>[path,sha(sourceAtCommit(harnessCommit,path))])),
 command:workflow==='cash'?['Native browser UI: /tests/browser/step5d-compiled.html',`Set #qa-width=${raw.width}`,'Click #qa-run; capture every #qa-evidence chunk after terminal status']:['Native browser UI: /tests/browser/step5d-compiled-stats.html',`Set #stats-width=${raw.width}`,'Click #stats-run; capture every #stats-evidence chunk after terminal status; generated fixture hands are not UI-played hands'],
 limitations:['Indexes actual captured bytes; does not itself execute a browser.','No physical-device, screen-reader, hosted-CI or human-validation claim.']};
const result=verifyBrowser(entry,receipt,{read,exists,sourceAtCommit});if(result.status!=='QUALIFIED')throw Error(result.errors.join('\n'));
const index=exists(output)?JSON.parse(read(output)):[];if(!Array.isArray(index)||index.some(item=>item.id===id))throw Error('Existing browser index is invalid or contains this execution ID');
index.push(entry);mkdirSync(dirname(safe(output)),{recursive:true});writeFileSync(safe(output),JSON.stringify(index,null,2)+'\n');
console.log(JSON.stringify({indexed:id,workflow,sourceCommit:entry.sourceCommit,harnessCommit,width:raw.width,browser:raw.browser,actualUIHands:raw.actualUIHands??raw.actualUIPlayedHands,fixtureHands:raw.fixtureHandsVerified??0,workflowRecords:raw.reports.length,captureSHA256:entry.capture.sha256,output},null,2));
