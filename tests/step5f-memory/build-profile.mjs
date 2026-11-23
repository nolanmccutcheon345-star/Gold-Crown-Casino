import {build} from 'esbuild';
import process from 'node:process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const directory=process.argv[2];if(!directory)throw Error('Output directory required');mkdirSync(directory,{recursive:true});
const result=await build({entryPoints:[process.argv[3]??'tests/step5f-memory/freeze-profile.ts'],bundle:true,platform:'node',format:'esm',sourcemap:'external',outfile:`${directory}/bundle.mjs.bin`,metafile:true});
writeFileSync(`${directory}/source.json`,JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,dirtyTrackedInputs:execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),inputs:Object.fromEntries(Object.keys(result.metafile.inputs).map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')])),bundleSHA256:createHash('sha256').update(readFileSync(`${directory}/bundle.mjs.bin`)).digest('hex')},null,2)+'\n');
