import {describe,it,expect} from 'vitest';
import {mkdtempSync,writeFileSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DiskRecords} from './disk-records';

describe('profiling disk reference (not browser durability)',()=>{
 it('writes immutable filenames and preserves read-after-write revisions through retirement',()=>{
  const folder=mkdtempSync(join(tmpdir(),'step5f-disk-'));
  try{
   writeFileSync(join(folder,'0.json'),JSON.stringify({revision:0}));
   writeFileSync(join(folder,'index.json'),JSON.stringify({size:0,sourceRawSHA256:'test',expectedWallet:0,serializedBytes:14,preparationMs:0,canonicalHandFieldValueBytes:{},entries:[{key:'current',name:'0.json',bytes:14}]}));
   const store=new DiskRecords(folder),used=new Set(['0.json']);
   for(let revision=1;revision<=1500;revision++){
    const prior=store.get('current')!;store.set('previous',prior);
    store.set('journal:'+revision,JSON.stringify({revision}));
    store.set('current',JSON.stringify({revision}));
    const filename=store.rows.get('current')!.name;expect(used.has(filename)).toBe(false);used.add(filename);
    expect(JSON.parse(store.get('current')!).revision).toBe(revision);
    expect(JSON.parse(store.get('previous')!).revision).toBe(revision-1);
    if(revision>3)store.delete('journal:'+(revision-3));
   }
   expect(store.size).toBe(5);expect(new Set([...store.rows.values()].map(x=>x.name)).size).toBe(5);
   expect(readdirSync(folder).length).toBe(6);
   writeFileSync(join(folder,'index.json'),JSON.stringify({...store.initial,entries:[...store.rows.values()]}));
   const reopened=new DiskRecords(folder);reopened.set('current',JSON.stringify({revision:1501}));
   expect(JSON.parse(reopened.get('current')!).revision).toBe(1501);expect(reopened.rows.get('current')!.name).not.toBe(store.rows.get('current')!.name);
  }finally{rmSync(folder,{recursive:true,force:true});}
 });
});
