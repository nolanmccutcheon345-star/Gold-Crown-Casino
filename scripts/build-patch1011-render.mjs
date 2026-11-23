import {build} from 'esbuild';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
const base='fd00efa67d2bb8523912ac19cc164dc30b8eaa4e';
const hash=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',args,{maxBuffer:32*1024*1024});
const baseFiles=['src/ui/app.ts','src/ui/accessibility.ts','src/ui/configuration-history.ts','src/ui/desktop-play.css'];
const overrides=Object.fromEntries(baseFiles.map(name=>[path.resolve(name),git('show',base+':'+name).toString()]));
for(const variant of ['baseline','candidate']){
 const out=`tests/browser/patch1011-render-prebuilt/${variant}`;await mkdir(out,{recursive:true});
 const result=await build({entryPoints:['tests/browser/patch2-render-frame.ts'],bundle:true,platform:'browser',format:'esm',target:'es2022',outfile:out+'/frame.js',metafile:true,write:false,plugins:variant==='baseline'?[{name:'exact-v27-ui',setup(b){b.onLoad({filter:/\/src\/ui\/(?:app\.ts|accessibility\.ts|configuration-history\.ts|desktop-play\.css)$/},args=>{const contents=overrides[args.path];if(contents===undefined)return;return{contents,loader:args.path.endsWith('.css')?'css':'ts',resolveDir:path.dirname(args.path)};});}}]:[]});
 for(const file of result.outputFiles)await writeFile(file.path.endsWith('.js')?file.path+'.bin':file.path,file.contents);
 const inputs={};for(const name of Object.keys(result.metafile.inputs))inputs[name]=hash(variant==='baseline'&&overrides[path.resolve(name)]!==undefined?overrides[path.resolve(name)]:await readFile(name));
 const manifest={variant,baselineCommit:base,currentHEAD:git('rev-parse','HEAD').toString().trim(),workingDiffSHA256:hash(git('diff','--','src')),inputs,javascriptSHA256:hash(await readFile(out+'/frame.js.bin')),cssSHA256:hash(await readFile(out+'/frame.css')),method:'Real installed esbuild/dependencies. Baseline loads exact Version27 changed UI modules; all unchanged engine/session/storage modules shared. Candidate uses current working source. No mock hashes.'};
 await writeFile(out+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
 await writeFile(out+'/index.html',`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="./frame.css"><title>${variant} real-app render fixture</title></head><body><script id="build-proof" type="application/json">${JSON.stringify(manifest)}</script><div id="app"></div><script type="module">const m=JSON.parse(document.querySelector('#build-proof').textContent),b=await(await fetch('./frame.js.bin')).arrayBuffer(),h=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),n=>n.toString(16).padStart(2,'0')).join('');if(h!==m.javascriptSHA256)throw Error('Benchmark bundle integrity mismatch');await import(URL.createObjectURL(new Blob([b],{type:'text/javascript'})));</script></body></html>`);
 console.log(JSON.stringify({variant,javascriptSHA256:manifest.javascriptSHA256,inputCount:Object.keys(inputs).length}));
}
