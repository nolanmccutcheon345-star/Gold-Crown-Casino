import {describe,expect,it} from 'vitest';
import {startPloHand,applyPlo,legalPlo,potSizes,assertChips,omahaRank,ploView,type PloHand,type PloAction} from '../../src/plo/engine';
import {ploDecide,preflopScore,ploEquity,PLO_PLAYERS} from '../../src/plo/bots';
import {PloTable,checkPlo,freshPlo,PLO_START_BALANCE} from '../../src/plo/table';
import {ploMarkup} from '../../src/plo/view';
import {standardDeck} from '../../src/core/deck';

/** A good seeded generator, so runs repeat. */
function mulberry(seed:number){return (n:number)=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return Math.floor(((t^t>>>14)>>>0)/4294967296*n);};}
const shuffled=(r:(n:number)=>number)=>{const d=standardDeck();for(let i=d.length-1;i>0;i--){const j=r(i+1);[d[i],d[j]]=[d[j],d[i]];}return d;};
/** A deck that deals the given hole cards (in dealing order from left of the button) and then the board. */
function stacked(holes:string[][],board:string[],button:number,ids:number[]):string[] {
 const order=ids.map((_,k)=>ids[(ids.indexOf(button)+1+k)%ids.length]);
 const top:string[]=[];for(let r=0;r<4;r++)for(const id of order)top.push(holes[ids.indexOf(id)][r]);
 const rest=standardDeck().filter(c=>!top.includes(c)&&!board.includes(c));
 return [...top,rest[0],...board.slice(0,3),rest[1],board[3],rest[2],board[4],...rest.slice(3)];
}

describe('Patch 74 Omaha engine',()=>{
 it('uses exactly two hole cards and three board cards',()=>{
  expect(omahaRank(['As','Ks','2d','3c'],['Qs','Js','Ts','4h','5h'])).toEqual([8,14]);
  expect(omahaRank(['As','2c','3d','4h'],['Ks','Qs','Js','Ts','9s'])[0]).toBe(0);// one spade cannot make a flush or the board's straight
  expect(omahaRank(['Ah','Ad','Ac','2s'],['Kh','Kd','7c','8s','9d'])).toEqual([2,14,13,9]);// only two aces may play: two pair, not aces full
  expect(omahaRank(['7h','8h','2c','3d'],['9h','Th','Jh','Qh','Kh'])[0]).toBe(8);
 });
 it('caps bets at the pot: blinds $1/$2, first to act may raise to $7',()=>{
  const r=mulberry(3);const h=startPloHand({handId:'p',button:0,smallBlind:100,bigBlind:200,seats:[0,1,2,3,4,5].map(id=>({id,name:`P${id}`,stack:20000})),deck:shuffled(r)});
  const l=legalPlo(h)!;expect(h.actor).toBe(3);expect(l.call).toBe(200);expect(l.minRaiseTo).toBe(400);expect(l.maxRaiseTo).toBe(700);
  expect(()=>applyPlo(h,{type:'raise',to:800})).toThrow(/pot limit/);
  const h2=applyPlo(h,{type:'raise',to:700});const l2=legalPlo(h2)!;// next: pot 3+7=10, call 7 -> pot after call 17, max = 7+17 = 24
  expect(l2.call).toBe(700);expect(l2.maxRaiseTo).toBe(2400);expect(potSizes(h2)!.pot).toBe(2400);
 });
 it('conserves every chip through thousands of random hands, with side pots',()=>{
  const r=mulberry(17);let sides=0,shows=0;
  for(let t=0;t<1500;t++){
   const n=2+r(5);let h:PloHand=startPloHand({handId:`f${t}`,button:r(n),smallBlind:100,bigBlind:200,seats:Array.from({length:n},(_,i)=>({id:i,name:`P${i}`,stack:200+r(40000)})),deck:shuffled(r)});
   for(let s=0;h.street!=='complete';s++){const l=legalPlo(h)!;const x=r(10);
    const a:PloAction=x<2&&l.fold?{type:'fold'}:x<5&&l.canRaise?{type:'raise',to:l.minRaiseTo+r(l.maxRaiseTo-l.minRaiseTo+1)}:l.check?{type:'check'}:{type:'call'};
    h=applyPlo(h,a);assertChips(h);expect(s).toBeLessThan(400);}
   expect(h.seats.reduce((a,s)=>a+s.stack,0)).toBe(h.initialTotal);
   expect(Object.values(h.payouts).reduce((a,b)=>a+b,0)).toBe(h.pots.reduce((a,p)=>a+p.amount,0));
   if(h.pots.length>1)sides++;if(h.showdown.length){shows++;expect(h.board).toHaveLength(5);}
  }
  expect(sides).toBeGreaterThan(50);expect(shows).toBeGreaterThan(300);
 });
 it('splits side pots by who is eligible and gives the odd chip left of the button',()=>{
  const ids=[0,1,2];
  // Seat 1 (short) has the best hand; seat 2 beats seat 0 for the side pot.
  const deck=stacked([['2c','3d','4h','5s'],['Ah','Ad','Kc','Qd'],['Kh','Kd','2d','3h']],['As','Ks','7c','8s','9d'],0,ids);
  let h=startPloHand({handId:'s',button:0,smallBlind:100,bigBlind:200,seats:[{id:0,name:'A',stack:10000},{id:1,name:'B',stack:2000},{id:2,name:'C',stack:10000}],deck});
  h=applyPlo(h,{type:'call'});// button calls
  while(h.street!=='complete'){const l=legalPlo(h)!;h=applyPlo(h,l.canRaise?{type:'raise',to:l.maxRaiseTo}:l.call?{type:'call'}:{type:'check'});}
  expect(h.pots.length).toBeGreaterThanOrEqual(2);expect(h.pots[0].winners).toEqual([1]);expect(h.pots[0].amount).toBe(6000);
  expect(h.pots.slice(1).every(p=>!p.eligible.includes(1)&&p.winners.includes(2))).toBe(true);
  expect(h.seats.find(s=>s.id===1)!.stack).toBe(6000);
 });
 it('shows other players\' cards only after a showdown they reached',()=>{
  const r=mulberry(5);const h=startPloHand({handId:'v',button:0,smallBlind:100,bigBlind:200,seats:[0,1,2].map(id=>({id,name:`P${id}`,stack:20000})),deck:shuffled(r)});
  const v=ploView(h,0);expect(v.deck).toEqual([]);expect(v.seats.find(s=>s.id===0)!.hole.every(c=>c.length===2)).toBe(true);expect(v.seats.filter(s=>s.id!==0).every(s=>s.hole.every(c=>c===''))).toBe(true);
 });
});

