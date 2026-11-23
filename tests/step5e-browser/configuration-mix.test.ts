import {expect,it} from 'vitest';
import {expectedPublicMix} from '../browser/step5e-configuration-mix';
it('requires both exact Unknown and Random labels while both selected opponents are occupied',()=>expect(expectedPublicMix([0,1,2])).toEqual([{selection:'random',count:1},{selection:'unknown',count:1}]));
it('counts only the surviving publicly selected opponent after a genuine seat departure',()=>{expect(expectedPublicMix([0,1])).toEqual([{selection:'unknown',count:1}]);expect(expectedPublicMix([0,2])).toEqual([{selection:'random',count:1}]);});
it('rejects unknown, duplicated, missing-Hero and undersized fixture layouts',()=>{for(const ids of [[0,3],[0,1,1],[1,2],[0]])expect(()=>expectedPublicMix(ids)).toThrow();});
