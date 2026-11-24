/** Patch 99: craps with the standard bets and payouts. The shooter is you. Line bets (Pass, Don't Pass) with odds
 * up to 3-4-5x, Come and Don't Come, place bets on 4, 5, 6, 8, 9 and 10, the Field (2 pays double, 12 triple),
 * hardways, and the one-roll propositions. Place bets and hardways are off on the come-out roll, as in most casinos.
 * Payouts are rounded down to the cent. Money on the layout has already left the balance. */
import type {Random} from './wallet';

export const POINTS=[4,5,6,8,9,10] as const;
export type Point=typeof POINTS[number];
export const HARD=[4,6,8,10] as const;
export type Hard=typeof HARD[number];
export interface CrapsTable {
 point:Point|null;
 pass:number;dontPass:number;passOdds:number;dontOdds:number;
 /** Come and Don't Come bets waiting for their first roll. */
 come:number;dontCome:number;
 /** Come and Don't Come bets that have travelled to a number. */
 comeOn:Partial<Record<Point,number>>;dontComeOn:Partial<Record<Point,number>>;
 place:Partial<Record<Point,number>>;hard:Partial<Record<Hard,number>>;
 /** Patch 100: odds behind Come and Don't Come points, and buy bets on 4, 5, 9 and 10. */
 comeOdds:Partial<Record<Point,number>>;dontComeOdds:Partial<Record<Point,number>>;buy:Partial<Record<Buy,number>>;
 /** Patch 101: hop bets by dice ("1-2", "3-3"), the Fire Bet, the points this shooter has made, and whether a new shooter has yet to roll. */
 hop:Record<string,number>;fire:number;firePoints:Point[];newShooter:boolean;
 field:number;any7:number;anyCraps:number;yo:number;aces:number;aceDeuce:number;twelve:number;
 /** Patch 102: lay bets against 4–10, Big 6 and Big 8, and the table's odds limit (3-4-5x or 10x). */
 lay:Partial<Record<Point,number>>;big6:number;big8:number;oddsX:OddsX;
 /** Patch 103: place, buy and hardway bets and come odds are "working" on the come-out too (off by default). */
 working:boolean;
}
export type OddsX='345'|'10';
export const BUYS=[4,5,9,10] as const;
export type Buy=typeof BUYS[number];
export const freshTable=():CrapsTable=>({point:null,pass:0,dontPass:0,passOdds:0,dontOdds:0,come:0,dontCome:0,comeOn:{},dontComeOn:{},place:{},hard:{},comeOdds:{},dontComeOdds:{},buy:{},hop:{},fire:0,firePoints:[],newShooter:true,lay:{},big6:0,big8:0,oddsX:'345',working:false,field:0,any7:0,anyCraps:0,yo:0,aces:0,aceDeuce:0,twelve:0});
export type SimpleSpot='pass'|'dontPass'|'passOdds'|'dontOdds'|'come'|'dontCome'|'field'|'any7'|'anyCraps'|'yo'|'aces'|'aceDeuce'|'twelve'|'big6'|'big8';
export type Spot=SimpleSpot|`place${Point}`|`hard${Hard}`|`comeOdds${Point}`|`dontComeOdds${Point}`|`buy${Buy}`|`hop${number}`|'fire'|`lay${Point}`;
export const isPoint=(n:number):n is Point=>(POINTS as readonly number[]).includes(n);
/** Total money on the layout. */
export function onLayout(t:CrapsTable):number {
 const sum=(r:Partial<Record<number,number>>)=>Object.values(r).reduce((a:number,b)=>a+(b??0),0);
 return t.pass+t.dontPass+t.passOdds+t.dontOdds+t.come+t.dontCome+t.field+t.any7+t.anyCraps+t.yo+t.aces+t.aceDeuce+t.twelve+sum(t.comeOn)+sum(t.dontComeOn)+sum(t.place)+sum(t.hard)+sum(t.comeOdds)+sum(t.dontComeOdds)+sum(t.buy)+Object.values(t.hop??{}).reduce((a,b)=>a+b,0)+(t.fire??0)+sum(t.lay??{})+(t.big6??0)+(t.big8??0);
}
/** Odds you may take behind the line: 3x on 4 and 10, 4x on 5 and 9, 5x on 6 and 8 at a 3-4-5x table, or 10x
 * everywhere at a 10x table. Lay odds go up to what would win that much: 6x the flat at 3-4-5x; at 10x, 20x on 4
 * and 10, 15x on 5 and 9, 12x on 6 and 8. */
