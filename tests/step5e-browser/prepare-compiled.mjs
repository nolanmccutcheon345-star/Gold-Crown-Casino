import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
const receiptPath=process.argv[2];
if(!receiptPath||!/^TEST_EVIDENCE\/[A-Za-z0-9_./-]+\/manifest\.json$/.test(receiptPath)||receiptPath.includes('..'))throw Error('Provide the successful release execution manifest path.');
const receiptBytes=await readFile(receiptPath),receipt=JSON.parse(receiptBytes.toString());
if(receipt.status!=='PASS'||!receipt.sourceCommit||!receipt.buildHashes?.['dist/index.html'])throw Error('An executed successful production build receipt is required.');
const sha=value=>createHash('sha256').update(value).digest('hex'),directory='tests/browser/step5e-fixtures/compiled';await mkdir(directory,{recursive:true});
const assets=[];
for(const [source,expected] of Object.entries(receipt.buildHashes)){
 if(!/^dist\/(?:index\.html|assets\/[A-Za-z0-9_.-]+\.(?:js|css))$/.test(source))throw Error('Unsupported compiled artifact: '+source);
 const bytes=await readFile(source);if(sha(bytes)!==expected)throw Error('Build changed after executed receipt: '+source);
 const destination=path.join(directory,path.basename(source)+'.bin');await writeFile(destination,bytes);assets.push({source,url:'/'+destination,sha256:expected,bytes:bytes.length});
}
const proof={format:'ai-texas-step5e-exact-compiled-fixture',version:1,sourceCommit:receipt.sourceCommit,executionReceipt:receiptPath,executionReceiptSHA256:sha(receiptBytes),preparedAt:new Date().toISOString(),status:'BUILD_BYTES_VERIFIED',assets,scope:'Exact dist bytes copied with .bin suffix to avoid Vite instrumentation. Preparation/provenance only; no browser execution PASS.'};
await writeFile(path.join(directory,'manifest.json'),JSON.stringify(proof,null,2)+'\n');process.stdout.write(JSON.stringify(proof)+'\n');
