import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import path from 'node:path';

export interface ProfileArtifact {format:'gzip-json-parts-v1';bytes:number;sha256:string;parts:Array<{path:string;bytes:number;sha256:string}>}
const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
/** Lossless chunks respect source hosting's blob limit without dropping samples. */
export function writeProfileArtifact(directory:string,stem:string,value:unknown,maxPartBytes=16*1024*1024):ProfileArtifact{
 if(!Number.isSafeInteger(maxPartBytes)||maxPartBytes<1)throw Error('Invalid artifact part size');
 const bytes=gzipSync(JSON.stringify(value)),parts:ProfileArtifact['parts']=[];
 for(let offset=0,index=1;offset<bytes.length;offset+=maxPartBytes,index++){
  const part=bytes.subarray(offset,offset+maxPartBytes),name=`${stem}.json.gz.part-${String(index).padStart(3,'0')}`,file=path.join(directory,name);
  if(existsSync(file))throw Error(`Refusing to overwrite profile artifact: ${name}`);
  writeFileSync(file,part,{flag:'wx'});parts.push({path:name,bytes:part.length,sha256:hash(part)});
 }
 return{format:'gzip-json-parts-v1',bytes:bytes.length,sha256:hash(bytes),parts};
}
export function readProfileArtifact(directory:string,artifact:ProfileArtifact,maxBytes=256*1024*1024):unknown{
 if(artifact.format!=='gzip-json-parts-v1'||!artifact.parts.length)throw Error('Invalid profile artifact manifest');
 if(!Number.isSafeInteger(artifact.bytes)||artifact.bytes<1||artifact.bytes>maxBytes)throw Error('Profile artifact exceeds reassembly budget');
 if(artifact.parts.some(part=>!Number.isSafeInteger(part.bytes)||part.bytes<1||part.bytes>16*1024*1024||path.basename(part.path)!==part.path))throw Error('Invalid profile artifact part bounds');
 if(artifact.parts.reduce((sum,part)=>sum+part.bytes,0)!==artifact.bytes)throw Error('Profile artifact sequence integrity differs');
 const bytes=Buffer.concat(artifact.parts.map(part=>{const value=readFileSync(path.join(directory,part.path));if(value.length!==part.bytes||hash(value)!==part.sha256)throw Error('Profile artifact part integrity differs');return value;}));
 if(bytes.length!==artifact.bytes||hash(bytes)!==artifact.sha256)throw Error('Profile artifact sequence integrity differs');
 return JSON.parse(gunzipSync(bytes).toString());
}
