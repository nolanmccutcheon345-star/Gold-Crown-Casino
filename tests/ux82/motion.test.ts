import {describe,expect,it} from 'vitest';
import {startPloHand,applyPlo,legalPlo} from '../../src/plo/engine';
import {ploFlights,flySnapshot} from '../../src/plo/view';
import {matchBanner} from '../../src/ui/heads-up';
import {countUp,resetCountUp} from '../../src/ui/count-up';
import {standardDeck} from '../../src/core/deck';

describe('Patch 82 motion',()=>{
 it('flies each bet to the pot when a street ends, and the pot to each winner when the hand ends',()=>{
  let h=startPloHand({handId:'f',button:0,smallBlind:100,bigBlind:200,seats:[0,1,2].map(id=>({id,name:`P${id}`,stack:20000})),deck:standardDeck()});
  expect(ploFlights(null,h,'s')).toEqual([]);
  let snap=flySnapshot(h);expect(Object.keys(snap.bets).length).toBe(2);// the blinds
  while(h.street==='preflop'){const before=flySnapshot(h);h=applyPlo(h,legalPlo(h)!.call?{type:'call'}:{type:'check'});snap=before;}
  const toPot=ploFlights(snap,h,'s');expect(toPot.length).toBe(3);for(const f of toPot){expect(f.kind).toBe('pot');expect(f.to).toEqual([50,47]);}
  expect(new Set(toPot.map(f=>f.id)).size).toBe(3);
  while(h.street!=='complete'){snap=flySnapshot(h);h=applyPlo(h,legalPlo(h)!.check?{type:'check'}:{type:'call'});}
  const end=ploFlights(snap,h,'e');const winners=Object.entries(h.payouts).filter(([,v])=>v>0).length;
  expect(end.filter(f=>f.kind==='win').length).toBe(winners);for(const f of end.filter(f=>f.kind==='win'))expect(f.from).toEqual([50,47]);
  expect(ploFlights({...snap,handId:'other'},h,'x')).toEqual([]);
 });
 it('draws the heads-up chip share as a bar',()=>{
  const html=matchBanner({sessionId:'s',rung:0,opponent:'sal',name:'Sal',hands:3,hero:30000,villain:10000,over:false,won:false,how:null,net:0});
  expect(html).toContain('width:75.0%');expect(html).toContain('you 75%');
 });
 it('leaves money text exactly as rendered when motion is off or nothing changed',()=>{
  resetCountUp();
  const el=(key:string,count:number,text:string)=>({dataset:{countKey:key,count:String(count)},textContent:text,isConnected:true,classList:{add(){},remove(){}}});
  const rootOf=(e:ReturnType<typeof el>)=>({querySelectorAll:()=>[e]}) as unknown as ParentNode;
  const a=el('k',1000,'$10');countUp(rootOf(a),c=>`$${c/100}`,true);countUp(rootOf(a),c=>`$${c/100}`,true);expect(a.textContent).toBe('$10');
  const b=el('k',5000,'$50');countUp(rootOf(b),c=>`$${c/100}`,false);expect(b.textContent).toBe('$50');
 });
});
