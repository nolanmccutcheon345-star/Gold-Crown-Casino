import {describe,expect,it} from 'vitest';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdtempSync,mkdirSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,relative,resolve} from 'node:path';

const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
function walk(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(item=>item.isDirectory()?walk(join(dir,item.name)):[join(dir,item.name)]);}

describe('V510 production graph excludes private developer QA diagnostics',()=>{
 it('builds the real application entry and proves no QA page/module/private command protocol is shipped',()=>{
  const output=mkdtempSync(join(tmpdir(),'ai-texas-production-boundary-'));
  const command=[process.execPath,'node_modules/vite/bin/vite.js','build','--manifest','--sourcemap','--outDir',output];
  const before=hash(readFileSync('src/main.ts'));
  try{
   const build=spawnSync(command[0],command.slice(1),{encoding:'utf8',maxBuffer:32*1024*1024});
   expect(build.status,build.stdout+'\n'+build.stderr).toBe(0);
   const files=walk(output),relativeFiles=files.map(file=>relative(output,file));
   expect(relativeFiles.filter(file=>file.endsWith('.html'))).toEqual(['index.html']);
   const manifest=JSON.parse(readFileSync(join(output,'.vite/manifest.json'),'utf8')) as Record<string,{isEntry?:boolean;src?:string}>;
   expect(Object.entries(manifest).filter(([,entry])=>entry.isEntry).map(([name])=>name)).toEqual(['index.html']);
   const maps=files.filter(file=>file.endsWith('.js.map'));expect(maps.length).toBeGreaterThan(0);
   const sources=maps.flatMap(file=>(JSON.parse(readFileSync(file,'utf8')) as {sources:string[]}).sources);
   expect(sources.some(source=>source.endsWith('/src/main.ts'))).toBe(true);
   expect(sources.some(source=>source.endsWith('/src/ui/app.ts'))).toBe(true);
   const forbidden=sources.filter(source=>/(^|\/)tests\/|step5[bcde]-compiled|step5[bcde]-rollback|\/fixtures\//.test(source));
   expect(forbidden).toEqual([]);
   const javascript=files.filter(file=>file.endsWith('.js')).map(file=>readFileSync(file,'utf8')).join('\n');
   // These are concrete privileged QA dispatch protocols, not generic words
   // such as "snapshot" legitimately needed by the guest recovery runtime.
   const privateProtocols=['step5d-compiled-command','step5d-compiled-result','step5e-compiled-command','step5e-compiled-result','compiled-stats-command','compiled-stats-result'];
   for(const protocol of privateProtocols)expect(javascript).not.toContain(protocol);
   const entry=readFileSync(join(output,'index.html'),'utf8');expect(entry).not.toMatch(/tests\/browser|qa-frame|qa-run|built-artifact/);
   expect(hash(readFileSync('src/main.ts'))).toBe(before);
   const directory=resolve(process.env.STEP5E_GATES_EVIDENCE_DIR??'test-results/step5e-gates');mkdirSync(directory,{recursive:true});
   writeFileSync(join(directory,'production-diagnostics-boundary.json'),JSON.stringify({format:'step5e-production-diagnostics-boundary',version:1,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),at:new Date().toISOString(),environment:{node:process.version,platform:process.platform,arch:process.arch},command:command.map(value=>value===output?'<isolated temporary output>':value),status:'PASS',productionEntry:'index.html -> src/main.ts',moduleSources:sources,forbiddenModules:forbidden,excludedPrivateProtocols:privateProtocols,artifacts:Object.fromEntries(files.map(file=>[relative(output,file),hash(readFileSync(file))])),assertionSourceSHA256:hash(readFileSync('tests/step5e-gates/production-diagnostics-boundary.test.ts')),limitations:['Fresh temporary production build graph test, not a browser execution or hosted deployment.','Client-side private state remains inspectable by developer tools under the documented single-player threat model.','This proves private QA pages/command listeners are not shipped. It does not alone satisfy the complete V510 diagnostic labeling/interaction criterion.']},null,2)+'\n');
  }finally{if(existsSync(output))rmSync(output,{recursive:true,force:true});}
 },60000);
});
