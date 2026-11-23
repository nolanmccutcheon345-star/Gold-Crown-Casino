import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {afterEach,expect,it} from 'vitest';
import {readProfileArtifact,writeProfileArtifact} from './profile-artifact';
const directories:string[]=[];const folder=()=>{const dir=mkdtempSync(path.join(tmpdir(),'poker-profile-parts-'));directories.push(dir);return dir;};
afterEach(()=>{for(const dir of directories.splice(0))rmSync(dir,{recursive:true,force:true});});
it('roundtrips every sample through bounded lossless chunks without overwriting evidence',()=>{
 const dir=folder(),profile={nodes:Array.from({length:200},(_,i)=>({id:i,frame:`call-${i}`,sample:i*i})),samples:[1,2,3]},artifact=writeProfileArtifact(dir,'cpu',profile,128);
 expect(artifact.parts.length).toBeGreaterThan(1);expect(artifact.parts.every(p=>p.bytes<=128)).toBe(true);expect(readProfileArtifact(dir,artifact)).toEqual(profile);
 expect(()=>writeProfileArtifact(dir,'cpu',profile,128)).toThrow(/overwrite/);expect(readProfileArtifact(dir,artifact)).toEqual(profile);
});
it('rejects missing, reordered or duplicated profile parts without rewriting remaining bytes',()=>{
 const dir=folder(),artifact=writeProfileArtifact(dir,'allocation',{samples:Array.from({length:300},(_,i)=>`${i}-${i*i}`)},80),before=readFileSync(path.join(dir,artifact.parts[0].path));
 expect(()=>readProfileArtifact(dir,{...artifact,parts:artifact.parts.slice(1)})).toThrow(/sequence/);
 expect(()=>readProfileArtifact(dir,{...artifact,parts:[...artifact.parts].reverse()})).toThrow(/sequence/);
 expect(()=>readProfileArtifact(dir,{...artifact,parts:[...artifact.parts,artifact.parts[0]]})).toThrow(/sequence/);expect(readFileSync(path.join(dir,artifact.parts[0].path))).toEqual(before);
});
it('rejects corrupted parts rather than presenting a partial profile',()=>{
 const dir=folder(),artifact=writeProfileArtifact(dir,'cpu',{samples:[1,2,3]},8),file=path.join(dir,artifact.parts[0].path),bytes=readFileSync(file);bytes[0]^=1;writeFileSync(file,bytes);
 expect(()=>readProfileArtifact(dir,artifact)).toThrow(/part integrity/);
});
it('checks a declared reassembly budget before opening any oversized or foreign part',()=>{
 const dir=folder(),artifact=writeProfileArtifact(dir,'cpu',{samples:[1,2,3]},8);
 expect(()=>readProfileArtifact(dir,artifact,artifact.bytes-1)).toThrow(/reassembly budget/);
 expect(()=>readProfileArtifact(dir,{...artifact,parts:[{...artifact.parts[0],path:'../foreign'},...artifact.parts.slice(1)]})).toThrow(/part bounds/);
 expect(readProfileArtifact(dir,artifact,artifact.bytes)).toEqual({samples:[1,2,3]});
});
