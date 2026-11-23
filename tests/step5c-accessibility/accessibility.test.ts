import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {standardDeck} from '../../src/core/deck';
import {startHand,applyCommand,projectView,legalActions} from '../../src/core/engine';
import type {RuleProfile} from '../../src/contracts';
import {cardName,tableAnnouncement} from '../../src/ui/accessibility';
import {assertStudyImportRights,importRightsMarkup,PRACTICE_DISCLOSURE} from '../../src/ui/practice-disclosure';

const profile:RuleProfile={id:'a11y-test',version:'1',mode:'cash',chipUnit:1,smallBlind:100,bigBlind:200,rake:{basisPoints:500,cap:300,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const create=(seats:number)=>startHand({handId:`a11y-${seats}`,profile,seats:Array.from({length:seats},(_,id)=>({id,name:id===0?'You':`Player ${id}`,stack:20000})),button:0});

describe('Public-only spoken table updates',()=>{
 it('gives all 52 cards distinct rank-and-suit names without relying on color',()=>{
  const labels=standardDeck().map(cardName);expect(new Set(labels).size).toBe(52);
  expect(cardName('Ah')).toBe('Ace of hearts');expect(cardName('Tc')).toBe('10 of clubs');expect(cardName('Qs')).toBe('Queen of spades');
  for(const label of labels)expect(label).toMatch(/ of (clubs|diamonds|hearts|spades)$/);
 });
 it.each([2,6,9,10])('announces legal turns, public boards and exact payouts with %i players',seats=>{
  let game=create(seats),count=0;const announcements:string[]=[];
  while(game.street!=='complete'){
   const view=projectView(game,0),text=tableAnnouncement(view,1,false);announcements.push(text);
   expect(text).toContain(`Pot $${(game.pot/100).toFixed(2)}`);
   if(game.actor===0)expect(text).toContain(legalActions(game).check?'You can check.':`Call $${(legalActions(game).callAmount/100).toFixed(2)}.`);
   for(const card of view.board)expect(text).toContain(cardName(card));
   // Announcements never enumerate any dealt hole cards, even permitted Hero cards.
   for(const player of game.seats)for(const hole of player.hole)expect(text).not.toContain(cardName(hole));
   game=applyCommand(game,{handId:game.handId,revision:game.revision,seatId:game.actor!,decisionId:`a11y:${count++}`,action:legalActions(game).check?{type:'check'}:{type:'call'}});
  }
  const text=tableAnnouncement(projectView(game,0),1,false);expect(text).toContain('Hand settled');expect(text).toContain(`Rake $${(seats*200*0.05/100).toFixed(2)}`);
  for(const [seat,amount] of Object.entries(game.payouts).filter(([,n])=>n>0))expect(text).toContain(`${game.seats.find(player=>player.id===Number(seat))!.name} awarded $${(amount/100).toFixed(2)}`);
  expect(new Set(announcements).size).toBeGreaterThan(4);
 });
 it('announces all-fold settlement without inventing a showdown',()=>{
  const game=create(2),done=applyCommand(game,{handId:game.handId,revision:0,seatId:0,decisionId:'fold',action:{type:'fold'}});
  const text=tableAnnouncement(projectView(done,0),3,false);expect(text).toContain('Player 1 awarded $2.00');expect(text).not.toContain('Board:');expect(text).not.toContain('showdown');
 });
 it('announces pause and missing session explicitly',()=>{expect(tableAnnouncement(projectView(create(2),0),1,true)).toContain('Table paused');expect(tableAnnouncement(null,0,false)).toContain('No active table');});
});

describe('Practice and rights disclosures',()=>{
 it('requires explicit rights confirmation before external study ingestion',()=>{expect(()=>assertStudyImportRights(false)).toThrow('right to use');expect(()=>assertStudyImportRights(true)).not.toThrow();expect(importRightsMarkup(false)).not.toContain(' checked');expect(importRightsMarkup(true)).toContain(' checked');});
 it('states offline, virtual-only practice with no real-time assistance or client integration',()=>{for(const text of ['Offline','practice','virtual chips only','No real-money','real-time assistance','does not connect to live poker clients'])expect(PRACTICE_DISCLOSURE).toContain(text);});
 it('production source has no poker-client network or clipboard ingestion service',()=>{
  const source=readFileSync(new URL('../../src/ui/app.ts',import.meta.url),'utf8');
  expect(source).not.toMatch(/\b(?:fetch|WebSocket|EventSource)\s*\(/);expect(source).not.toContain('clipboard.read');
  expect(source).toContain('assertStudyImportRights(importRightsConfirmed)');
 });
});
