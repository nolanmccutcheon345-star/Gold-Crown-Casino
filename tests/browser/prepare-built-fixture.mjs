import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const receipt=JSON.parse(await readFile('TEST_EVIDENCE/step5c/integrated-final-candidate/manifest.json','utf8'));
if(receipt.status!=='PASS')throw Error('A successful executed build receipt is required');
const directory='tests/browser/built-artifact';await mkdir(directory,{recursive:true});
const assets=[];
for(const [source,expected] of Object.entries(receipt.buildHashes)){
 const bytes=await readFile(source),hash=createHash('sha256').update(bytes).digest('hex');
 if(hash!==expected)throw Error('Build changed after verification: '+source);
 const destination=path.join(directory,path.basename(source)+'.bin');await writeFile(destination,bytes);
 assets.push({source,destination,sha256:hash});
}
await writeFile('TEST_EVIDENCE/step5c/built-fixture.json',JSON.stringify({sourceCommit:receipt.sourceCommit,status:'PASS',at:new Date().toISOString(),method:'Byte-identical build copies with .bin suffix prevent Vite HTML/JS instrumentation. Browser verifies every hash before executing exact JS and CSS bytes via typed Blob URLs.',assets},null,2));
