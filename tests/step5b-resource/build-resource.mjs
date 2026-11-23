import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
await build({entryPoints:['tests/step5b-resource/run-resource.ts'],bundle:true,platform:'node',format:'esm',outfile:'/tmp/step5b-resource-run.mjs',plugins:[{name:'read-only-range-cache-telemetry',setup(build){build.onLoad({filter:/\/src\/bots\/ranges\.ts$/},async args=>({loader:'ts',contents:(await readFile(args.path,'utf8'))+"\nObject.defineProperty(globalThis,'__resourceRangeCache',{value:()=>({shape:shapeCache.size,analysis:analysisCache.size})});\n"}));}}]});
