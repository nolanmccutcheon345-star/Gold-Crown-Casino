import {describe,expect,it} from 'vitest';
import {roundChatter,dealerTotal,type TalkRound,type TalkSeat} from '../../src/blackjack/table-talk';
import {otherSeatsMarkup} from '../../src/blackjack/full-table';

const seat=(n:number,style:TalkSeat['style'],cards:string[]):TalkSeat=>({seat:n,name:`P${n}`,style,hands:[{cards,total:dealerTotal(cards),status:'stood'}]});
const round=(id:string,dealer:string[],hero:string[][],seats:TalkSeat[],extra:Partial<TalkRound['hero'][number]>={}):TalkRound=>({id,dealer,hero:hero.map(c=>({cards:c,total:dealerTotal(c),status:'stood',...extra})),seats});
const ids=Array.from({length:200},(_,i)=>`r${i}`);

describe('Patch 76 blackjack table talk',()=>{
 it('counts dealer totals with soft aces',()=>{expect(dealerTotal(['As','6d'])).toBe(17);expect(dealerTotal(['As','6d','9c'])).toBe(16);expect(dealerTotal(['Ts','6d','9c'])).toBe(25);});
 it('cheers a dealer bust and groans at a dealer blackjack',()=>{
  const seats=[seat(1,'by-the-book',['Ts','7d']),seat(3,'gambler',['9s','8d'])];
  const cheers=ids.map(id=>roundChatter(round(id,['6s','Td','8c'],[['Tc','7c']],seats),[])).filter(l=>l.some(x=>/Bust|busts|There it is|breaks|Pay us|Pay the|Thank you, dealer|dead|Break|Twenty-six/.test(x.text))).length;expect(cheers).toBeGreaterThan(120);
  const groans=ids.map(id=>roundChatter(round(id,['As','Kd'],[['Tc','7c']],seats),[])).filter(l=>l.length>0).length;expect(groans).toBe(200);
 });
 it('grumbles when you hit a stiff into a weak dealer card and the dealer makes a hand, mostly from the never-bust players',()=>{
  const seats=[seat(1,'never-bust',['Ts','4d']),seat(2,'gambler',['9s','8d'])];
  const lines=ids.flatMap(id=>roundChatter(round(id,['5s','Td','4c'],[['Tc','3c','9h']],seats),[])).filter(l=>/bust card|busting|stiff/.test(l.text));
  expect(lines.length).toBeGreaterThan(100);expect(lines.filter(l=>l.seat===1).length).toBeGreaterThan(lines.length*.8);
  // A stand, or a stiff against a strong card, gets no grumble.
  expect(ids.flatMap(id=>roundChatter(round(id,['5s','Td','4c'],[['Tc','3c']],seats),[])).some(l=>/bust card/.test(l.text))).toBe(false);
  expect(ids.flatMap(id=>roundChatter(round(id,['Ks','7d'],[['Tc','3c','9h']],seats),[])).some(l=>/bust card/.test(l.text))).toBe(false);
 });
 it('is the same every time for a round, at most three lines from different players',()=>{
  const seats=[seat(1,'never-bust',['As','Kd']),seat(2,'gambler',['9s','8d']),seat(4,'mimic-dealer',['Ts','2d']),seat(6,'by-the-book',['7s','7d'])];
  for(const id of ids){const r=round(id,['5s','Td','9c'],[['Tc','3c','9h']],seats);const a=roundChatter(r,[true,true]),b=roundChatter(r,[true,true]);
   expect(a).toEqual(b);expect(a.length).toBeLessThanOrEqual(3);expect(new Set(a.map(l=>l.seat)).size).toBe(a.length);for(const l of a)expect(seats.some(s=>s.seat===l.seat)).toBe(true);}
  expect(roundChatter(round('x',['5s',null as unknown as string],[['Tc','7c']],seats),[])).toEqual([]);
 });
 it('notices a hot table after three dealer busts in a row',()=>{
  const seats=[seat(1,'by-the-book',['Ts','7d']),seat(2,'gambler',['9s','8d']),seat(3,'never-bust',['Ts','2d'])];
  const hot=ids.filter(id=>roundChatter(round(id,['6s','Td','8c'],[['Tc','7c']],seats),[true,true]).some(l=>/hot|rolling|change a thing|good luck|the best/.test(l.text))).length;expect(hot).toBeGreaterThan(100);
 });
 it('draws a speech bubble on the seat, escaped',()=>{
  const html=otherSeatsMarkup({actingSeat:null,pace:'casino',seats:[{seat:1,kind:'player',name:'Max',style:'never-bust',hands:[],bet:1000,lastAction:null,say:'<b>Pay us!</b>'}]});
  expect(html).toContain('data-testid="bj-say"');expect(html).toContain('&lt;b&gt;Pay us!');
 });
});