export const oddsMultiple=(p:Point,x:OddsX='345')=>x==='10'?10:({4:3,10:3,5:4,9:4,6:5,8:5} as const)[p];
export const layMultiple=(p:Point,x:OddsX='345')=>x==='10'?({4:20,10:20,5:15,9:15,6:12,8:12} as const)[p]:6;
export const maxOdds=(t:CrapsTable)=>t.point?t.pass*oddsMultiple(t.point,t.oddsX):0;
export const maxLay=(t:CrapsTable)=>t.point?t.dontPass*layMultiple(t.point,t.oddsX):0;
/** Any odds up anywhere on the layout (the odds limit can change only when there are none). */
export const oddsUp=(t:CrapsTable)=>t.passOdds+t.dontOdds+Object.values(t.comeOdds).reduce((a:number,b)=>a+(b??0),0)+Object.values(t.dontComeOdds).reduce((a:number,b)=>a+(b??0),0)>0;
/** Spots kept in a record by number: prefix and field. */
const KEYED:[string,'place'|'hard'|'comeOdds'|'dontComeOdds'|'buy'|'lay'][]=[['dontComeOdds','dontComeOdds'],['comeOdds','comeOdds'],['place','place'],['hard','hard'],['buy','buy'],['lay','lay']];
const keyed=(spot:string)=>{for(const [pre,field] of KEYED)if(spot.startsWith(pre)&&/^\d+$/.test(spot.slice(pre.length)))return {field,n:Number(spot.slice(pre.length))};return null;};
const hopKey=(spot:string)=>{const m=/^hop([1-6])([1-6])$/.exec(spot);return m&&m[1]<=m[2]?`${m[1]}-${m[2]}`:null;};
const get=(t:CrapsTable,spot:Spot):number=>{const h=hopKey(spot);if(h)return t.hop[h]??0;if(spot==='fire')return t.fire;const k=keyed(spot);return k?(t[k.field] as Record<number,number>)[k.n]??0:t[spot as SimpleSpot];};
const set=(t:CrapsTable,spot:Spot,v:number):CrapsTable=>{
 const h=hopKey(spot);if(h){const hop={...t.hop};if(v)hop[h]=v;else delete hop[h];return {...t,hop};}
 if(spot==='fire')return {...t,fire:v};
 const k=keyed(spot);if(!k)return {...t,[spot]:v};
 const r={...(t[k.field] as Record<number,number>)};if(v)r[k.n]=v;else delete r[k.n];return {...t,[k.field]:r};
};
/** Why a bet cannot go on now, or null if it can. */
export function cannotAdd(t:CrapsTable,spot:Spot,amount:number):string|null {
 if(!Number.isSafeInteger(amount)||amount<=0)return 'Bets must be at least one cent.';
 const now=get(t,spot)+amount;
 if((spot==='pass'||spot==='dontPass')&&t.point)return 'Line bets go on before the come-out roll. Use Come or Don’t Come now.';
 if((spot==='come'||spot==='dontCome')&&!t.point)return 'Come bets need a point. On the come-out, bet the Pass or Don’t Pass line.';
 if(spot==='passOdds'){if(!t.point||!t.pass)return 'Odds go behind a Pass bet once a point is set.';if(now>maxOdds(t))return `Odds are limited to ${oddsMultiple(t.point,t.oddsX)}x your Pass bet.`;}
 if(spot==='dontOdds'){if(!t.point||!t.dontPass)return 'Lay odds go behind a Don’t Pass bet once a point is set.';if(now>maxLay(t))return `Lay odds are limited to ${layMultiple(t.point,t.oddsX)}x your Don’t Pass bet.`;}
 const k=keyed(spot);
 if(k?.field==='comeOdds'){const flat=t.comeOn[k.n as Point]??0;if(!flat)return `Odds go behind a Come bet on ${k.n}.`;const x=oddsMultiple(k.n as Point,t.oddsX);if(now>flat*x)return `Odds are limited to ${x}x your Come bet.`;}
 if(k?.field==='dontComeOdds'){const flat=t.dontComeOn[k.n as Point]??0;if(!flat)return `Lay odds go behind a Don’t Come bet on ${k.n}.`;const x=layMultiple(k.n as Point,t.oddsX);if(now>flat*x)return `Lay odds are limited to ${x}x your Don’t Come bet.`;}
 if(k?.field==='buy'&&!(BUYS as readonly number[]).includes(k.n))return 'Buy bets are on 4, 5, 9 and 10.';
 if(spot.startsWith('hop')&&!hopKey(spot))return 'A hop bet names two dice, smaller first, like hop25.';
 if(spot==='fire'&&(!t.newShooter||t.point))return 'The Fire Bet goes on before a new shooter’s first roll.';
 if(k?.field==='lay'&&!isPoint(k.n))return 'Lay bets are on 4, 5, 6, 8, 9 and 10.';
 if(k?.field==='place'&&!isPoint(k.n))return 'Place bets are on 4, 5, 6, 8, 9 and 10.';
 if(k?.field==='hard'&&!(HARD as readonly number[]).includes(k.n))return 'Hardways are 4, 6, 8 and 10.';
 return null;
}
export function addBet(t:CrapsTable,spot:Spot,amount:number):CrapsTable {
 const why=cannotAdd(t,spot,amount);if(why)throw new Error(why);
 return set(t,spot,get(t,spot)+amount);
}
/** Taking a bet down returns its money. A Pass or Come bet with a point is a contract and stays. */
export function cannotRemove(t:CrapsTable,spot:Spot):string|null {
 if(!get(t,spot))return 'There is no bet there.';
 if(spot==='pass'&&t.point)return 'A Pass bet stays up once a point is set.';
 if(spot==='fire'&&!t.newShooter)return 'The Fire Bet stays up for the whole shooter.';
 return null;
}
export function removeBet(t:CrapsTable,spot:Spot):{table:CrapsTable;back:number} {
 const why=cannotRemove(t,spot);if(why)throw new Error(why);
 let table=set(t,spot,0),back=get(t,spot);
 // Taking down a line bet takes its odds with it.
 if(spot==='dontPass'&&t.dontOdds){back+=t.dontOdds;table={...table,dontOdds:0};}
 if(spot==='pass'&&t.passOdds){back+=t.passOdds;table={...table,passOdds:0};}
 return {table,back};
}
/** True odds and place payouts, as win-per-stake fractions. */
const TRUE:Record<Point,[number,number]>={4:[2,1],10:[2,1],5:[3,2],9:[3,2],6:[6,5],8:[6,5]};
const PLACE:Record<Point,[number,number]>={4:[9,5],10:[9,5],5:[7,5],9:[7,5],6:[7,6],8:[7,6]};
const win=(stake:number,[a,b]:[number,number])=>Math.floor(stake*a/b);
export interface Paid {spot:string;stake:number;back:number;stays?:boolean}
export interface RollResult {dice:[number,number];sum:number;table:CrapsTable;
 /** Bets settled on this roll: the stake risked and what came back (0 for a loss, the stake on a push). */
 settled:Paid[];
 /** Stakes of winning place bets and hardways that stay up (taken from the winnings, so the bet is still on). */
 restaked:number;
 call:string;pointBefore:Point|null;}