describe('Patch 74 Omaha players',()=>{
 it('scores starting hands the way Omaha players do',()=>{
  expect(preflopScore(['Ah','As','Kh','Ks'])).toBeGreaterThan(preflopScore(['Jh','Th','9s','8s']));
  expect(preflopScore(['Jh','Th','9s','8s'])).toBeGreaterThan(preflopScore(['Kc','8d','5h','2s']));
  expect(preflopScore(['7c','2d','2h','2s'])).toBeLessThan(.05);
 });
 it('estimates equity from its own cards only',()=>{
  const r=mulberry(9);const e=ploEquity(['Ah','As','Kh','Ks'],[],1,r,2000);expect(e).toBeGreaterThan(.6);expect(e).toBeLessThan(.8);
  expect(ploEquity(['2c','3d','4h','5s'],['Ah','Kh','Qh','Jh','Th'],1,r,200)).toBeLessThan(.05);
 });
 it('always chooses a legal action',()=>{
  const r=mulberry(21);let decisions=0;
  for(let t=0;t<40;t++){let h=startPloHand({handId:`b${t}`,button:t%6,smallBlind:100,bigBlind:200,seats:[0,1,2,3,4,5].map(id=>({id,name:`P${id}`,stack:20000})),deck:shuffled(r)});
   while(h.street!=='complete'){const a=ploDecide(h,PLO_PLAYERS[h.actor!],r);h=applyPlo(h,a);decisions++;}
   assertChips(h);}
  expect(decisions).toBeGreaterThan(150);
 },60000);
});

