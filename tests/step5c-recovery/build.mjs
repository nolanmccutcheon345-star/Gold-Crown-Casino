import {build} from 'esbuild';
await build({entryPoints:['tests/step5c-recovery/profile.ts'],bundle:true,platform:'node',format:'esm',outfile:'/tmp/step5c-recovery.mjs'});