export function rollDice(random:Random):[number,number] {return [random(6)+1,random(6)+1];}
/** Resolve one roll. */
export function roll(t0:CrapsTable,dice:[number,number]):RollResult {
 const [d1,d2]=dice,sum=d1+d2,hardRoll=d1===d2;
 const t:CrapsTable={...freshTable(),...t0,comeOn:{...t0.comeOn},dontComeOn:{...t0.dontComeOn},place:{...t0.place},hard:{...t0.hard},comeOdds:{...(t0.comeOdds??{})},dontComeOdds:{...(t0.dontComeOdds??{})},buy:{...(t0.buy??{})},hop:{...(t0.hop??{})},lay:{...(t0.lay??{})},big6:t0.big6??0,big8:t0.big8??0,oddsX:t0.oddsX??'345',working:t0.working??false,firePoints:[...(t0.firePoints??[])],fire:t0.fire??0,newShooter:t0.newShooter??true};
 const settled:Paid[]=[];let restaked=0;
 const pay=(spot:string,stake:number,back:number,stays=false)=>{if(stake>0){settled.push({spot,stake,back,stays});if(stays&&back>0)restaked+=stake;}};
 const comeOut=t.point===null;
 // One-roll bets.
 pay('field',t.field,!t.field?0:[3,4,9,10,11].includes(sum)?2*t.field:sum===2?3*t.field:sum===12?4*t.field:0);t.field=0;
 pay('any7',t.any7,sum===7?5*t.any7:0);t.any7=0;
 pay('anyCraps',t.anyCraps,[2,3,12].includes(sum)?8*t.anyCraps:0);t.anyCraps=0;
 pay('yo',t.yo,sum===11?16*t.yo:0);t.yo=0;
 pay('aces',t.aces,sum===2?31*t.aces:0);t.aces=0;
 pay('aceDeuce',t.aceDeuce,sum===3?16*t.aceDeuce:0);t.aceDeuce=0;
 pay('twelve',t.twelve,sum===12?31*t.twelve:0);t.twelve=0;
 // Hop bets: one roll, on an exact pair of dice. An easy hop (two ways) pays 15 to 1, a hard hop 30 to 1.
 const rolled=`${Math.min(d1,d2)}-${Math.max(d1,d2)}`;
 for(const [k,a] of Object.entries(t.hop)){const [x,y]=k.split('-');pay(`hop${x}${y}`,a,k===rolled?a*(x===y?31:16):0);}
 t.hop={};
 // Come points and Don't Come points work on every roll (their flats).
 // Come odds are off on the come-out (returned if the bet is decided then); lay odds always work.
 for(const p of POINTS){
  const c=t.comeOn[p],co=t.comeOdds[p]??0;if(c){if(sum===p){pay(`come${p}`,c,2*c);pay(`comeOdds${p}`,co,comeOut&&!t.working?co:co+win(co,TRUE[p]));delete t.comeOn[p];delete t.comeOdds[p];}else if(sum===7){pay(`come${p}`,c,0);pay(`comeOdds${p}`,co,comeOut&&!t.working?co:0);delete t.comeOn[p];delete t.comeOdds[p];}}
  const d=t.dontComeOn[p],dco=t.dontComeOdds[p]??0;if(d){if(sum===7){pay(`dontCome${p}`,d,2*d);pay(`dontComeOdds${p}`,dco,dco+win(dco,[TRUE[p][1],TRUE[p][0]]));delete t.dontComeOn[p];delete t.dontComeOdds[p];}else if(sum===p){pay(`dontCome${p}`,d,0);pay(`dontComeOdds${p}`,dco,0);delete t.dontComeOn[p];delete t.dontComeOdds[p];}}
 }
 // Patch 102: lay bets and Big 6 / Big 8 work on every roll, the come-out included, and stay up after a win.
 // A lay bet wins true odds against its number (1:2 on 4 and 10, 2:3 on 5 and 9, 5:6 on 6 and 8), less 5% of the
 // win (rounded up to the cent); Big 6 and Big 8 pay even money.
 for(const n of POINTS){const a=t.lay[n];if(!a)continue;if(sum===7){const w=win(a,[TRUE[n][1],TRUE[n][0]]);pay(`lay${n}`,a,a+w-Math.ceil(w*5/100),true);}else if(sum===n){pay(`lay${n}`,a,0);delete t.lay[n];}}
 for(const [spot,n] of [['big6',6],['big8',8]] as const){const a=t[spot];if(!a)continue;if(sum===n)pay(spot,a,2*a,true);else if(sum===7){pay(spot,a,0);t[spot]=0;}}
 // New Come and Don't Come bets.
 if(t.come){if(sum===7||sum===11){pay('come',t.come,2*t.come);}else if([2,3,12].includes(sum)){pay('come',t.come,0);}else if(isPoint(sum)){t.comeOn[sum]=(t.comeOn[sum]??0)+t.come;}t.come=0;}
 if(t.dontCome){if(sum===2||sum===3){pay('dontCome',t.dontCome,2*t.dontCome);}else if(sum===12){pay('dontCome',t.dontCome,t.dontCome);}else if(sum===7||sum===11){pay('dontCome',t.dontCome,0);}else if(isPoint(sum)){t.dontComeOn[sum]=(t.dontComeOn[sum]??0)+t.dontCome;}t.dontCome=0;}
 // Place bets and hardways: off on the come-out unless the player has called them working.
 if(!comeOut||t.working){
  for(const p of POINTS){const a=t.place[p];if(!a)continue;if(sum===p)pay(`place${p}`,a,a+win(a,PLACE[p]),true);else if(sum===7){pay(`place${p}`,a,0);delete t.place[p];}}
  // Buy bets: true odds, less a 5% commission on the bet, taken only when it wins.
  for(const b of BUYS){const a=t.buy[b];if(!a)continue;if(sum===b)pay(`buy${b}`,a,a+win(a,TRUE[b])-Math.ceil(a*5/100),true);else if(sum===7){pay(`buy${b}`,a,0);delete t.buy[b];}}
  for(const h of HARD){const a=t.hard[h];if(!a)continue;if(sum===h&&hardRoll)pay(`hard${h}`,a,a+a*(h===4||h===10?7:9),true);else if(sum===7||sum===h){pay(`hard${h}`,a,0);delete t.hard[h];}}
 }
 // The line.
 const pointBefore=t.point;let callText='';
 const r7out=(pb:Point|null,s2:number)=>pb!==null&&s2===7;
 if(comeOut){
  if(sum===7||sum===11){pay('pass',t.pass,2*t.pass);pay('dontPass',t.dontPass,0);t.pass=0;t.dontPass=0;callText=sum===7?'Seven, front line winner!':'Yo-leven, front line winner!';}
  else if(sum===2||sum===3||sum===12){pay('pass',t.pass,0);pay('dontPass',t.dontPass,sum===12?t.dontPass:2*t.dontPass);t.pass=0;t.dontPass=0;callText=sum===2?'Aces! Craps, line away.':sum===3?'Ace-deuce, craps three.':'Twelve, craps! Bar twelve on the don’t.';}
  else {t.point=sum as Point;callText=`${sum}, the point is ${sum}. Mark it!`;}
 }else{
  const p=t.point!;
  if(sum===p){pay('pass',t.pass,2*t.pass);pay('passOdds',t.passOdds,t.passOdds+win(t.passOdds,TRUE[p]));pay('dontPass',t.dontPass,0);pay('dontOdds',t.dontOdds,0);
   t.pass=0;t.passOdds=0;t.dontPass=0;t.dontOdds=0;t.point=null;callText=`${sum}${hardRoll?' the hard way':''}, winner! Pay the line.`;
   if(!t.firePoints.includes(p)){t.firePoints=[...t.firePoints,p];if(t.firePoints.length===6&&t.fire){pay('fire',t.fire,1000*t.fire);t.fire=0;callText+=' All six points: the Fire Bet pays 999 to 1!';}}}
  else if(sum===7){pay('pass',t.pass,0);pay('passOdds',t.passOdds,0);pay('dontPass',t.dontPass,2*t.dontPass);pay('dontOdds',t.dontOdds,t.dontOdds+win(t.dontOdds,[TRUE[p][1],TRUE[p][0]]));
   t.pass=0;t.passOdds=0;t.dontPass=0;t.dontOdds=0;t.point=null;callText='Seven out, line away!';
   // The Fire Bet: 4 different points 24 to 1, 5 points 249 to 1 (6 points paid when made).
   const made=t.firePoints.length;if(t.fire){pay('fire',t.fire,made>=5?250*t.fire:made===4?25*t.fire:0);t.fire=0;}
   t.firePoints=[];t.newShooter=true;}
  else callText=CALLS[sum]?.(hardRoll)??`${sum}.`;
 }
 if(!callText)callText=`${sum}.`;
 if(!(r7out(pointBefore,sum)))t.newShooter=false;
 return {dice,sum,table:t,settled,restaked,call:callText,pointBefore};
}
const CALLS:Record<number,(hard:boolean)=>string>={
 2:()=>'Aces, two craps two.',3:()=>'Three, ace-deuce.',11:()=>'Yo-leven!',12:()=>'Twelve, boxcars!',
 4:h=>h?'Four, hard four, two-two.':'Four, easy four.',5:()=>'Five, fever five.',6:h=>h?'Six, hard six!':'Six, easy six.',
 8:h=>h?'Eight, hard eight!':'Eight, easy eight.',9:()=>'Nine, center field nine.',10:h=>h?'Ten, hard ten!':'Ten, easy ten.',
};
/** Labels for the layout. */
export const SPOT_LABEL:Record<string,string>={fire:'Fire Bet',big6:'Big 6',big8:'Big 8',...Object.fromEntries(POINTS.map(p=>[`lay${p}`,`Lay ${p}`])),...Object.fromEntries([1,2,3,4,5,6].flatMap(a=>[1,2,3,4,5,6].filter(b=>b>=a).map(b=>[`hop${a}${b}`,`Hop ${a}-${b}`]))),pass:'Pass line',dontPass:'Don’t pass',passOdds:'Pass odds',dontOdds:'Lay odds',come:'Come',dontCome:'Don’t come',field:'Field',any7:'Any 7',anyCraps:'Any craps',yo:'Yo 11',aces:'Aces (2)',aceDeuce:'Ace-deuce (3)',twelve:'Twelve',
 ...Object.fromEntries(POINTS.map(p=>[`place${p}`,`Place ${p}`])),...Object.fromEntries(POINTS.map(p=>[`comeOdds${p}`,`Come odds ${p}`])),...Object.fromEntries(POINTS.map(p=>[`dontComeOdds${p}`,`Lay odds ${p}`])),...Object.fromEntries([4,5,9,10].map(b=>[`buy${b}`,`Buy ${b}`])),...Object.fromEntries(HARD.map(h=>[`hard${h}`,`Hard ${h}`])),...Object.fromEntries(POINTS.map(p=>[`come${p}`,`Come ${p}`])),...Object.fromEntries(POINTS.map(p=>[`dontCome${p}`,`Don’t come ${p}`]))};
