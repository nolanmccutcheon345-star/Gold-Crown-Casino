import {execFileSync} from 'node:child_process';
import {describe,expect,it} from 'vitest';
import {evaluate} from '../../src/core/evaluator';
import {lexCompare} from '../verification/helpers';

const suite=process.env.RUN_ORACLE==='1'?describe:describe.skip;
suite('R1 targeted independent PokerKit 0.7.7 evaluator strata',()=>{
 it('V501: all nine classes, wheel-vs-six, flush kicker, double-trips full house, quads kicker and shared-board tie agree with PokerKit',()=>{
  const categories=['AsKsQsJsTs2d3c','AsAdAhAcKs2d3c','AsAdAhKsKd2d3c','AsQs9s7s3s2d4c','9s8d7h6c5s2d3c','AsAdAhKsQd2d3c','AsAdKsKdQh2d3c','AsAdKhQdJs2d3c','AsKdQh9c7s2d3c'].map(cards=>cards.match(/../g)!);
  const pairs=categories.slice(1).map((hand,index)=>({a:categories[index],b:hand}));
  pairs.push(
   {a:['As','2d','3h','4c','5s','Kd','Qc'],b:['2s','3d','4h','5c','6s','Ad','Kc']},
   {a:['Ac','Qc','9c','7c','2c','8d','3s'],b:['Ac','Jc','9c','7c','2c','8d','3s']},
   {a:['As','Ah','Ad','Ks','Kh','Kd','2c'],b:['As','Ah','Ad','Qs','Qh','Qd','2c']},
   {a:['9c','9d','9h','9s','Ac','2d','3h'],b:['9c','9d','9h','9s','Kc','2d','3h']},
   {a:['As','Ks','Qs','Js','Ts','2d','3c'],b:['As','Ks','Qs','Js','Ts','4d','5c']},
  );
  const result=JSON.parse(execFileSync(process.env.ORACLE_PYTHON??'python3',['tests/oracle/pokerkit_oracle.py'],{input:JSON.stringify({mode:'compare',cases:pairs}),encoding:'utf8'})) as {version:string;comparisons:number[]};
  expect(result.version).toBe('0.7.7');expect(pairs.map(pair=>lexCompare(evaluate(pair.a),evaluate(pair.b)))).toEqual(result.comparisons);
  expect(result.comparisons).toEqual([1,1,1,1,1,1,1,1,-1,1,1,1,0]);
 });
});
