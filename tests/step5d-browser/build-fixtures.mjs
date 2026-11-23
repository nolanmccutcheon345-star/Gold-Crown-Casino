import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import process from 'node:process';
const directory=mkdtempSync(join(tmpdir(),'ai-texas-step5d-fixtures-'));
try {const outfile=join(directory,'prepare.mjs');await build({entryPoints:['tests/step5d-browser/prepare-fixtures.ts'],bundle:true,platform:'node',format:'esm',outfile});execFileSync(process.execPath,[outfile],{stdio:'inherit'});}finally{rmSync(directory,{recursive:true,force:true});}
