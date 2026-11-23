import {mkdirSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {CONFIGURATIONS,PLAN,sessionBlock,summarize} from '../tests/step5a-release/population';
const label=process.argv[2]??'candidate';if(!/^[a-zA-Z0-9.-]+$/.test(label))throw Error('Invalid evidence label');
const path=`tests/step5a-release/evidence/${label}`;mkdirSync(path,{recursive:true});
const started=new Date().toISOString(),blocks:ReturnType<typeof sessionBlock>[]=[];
for(let c=0;c<CONFIGURATIONS.length;c++)for(let b=0;b<PLAN.blocksPerConfiguration;b++){blocks.push(sessionBlock(c,b));process.stdout.write(`${CONFIGURATIONS[c].id} block ${b+1}/${PLAN.blocksPerConfiguration}\n`);}
const records=JSON.stringify(blocks),digest=createHash('sha256').update(records).digest('hex');
writeFileSync(`${path}/sessions.json.gz`,gzipSync(records));
writeFileSync(`${path}/summary.json`,JSON.stringify({started,finished:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),recordsSha256:digest,...summarize(blocks)},null,2));
process.stdout.write(`${path}: ${blocks.length} blocks, ${blocks.reduce((n,b)=>n+b.hands.length,0)} complete hands; SHA256 ${digest}\n`);
