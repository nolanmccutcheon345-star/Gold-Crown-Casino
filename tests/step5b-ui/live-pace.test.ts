import {expect,it} from 'vitest';
import {readLivePaceInput} from '../../src/ui/live-pace';

it.each(['1','30','60','1000',' 60 ','60.0'])('accepts a whole bounded live-pace input %s without changing its value',text=>{
 expect(readLivePaceInput(text)).toBe(Number(text));
});
it.each(['',' ','0','-1','1001','60.5','NaN','Infinity','6e','abc'])('rejects an incomplete or invalid live-pace input %s without clipping',text=>{
 expect(readLivePaceInput(text)).toBeNull();
});
