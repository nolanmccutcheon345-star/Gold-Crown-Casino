import {build} from 'esbuild';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const directory='tests/step5e-performance/resource-tail-evidence';mkdirSync(directory,{recursive:true});
const outfile='/tmp/step5e-resource-tail.mjs',result=await build({entryPoints:['tests/step5e-performance/resource-tail.ts'],bundle:true,platform:'node',format:'esm',outfile,metafile:true,sourcemap:'external'}),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
writeFileSync(`${directory}/bundle.mjs.bin`,readFileSync(outfile));writeFileSync(`${directory}/bundle.map.bin`,readFileSync(`${outfile}.map`));
writeFileSync(`${directory}/source.json`,JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),builtAt:new Date().toISOString(),bundleSHA256:hash(readFileSync(outfile)),sourceSHA256:Object.fromEntries(Object.keys(result.metafile.inputs).map(p=>[p,hash(readFileSync(p))])),command:'node --expose-gc --max-old-space-size=6144 /tmp/step5e-resource-tail.mjs',referenceArchive:'tests/step5b-resource/evidence/step5e-4ab9ea3/canonical-segments.jsonl.gz'},null,2)+'\n');
