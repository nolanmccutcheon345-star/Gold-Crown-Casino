import {describe,expect,it} from 'vitest';
import {drawResponseSetup,readDrawResponses} from '../../src/ui/draw-setup';

describe('Host-only per-street price response editor (V432/V608)',()=>{
  it('renders all 84 bounded controls with explicit river and synthetic disclosures',()=>{
    const markup=drawResponseSetup('opponent-4',undefined);
    expect((markup.match(/type="number"/g)??[]).length).toBe(84);
    expect(markup).toContain('River draws have zero outs');
    expect(markup).toContain('not a promised calling frequency');
    expect(markup).toContain('min="-1" max="1"');
  });
  it('changes only a targeted draw kind/street/anchor and preserves other curves',()=>{
    const prior={flush:{flop:[.1,.2,.3,.4,.5,.6,.7]},oesd:{turn:[0,0,0,0,0,0,0]}};
    const data=new FormData();data.set('opponent-4-draw-oesd-turn-3','0.65');
    const next=readDrawResponses(data,'opponent-4',prior)!;
    expect(next.oesd?.turn).toEqual([0,0,0,.65,0,0,0]);
    expect(next.flush).toEqual(prior.flush);
    expect(prior.oesd.turn[3]).toBe(0);
    expect(next.oesd?.flop).toBeUndefined();
  });
  it('does not add neutral overrides to an unconfigured profile',()=>{
    const data=new FormData();data.set('opponent-1-draw-gutshot-flop-0','0');
    expect(readDrawResponses(data,'opponent-1')).toBeUndefined();
  });
  it.each(['-1.01','1.01','NaN',''])('rejects invalid adjustment %s',value=>{
    const data=new FormData();data.set('opponent-1-draw-combo-river-6',value);
    expect(()=>readDrawResponses(data,'opponent-1')).toThrow('between');
  });
  it('accepts the exact -1 and +1 bounds',()=>{
    const data=new FormData();data.set('opponent-1-draw-combo-river-0','-1');data.set('opponent-1-draw-combo-river-6','1');
    expect(readDrawResponses(data,'opponent-1')?.combo?.river).toEqual([-1,0,0,0,0,0,1]);
  });
});
