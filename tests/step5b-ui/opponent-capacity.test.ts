import {describe,expect,it} from 'vitest';
import {initializeOpponentSettings,opponentSetup,readOpponentSettings} from '../../src/ui/opponent-setup';
import {DEFAULT_SETTINGS} from '../../src/session/controller';

describe('Host form preserves sparse seat identities and draw controls',()=>{
  it('uses physical seat indices for a ten-capacity, six-player lineup',()=>{
    const settings=initializeOpponentSettings({...DEFAULT_SETTINGS,capacity:10,seats:6,occupiedSeatIds:[0,2,3,5,7,9]},()=>500);
    const markup=opponentSetup(settings,['You','Alex','Morgan','Jordan','Riley','Casey','Taylor','Drew','Quinn','Sam'],[],new Set());
    for(const id of [2,3,5,7,9])expect(markup).toContain(`data-opponent-seat="${id}"`);
    for(const id of [1,4,6,8])expect(markup).not.toContain(`data-opponent-seat="${id}"`);
    expect(markup).toContain('id="opponent-9-selection"');
    expect(markup).not.toContain('personalitySeed');
  });
  it('changing the final occupied seat never overwrites an empty position policy',()=>{
    const settings=initializeOpponentSettings({...DEFAULT_SETTINGS,capacity:10,seats:2,occupiedSeatIds:[0,9]},()=>500);
    const data=new FormData();data.set('opponent-9-selection','station');data.set('opponent-9-draw-oesd-turn-3','0.7');
    const result=readOpponentSettings(data,settings);
    expect(result.opponents?.[8].selection).toBe('station');
    expect(result.opponents?.[8].drawResponses?.oesd?.turn).toEqual([0,0,0,.7,0,0,0]);
    expect(result.opponents?.slice(0,8)).toEqual(settings.opponents?.slice(0,8));
    expect(result.opponents?.[8].personalitySeed).toBe(settings.opponents?.[8].personalitySeed);
  });
  it('keeps configured curves after editing unrelated host fields',()=>{
    const settings=initializeOpponentSettings(DEFAULT_SETTINGS,()=>500);
    settings.opponents![2].drawResponses={gutshot:{flop:[-.1,-.2,-.3,-.4,-.5,-.6,-.7]}};
    const data=new FormData();data.set('population','high');
    expect(readOpponentSettings(data,settings).opponents?.[2].drawResponses).toEqual(settings.opponents![2].drawResponses);
  });
});