export function checkTable(v:unknown):CrapsTable {
 const t=v as CrapsTable,c=(n:unknown)=>Number.isSafeInteger(n)&&(n as number)>=0;
 if(!t||typeof t!=='object'||!(t.point===null||isPoint(t.point as number)))throw new Error('Craps layout is damaged.');
 const v2:CrapsTable={...freshTable(),...t,comeOdds:t.comeOdds??{},dontComeOdds:t.dontComeOdds??{},buy:t.buy??{},hop:t.hop??{},fire:t.fire??0,firePoints:t.firePoints??[],newShooter:t.newShooter??true,lay:t.lay??{},big6:t.big6??0,big8:t.big8??0,oddsX:t.oddsX??'345',working:t.working??false};
 const flat:SimpleSpot[]=['pass','dontPass','passOdds','dontOdds','come','dontCome','field','any7','anyCraps','yo','aces','aceDeuce','twelve','big6','big8'];
 if(!flat.every(k=>c(v2[k]))||(v2.oddsX!=='345'&&v2.oddsX!=='10')||typeof v2.working!=='boolean')throw new Error('Craps layout is damaged.');
 if(!c(v2.fire)||!Array.isArray(v2.firePoints)||!v2.firePoints.every(x=>isPoint(x))||typeof v2.newShooter!=='boolean'||!Object.entries(v2.hop).every(([k,a])=>/^[1-6]-[1-6]$/.test(k)&&c(a)))throw new Error('Craps layout is damaged.');
 for(const r of [v2.comeOn,v2.dontComeOn,v2.place,v2.hard,v2.comeOdds,v2.dontComeOdds,v2.buy,v2.lay])if(!r||typeof r!=='object'||!Object.entries(r).every(([k,a])=>isPoint(Number(k))&&c(a)))throw new Error('Craps layout is damaged.');
 return {...freshTable(),...v2,comeOn:{...v2.comeOn},dontComeOn:{...v2.dontComeOn},place:{...v2.place},hard:{...v2.hard},comeOdds:{...v2.comeOdds},dontComeOdds:{...v2.dontComeOdds},buy:{...v2.buy},hop:{...v2.hop},lay:{...v2.lay},firePoints:[...v2.firePoints]};
}
