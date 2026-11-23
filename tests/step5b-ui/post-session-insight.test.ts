import {beforeAll,describe,expect,it} from 'vitest';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {canRevealSessionStyles,recordedSessionStyles} from '../../src/ui/post-session-insight';
import {initializeOpponentSettings,opponentSetup} from '../../src/ui/opponent-setup';
import type {AppData} from '../../src/session/types';
import {GateMemoryPort} from '../browser/step5b-gates-fixtures';

let ended:AppData,seated:AppData,sessionId:string;
beforeAll(async()=>{
 const controller=new SessionController(new GateMemoryPort());await controller.init();
 await controller.startSession({...DEFAULT_SETTINGS,seats:3,opponents:[{selection:'unknown',personalitySeed:912341},{selection:'random',personalitySeed:912342}]});
 for(let i=0;i<150&&controller.data!.active!.game.street!=='complete';i++){
  const game=controller.data!.active!.game;
  if(game.actor===0)await controller.act({type:'fold'},game.handId,game.revision);
  else{await controller.prepareBot();await controller.commitBot(game.handId,game.revision);}
  expect(controller.error).toBe('');
 }
 expect(controller.data!.active!.game.street).toBe('complete');seated=structuredClone(controller.data!);sessionId=seated.active!.sessionId;
 await controller.cashOut();expect(controller.error).toBe('');ended=structuredClone(controller.data!);controller.close();
});

describe('Opt-in recorded styles only after actual session cashout',()=>{
 it('refuses a settled but still seated table and any active gameplay state',()=>{
  expect(canRevealSessionStyles(seated,sessionId)).toBe(false);expect(()=>recordedSessionStyles(seated,sessionId)).toThrow('End and cash out');
  const forgedClosed=structuredClone(seated);forgedClosed.sessions[0].endedAt=new Date().toISOString();expect(canRevealSessionStyles(forgedClosed,sessionId)).toBe(false);
 });
 it('returns only original recorded archetype labels for Unknown and stable Random after cashout',()=>{
  const before=JSON.stringify(ended),rows=recordedSessionStyles(ended,sessionId),first=ended.hands[0];
  expect(rows).toEqual([1,2].map(seatId=>({seatId,archetype:first.privateProfiles[seatId].archetype})));
  for(const row of rows){expect(Object.keys(row).sort()).toEqual(['archetype','seatId']);expect(Object.isFrozen(row)).toBe(true);}
  expect(Object.isFrozen(rows)).toBe(true);expect(JSON.stringify(ended)).toBe(before);
 });
 it('refuses missing/unended/invalid ended-session selections',()=>{
  expect(()=>recordedSessionStyles(ended,'missing')).toThrow();
  for(const endedAt of [null,'invalid']){const data=structuredClone(ended);data.sessions[0].endedAt=endedAt;expect(canRevealSessionStyles(data,sessionId)).toBe(false);}
 });
 it('rechecks an old permission against the current controller snapshot',()=>{
  expect(canRevealSessionStyles(ended,sessionId)).toBe(true);
  const reopened=structuredClone(ended);reopened.active=seated.active;
  expect(()=>recordedSessionStyles(reopened,sessionId)).toThrow('End and cash out');
 });
 it('does not guess missing historical Random identity or use a reconfigured replacement',()=>{
  const legacy=structuredClone(ended);delete legacy.hands[0].privateProfiles[2].personalityId;
  expect(recordedSessionStyles(legacy,sessionId).map(row=>row.seatId)).toEqual([1]);
  const changed=structuredClone(ended);changed.sessions[0].settings.opponents![1].personalitySeed!++;
  expect(recordedSessionStyles(changed,sessionId).map(row=>row.seatId)).toEqual([1]);
 });
 it('refuses an unavailable first record rather than substituting newer metadata',()=>{
  const data=structuredClone(ended);data.sessions[0].handIds.unshift('missing-original');
  expect(()=>recordedSessionStyles(data,sessionId)).toThrow('original recorded hand');
 });
});
it('labels every initial persona card DESIGNED and keeps seeds and resolved Unknown identity out of the editor',()=>{
 const choices=['nit','tag','lag','station','maniac','fit-or-fold','passive-reg','stronger-reg','unknown'] as const;
 const settings=initializeOpponentSettings({...DEFAULT_SETTINGS,seats:10,opponents:choices.map((selection,index)=>({selection,personalitySeed:912340+index}))});
 const html=opponentSetup(settings,['You','Alex','Morgan','Jordan','Riley','Casey','Taylor','Drew','Quinn','Sam'],[],new Set());
 expect((html.match(/data-evidence-tier="DESIGNED"/g)??[]).length).toBe(9);
 expect(html).not.toContain('personalitySeed');expect(html).not.toContain('912348');expect(html).not.toContain('data-evidence-tier="HUMAN');
 expect(html).toContain('not human-validated');expect(html).toContain('Unknown keeps its actual style hidden during play');
});