describe('Patch 74 Omaha table and balance',()=>{
 it('buys in from its own balance, plays, and cashes out what is left',()=>{
  const t=new PloTable(freshPlo());t.sit('1-2',100);expect(t.state.balance).toBe(PLO_START_BALANCE-20000);
  for(let hand=0;hand<6;hand++){
   for(let i=0;i<300&&t.state.active!.hand.street!=='complete';i++){if(t.heroTurn){const l=legalPlo(t.state.active!.hand)!;t.act(l.check?{type:'check'}:{type:'call'});}else t.botStep();}
   assertChips(t.state.active!.hand);
   if(t.state.active!.stacks[0]<=0)break;t.nextHand();
  }
  expect(t.state.hands.length).toBeGreaterThan(0);expect(t.state.hands.at(-1)!.hole).toHaveLength(4);
  const stack=t.state.active!.stacks[0],hands=t.state.sessions[0].hands;
  t.leave();expect(t.state.active).toBeNull();expect(t.state.balance).toBeGreaterThanOrEqual(PLO_START_BALANCE-20000+stack-200);// leaving mid-hand folds a posted blind at most
  expect(t.state.sessions[0].endedAt).not.toBeNull();expect(t.state.sessions[0].hands).toBeGreaterThanOrEqual(hands);
  expect(()=>t.sit('1-2',150)).toThrow(/40 to 100/);
 },60000);
 it('refuses a save whose chips or cards do not add up',()=>{
  const t=new PloTable(freshPlo());t.sit('1-2',100);const good=structuredClone(t.state);expect(()=>checkPlo(good)).not.toThrow();
  const chips=structuredClone(good);chips.active!.hand.seats[0].stack+=500;expect(()=>checkPlo(chips)).toThrow(/conservation/);
  const cards=structuredClone(good);cards.active!.hand.seats[1].hole[0]=cards.active!.hand.seats[0].hole[0];expect(()=>checkPlo(cards)).toThrow(/twice/);
  expect(()=>checkPlo({version:1,balance:-1,sessions:[],hands:[],active:null})).toThrow();
 });
 it('draws the table without anyone\'s hidden cards',()=>{
  const t=new PloTable(freshPlo());t.sit('1-2',100);
  const html=ploMarkup(t,{stakes:'1-2',buyInBB:100,raiseTo:null,error:'',notice:'',thinking:false},{card:c=>c?`[${c}]`:'[back]',esc:s=>s});
  const a=t.state.active!;for(const s of a.hand.seats)if(s.id!==0)for(const c of s.hole)expect(html).not.toContain(`[${c}]`);
  for(const c of a.hand.seats.find(s=>s.id===0)!.hole)expect(html).toContain(`[${c}]`);
  expect(ploMarkup(new PloTable(freshPlo()),{stakes:'2-5',buyInBB:60,raiseTo:null,error:'',notice:'',thinking:false},{card:()=>'',esc:s=>s})).toContain('Sit down with $300');
 });
});

describe('Patch 74 Omaha in backups',()=>{
 it('checks an Omaha part when a backup carries one, and refuses an open table or bad chips',async()=>{
  const {readBackup,makeBackup}=await import('../../src/storage/backup');
  const {SessionController}=await import('../../src/session/controller');
  class Memory{data:unknown=null;async load(){return structuredClone(this.data);}async commit(_e:number|null,d:unknown){this.data=structuredClone(d);}close(){}}
  const c=new SessionController(new Memory() as never);await c.init();const cash=await c.backupData();c.close();
  const t=new PloTable(freshPlo());const ok=makeBackup(cash,null,null);ok.omaha=structuredClone(t.state);
  expect((await readBackup(JSON.stringify(ok))).omaha!.balance).toBe(PLO_START_BALANCE);
  const old=makeBackup(cash,null,null);expect((await readBackup(JSON.stringify(old))).omaha).toBeUndefined();
  t.sit('1-2',100);const open=makeBackup(cash,null,null);open.omaha=structuredClone(t.state);await expect(readBackup(JSON.stringify(open))).rejects.toThrow(/Omaha table open/);
  const bad=makeBackup(cash,null,null);bad.omaha={...freshPlo(),balance:-5};await expect(readBackup(JSON.stringify(bad))).rejects.toThrow(/Omaha part/);
 });
});
