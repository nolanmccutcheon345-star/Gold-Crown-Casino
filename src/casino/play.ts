/** Patch 99: the casino tables' controller. Each round is paid for, decided and saved before anything moves on screen;
 * the wheel, the cards, the dice and the race are only the show. */
import {readCasino,saveCasino,stake,settle,pushBoard,reloadCasino,secureRandom,money,CHIPS,type CasinoState,type CasinoGame,type Random} from './wallet';
import {resolve,spinWheel,validBet,call as rouletteCall,announcedBets,neighbours,finals,specialBets,type Special,colourOf,label as pocketLabel,ORDER,type Announced,type RouletteBet,type SpinOutcome,type Wheel} from './roulette';
import {patronsFor,patronLine,pickFor,speaks,heroLine,replyLine,actLine,turnover,chatAnswers,chanceOf,chooseOf,CHAT,type Patron,type PatronLine,type HeroEvent} from './patrons';
import {payout,call as baccaratCall,newShoe,dealShoe,checkShoe,SPOTS,type BaccaratBets,type BaccaratSpot,type Coup,type Shoe} from './baccarat';
import {freshTable,addBet,removeBet,roll,rollDice,checkTable,onLayout,cannotAdd,oddsUp,SPOT_LABEL,type CrapsTable,type RollResult,type Spot,type OddsX} from './craps';
import {newRace,runRace,odds,settleBet,paths,calls,validRaceBet,margin,ddOdds,checkCard,acrossTheBoard,boxBets,BOXABLE,PICKS,type RaceCard,type RaceBet,type BetKind,type DailyDouble} from './races';
/** Patch 101: the day at the races, kept between visits. */
export interface RaceDay {number:number;card:RaceCard;next:RaceCard;dd:DailyDouble[];results:{number:number;track:string;no:number;name:string;odds:number}[]}

export interface CasinoUi {
 chip:number;error:string;notice:string;
 /** Patch 100: the other players at each table, and what they said this round. */
 patrons:Record<'roulette'|'craps'|'baccarat'|'races',Patron[]>;talk:Record<'roulette'|'craps'|'baccarat'|'races',PatronLine[]>;
 /** Patch 104: the round when you last spoke at each table (one line a round). */
 said:Record<'roulette'|'craps'|'baccarat'|'races',number>;
 roulette:{wheel:Wheel;bets:RouletteBet[];last:RouletteBet[];phase:'betting'|'spinning'|'done';result:SpinOutcome|null;angle:number;spins:number;
  /** Patch 101: La Partage on the single-zero wheel, and auto-spin (spins left, stop on a win). */
  partage:boolean;auto:{left:number;stopOnWin:boolean}|null;
  /** Patch 102: how many neighbours each side a racetrack tap covers (1 to 4). */
  width:number};
 baccarat:{bets:BaccaratBets;last:BaccaratBets;phase:'betting'|'dealing'|'done';coup:Coup|null;shown:number;returned:number;bySpot:Partial<Record<BaccaratSpot,number>>;wagered:number;
  /** Patch 100: EZ Baccarat (no commission, Dragon 7 and Panda 8), and squeezing your side's cards. */
  ez:boolean;squeeze:boolean;waiting:boolean;squeezeSide:'P'|'B'|null;faceDown:number;
  /** Patch 101: hands left to deal automatically with the same bets. */
  auto:number;
  /** Patch 102: the shoe was just shuffled (a fresh set of roads), and the cut card is out (one more hand). */
  shuffled:boolean};
 craps:{phase:'idle'|'rolling';last:RollResult|null;rolls:number;takeDown:boolean;lastReturned:number;
  /** Patch 100: this shooter's rolls and points made, and the layout lost on the last seven-out. */
  shooter:{rolls:number;points:number;best:number};lastLayout:Partial<Record<string,number>>|null;
  /** Patch 101: who has the dice: 0 is you, then the other players in turn. */
  shooterSeat:number};
 races:{card:RaceCard;bets:(RaceBet&{odds:number})[];kind:BetKind|'dd'|'atb';
  /** Patch 102: a 7-second race instead of 14. */
  quick:boolean;
  /** Patch 103: box Exacta, Trifecta and Superfecta picks (every order). */
  box:boolean;picking:number[];photo:boolean;
  /** Patch 101: Daily Doubles waiting to go in with this race, the next race's card, and the replay. */
  dd:DailyDouble[];next:RaceCard;replay:boolean;lines:{at:number;text:string}[];phase:'betting'|'running'|'done';order:number[]|null;returned:number;wagered:number;call:string;paths:Record<number,number[]>|null;results:number[];frame:number};
  /** Patch 102: your net result at each table since this visit began. */
 session:Record<CasinoGame,number>;
}
export interface CasinoDeps {render():void;sound(kind:string):void;active(game:string):boolean;}
const key=(b:Pick<RouletteBet,'kind'|'numbers'>)=>`${b.kind}:${[...b.numbers].sort((x,y)=>x-y).join('-')}`;
export const RACE_FRAMES=280,RACE_MS=14000,QUICK_RACE_MS=7000;

export class CasinoPlayer {
 state:CasinoState;ui:CasinoUi;private timers:number[]=[];private raceTimer=0;day:RaceDay;
 constructor(private deps:CasinoDeps,private random:Random=secureRandom){
  const read=readCasino();this.state=read.state;const day=new Date().toISOString().slice(0,10);
  this.day=this.loadDay();
  this.ui={chip:CHIPS[1],error:'',notice:read.notice,
   patrons:{roulette:patronsFor('roulette',day),craps:patronsFor('craps',day),baccarat:patronsFor('baccarat',day),races:patronsFor('races',day)},talk:{roulette:[],craps:[],baccarat:[],races:[]},said:{roulette:-1,craps:-1,baccarat:-1,races:-1},
   roulette:{wheel:'european',bets:[],last:[],phase:'betting',result:null,angle:0,spins:0,partage:false,auto:null,width:2},
   baccarat:{bets:{},last:{},phase:'betting',coup:null,shown:0,returned:0,bySpot:{},wagered:0,ez:false,squeeze:false,waiting:false,squeezeSide:null,faceDown:-1,auto:0,shuffled:false},
   craps:{phase:'idle',last:null,rolls:0,takeDown:false,lastReturned:0,shooter:{rolls:0,points:0,best:0},lastLayout:null,shooterSeat:0},
   races:{card:this.day.card,next:this.day.next,quick:false,box:false,dd:[],replay:false,lines:[],bets:[],kind:'win',picking:[],photo:false,phase:'betting',order:null,returned:0,wagered:0,call:'',paths:null,results:[],frame:0},
   session:{roulette:0,craps:0,baccarat:0,races:0}};
 }
 /* ---------- Patch 104: table life ---------- */
 /** Add to a round's lines: a word to you, another player answering the first line, and something someone does.
  * At most three spoken lines; an action line does not count. */
 private liven(game:CasinoGame,seed:string,base:PatronLine[],o:{hero?:HeroEvent|null;heroOdds?:number;bet?:string;reply?:number;act?:number}={}):PatronLine[] {
  const ps=this.ui.patrons[game],out=[...base],spoke=new Set(out.map(l=>l.name)),spoken=()=>out.filter(l=>l.mood!=='act').length;
  const free=(tag:string)=>chooseOf(ps.filter(p=>!spoke.has(p.name)),`${seed}:${tag}`);
  if(o.hero&&spoken()<3&&chanceOf(`${seed}:hero`,o.heroOdds??1)){const p=free('hero');if(p){spoke.add(p.name);out.push({name:p.name,text:heroLine(p,o.hero,o.bet??'',seed),mood:'you',to:'You'});}}
  const first=out.find(l=>l.mood!=='act'&&l.mood!=='you');
  if(first&&spoken()<3&&chanceOf(`${seed}:reply`,o.reply??.3)){const p=free('reply');if(p){spoke.add(p.name);out.push(replyLine(p,first,seed));}}
  if(chanceOf(`${seed}:act`,o.act??.25)){const p=free('act')??chooseOf(ps,`${seed}:act2`);if(p)out.push(actLine(game,p,seed));}
  return out;
 }
 /** How your round went, as an event a player might mention. */
 private heroOutcome(wagered:number,returned:number):{ev:HeroEvent|null;odds:number} {
  if(!wagered)return {ev:null,odds:0};
  if(returned>=6*wagered||returned-wagered>=20*this.ui.chip)return {ev:'heroBig',odds:.8};
  return returned>wagered?{ev:'heroWin',odds:.3}:returned===0?{ev:'heroLose',odds:.15}:{ev:null,odds:0};
 }
 /** Now and then someone leaves and a new player takes the seat. */
 private comeAndGo(game:CasinoGame,seed:string,keep=-1){
  const t=turnover(game,this.ui.patrons[game],seed,keep);if(!t)return;
  this.ui.patrons[game]=this.ui.patrons[game].map((p,i)=>i===t.seat?t.arriving:p);
  this.ui.talk[game]=[...this.ui.talk[game].filter(l=>l.name!==t.leaving.name),...t.lines];
 }
 /** Say something at a casino table (once a round); one or two players answer. */
 casinoSay(game:CasinoGame,key:string){
  const opt=CHAT[game]?.find(o=>o.key===key);if(!opt)return;
  const round=this.state.games[game]?.rounds??0;if(this.ui.said[game]===round)return;
  let table=this.ui.patrons[game];
  if(key==='nice'){const w=this.ui.talk[game].find(l=>l.mood==='win');const p=w&&table.find(x=>x.name===w.name);if(!p)return;table=[p];}
  this.ui.said[game]=round;
  const seed=`say:${game}:${round}:${key}`,h=this.ui.races,live=h.card.runners.filter(r=>!r.scratched);
  const pickOf=(p:Patron)=>live[pickFor(p,`rc:${h.card.id}`,live.length)].no;
  this.ui.talk[game]=[{name:'You',text:opt.text,mood:'hero'},...chatAnswers(game,table,key,seed,pickOf)];
  this.deps.render();
 }
 /** Can you speak at this table now, and is there a win to compliment? */
 canSay(game:CasinoGame):{open:boolean;nice:boolean} {return {open:this.ui.said[game]!==(this.state.games[game]?.rounds??0),nice:this.ui.talk[game].some(l=>l.mood==='win')};}
 /** Patch 102: record a settled round, with a short note for the "Your rounds" panel. */
 private record(s:CasinoState,game:CasinoGame,wagered:number,returned:number,bet:string,result:string):CasinoState {
  this.ui.session[game]+=returned-wagered;return settle(s,game,wagered,returned,{bet,result});
 }
 private save(){saveCasino(this.state);}
 private wait(ms:number,fn:()=>void){const t=window.setTimeout(()=>{this.timers=this.timers.filter(x=>x!==t);fn();},ms);this.timers.push(t);}
 private fail(e:unknown){this.ui.error=(e as Error).message;this.deps.render();}
 get craps():CrapsTable {try{return this.state.craps?checkTable(this.state.craps):freshTable();}catch{return freshTable();}}
 /** Money on the layout or in the bet slip that has not gone in yet. */
 pending(game:'roulette'|'baccarat'|'races'):number {
  // Only chips not yet in play: once a round starts, its money is already out of the balance.
  if(game==='roulette')return this.ui.roulette.phase==='spinning'?0:this.ui.roulette.bets.reduce((a,b)=>a+b.amount,0);
  if(game==='baccarat')return this.ui.baccarat.phase==='betting'?Object.values(this.ui.baccarat.bets).reduce((a:number,b)=>a+(b??0),0):0;
  return this.ui.races.phase==='betting'?this.ui.races.bets.reduce((a,b)=>a+b.amount,0)+this.ui.races.dd.reduce((a,b)=>a+b.amount,0):0;
 }
 setChip(c:number){if((CHIPS as readonly number[]).includes(c))this.ui.chip=c;this.deps.render();}
 reload(){try{this.state=reloadCasino(this.state);this.save();this.ui.error='';this.ui.notice='Your casino balance is back to $1,000.';}catch(e){this.ui.error=(e as Error).message;}this.deps.render();}
 /** Patch 101: replace the casino save with one from a backup (already checked). */
 restore(state:CasinoState){this.finishNow();this.state=state;this.save();this.ui.roulette.bets=[];this.ui.baccarat.bets={};this.ui.races.bets=[];this.ui.error='';this.ui.notice='';}
 /** Finish anything still animating straight away (leaving a table). */
 finishNow(){for(const t of this.timers)clearTimeout(t);this.timers=[];this.ui.notice='';this.ui.error='';this.ui.roulette.auto=null;this.ui.baccarat.auto=0;
  const r=this.ui.roulette;if(r.phase==='spinning')r.phase='done';
  const b=this.ui.baccarat;if(b.phase==='dealing'){b.shown=b.coup?b.coup.order.length:0;b.phase='done';b.waiting=false;b.faceDown=-1;this.dealStep=null;}
  this.ui.craps.phase='idle';
  const h=this.ui.races;if(h.phase==='running'){clearInterval(this.raceTimer);this.raceTimer=0;h.phase='done';h.frame=RACE_FRAMES;h.results=h.order?h.order.slice(0,3):[];h.call=h.order?`${h.card.runners[h.order[0]-1].name} wins it!`:'';}
 }

 /* ---------- Roulette ---------- */
 setWheel(w:Wheel){const r=this.ui.roulette;if(r.phase==='spinning')return;if(r.bets.some(b=>b.numbers.includes(37))&&w==='european')r.bets=r.bets.filter(b=>!b.numbers.includes(37)&&b.kind!=='basket');r.wheel=w;r.result=null;r.phase='betting';this.deps.render();}
 placeRoulette(kind:RouletteBet['kind'],numbers:number[]){
  const r=this.ui.roulette;if(r.phase==='spinning')return;
  if(r.phase==='done'){r.phase='betting';r.result=null;}
  const bet={kind,numbers,amount:this.ui.chip};
  if(!validBet(bet,r.wheel))return this.fail(new Error('That bet is not on this layout.'));
  if(this.pending('roulette')+bet.amount>this.state.balance)return this.fail(new Error('Not enough in your casino balance for another chip.'));
  const k=key(bet),old=r.bets.find(b=>key(b)===k);
  r.bets=old?r.bets.map(b=>b===old?{...b,amount:b.amount+bet.amount}:b):[...r.bets,bet];
  this.ui.error='';this.deps.sound('chip');this.deps.render();
 }
 /** Patch 100: racetrack bets on the single-zero wheel. */
 placeAnnounced(which:Announced){this.placeMany(announcedBets(which,this.ui.chip));}
 placeNeighbours(n:number){this.placeMany(neighbours(n,this.ui.roulette.wheel,this.ui.roulette.width,this.ui.chip));}
 /** Patch 102: how wide a neighbours bet is: 1 to 4 numbers each side. */
 setWidth(w:number){if(Number.isInteger(w)&&w>=1&&w<=4)this.ui.roulette.width=w;this.deps.render();}
 /** Patch 102: double up: twice the chips on the layout, or the last spin's bets at twice the size. */
 doubleRoulette(){
  const r=this.ui.roulette;if(r.phase==='spinning')return;
  const from=r.bets.length?r.bets:r.last.filter(b=>validBet(b,r.wheel));if(!from.length)return this.fail(new Error('Place a chip or spin once first, then double.'));
  const bets=from.map(b=>({...b,numbers:[...b.numbers],amount:2*b.amount})),total=bets.reduce((a,b)=>a+b.amount,0);
  if(total>this.state.balance)return this.fail(new Error(`Doubling needs ${money(total)} and you have ${money(this.state.balance)}.`));
  r.bets=bets;r.phase='betting';r.result=null;this.ui.error='';this.deps.sound('chip');this.deps.render();
 }
 /** Patch 103: the Snake, red splits and black splits (on either wheel). */
 placeSpecial(which:Special){this.placeMany(specialBets(which,this.ui.chip),true);}
 private placeMany(bets:RouletteBet[],anyWheel=false){
  const r=this.ui.roulette;if(r.phase==='spinning')return;
  if(!anyWheel&&r.wheel!=='european')return this.fail(new Error('The racetrack is on the single-zero wheel.'));
  if(r.phase==='done'){r.phase='betting';r.result=null;}
  const total=bets.reduce((a,b)=>a+b.amount,0);
  if(this.pending('roulette')+total>this.state.balance)return this.fail(new Error(`That bet needs ${money(total)} and you have ${money(this.state.balance-this.pending('roulette'))} free.`));
  for(const bet of bets){if(!validBet(bet,r.wheel))return this.fail(new Error('That bet is not on this layout.'));const k=key(bet),old=r.bets.find(b=>key(b)===k);r.bets=old?r.bets.map(b=>b===old?{...b,amount:b.amount+bet.amount}:b):[...r.bets,bet];}
  this.ui.error='';this.deps.sound('chip');this.deps.render();
 }
 placeFinals(d:number){this.placeMany(finals(d,this.ui.chip));}
 setPartage(on:boolean){const r=this.ui.roulette;if(r.phase==='spinning')return;r.partage=on;this.deps.render();}
 /** Save the chips on the layout (or the last spin's) as a favourite; up to three. */
 saveFavourite(){
  const r=this.ui.roulette,bets=r.bets.length?r.bets:r.last;if(!bets.length)return this.fail(new Error('Put chips on the layout first, then save them.'));
  const favs=[...(this.state.favs??[])];if(favs.length>=3)favs.shift();
  const total=bets.reduce((a,b)=>a+b.amount,0);
  favs.push({name:`${r.wheel==='european'?'Single zero':'Double zero'} · ${bets.length} bet${bets.length===1?'':'s'} · $${(total/100).toLocaleString('en-US')}`,wheel:r.wheel,bets:bets.map(b=>({kind:b.kind,numbers:[...b.numbers],amount:b.amount}))});
  this.state={...this.state,favs};this.save();this.ui.error='';this.ui.notice='Layout saved to your favourites.';this.deps.render();
 }
 useFavourite(i:number){
  const r=this.ui.roulette,f=this.state.favs?.[i];if(!f||r.phase==='spinning')return;
  if(f.wheel!==r.wheel){r.wheel=f.wheel;r.result=null;}
  const bets=f.bets.map(b=>({kind:b.kind as RouletteBet['kind'],numbers:[...b.numbers],amount:b.amount}));
  if(!bets.every(b=>validBet(b,r.wheel)))return this.fail(new Error('That saved layout is not valid on this wheel.'));
  if(bets.reduce((a,b)=>a+b.amount,0)>this.state.balance)return this.fail(new Error('Not enough for that layout.'));
  r.bets=bets;r.phase='betting';r.result=null;this.ui.error='';this.ui.notice='';this.deps.sound('chip');this.deps.render();
 }
 deleteFavourite(i:number){const favs=(this.state.favs??[]).filter((_,j)=>j!==i);this.state={...this.state,favs};this.save();this.deps.render();}
 /** Spin the same bets again and again. */
 autoSpin(n:number,stopOnWin:boolean){
  const r=this.ui.roulette;if(r.phase==='spinning')return;if(!(n>0)){r.auto=null;return this.deps.render();}
  r.auto={left:n,stopOnWin};this.spinRoulette();
 }
 stopAuto(){this.ui.roulette.auto=null;this.ui.baccarat.auto=0;this.deps.render();}
 undoRoulette(){const r=this.ui.roulette;if(r.phase==='spinning')return;r.bets=r.bets.slice(0,-1);this.deps.render();}
 clearRoulette(){const r=this.ui.roulette;if(r.phase==='spinning')return;r.bets=[];this.deps.render();}
 rebetRoulette(){const r=this.ui.roulette;if(r.phase==='spinning'||!r.last.length)return;const total=r.last.reduce((a,b)=>a+b.amount,0);
  if(total>this.state.balance)return this.fail(new Error('Not enough for the same bets again.'));r.bets=r.last.filter(b=>validBet(b,r.wheel)).map(b=>({...b}));r.phase='betting';r.result=null;this.deps.render();}
 spinRoulette(){
  const r=this.ui.roulette;if(r.phase==='spinning')return;
  if(!r.bets.length&&r.phase==='done'&&r.last.length&&r.last.reduce((a,b)=>a+b.amount,0)<=this.state.balance)r.bets=r.last.filter(b=>validBet(b,r.wheel)).map(b=>({...b}));
  if(!r.bets.length){r.auto=null;return this.fail(new Error('Place a chip on the layout first.'));}
  try{
   const total=this.pending('roulette');this.state=stake(this.state,total);
   const pocket=spinWheel(r.wheel,this.random),out=resolve(r.bets,pocket,r.partage&&r.wheel==='european');
   this.state=pushBoard(this.record(this.state,'roulette',out.wagered,out.returned,describeRoulette(r.bets),`${pocketLabel(pocket)} ${colourOf(pocket)}`),'roulette',pocket,300);this.save();
   r.last=r.bets.map(b=>({...b}));r.result=out;r.phase='spinning';r.spins++;this.ui.error='';
   // The other players' picks: a straight number or a colour each.
   const seed=`rl:${r.spins}:${pocket}:${this.state.games.roulette?.rounds??0}`,ps=this.ui.patrons.roulette;
   const picks=ps.map(p=>{const k=pickFor(p,seed,40);return k<37?{label:String(ORDER.european[k]),win:ORDER.european[k]===pocket,big:true}:k===37?{label:'red',win:colourOf(pocket)==='red',big:false}:k===38?{label:'black',win:colourOf(pocket)==='black',big:false}:{label:'zero',win:pocket===0,big:true};});
   this.ui.talk.roulette=ps.flatMap((p,i)=>speaks(p,`${seed}:start`,.35)?[{name:p.name,text:patronLine('roulette',p,'start',picks[i].label,seed),mood:'talk' as const}]:[]).slice(0,2);
   // Patch 104: a player on the same number or colour as you says so.
   const mine=new Set(r.last.flatMap(b=>b.kind==='straight'?[String(b.numbers[0]),...(b.numbers[0]===0?['zero']:[])]:b.kind==='red'||b.kind==='black'?[b.kind]:[]));
   const twin=ps.findIndex((p,i)=>mine.has(picks[i].label)&&!this.ui.talk.roulette.some(l=>l.name===p.name));
   const twinLine=twin>=0&&chanceOf(`${seed}:twin`,.6)?[{name:ps[twin].name,text:heroLine(ps[twin],'sameBet',picks[twin].label==='zero'?'zero':/^\d/.test(picks[twin].label)?picks[twin].label:picks[twin].label[0].toUpperCase()+picks[twin].label.slice(1),seed),mood:'you' as const,to:'You'}]:[];
   this.ui.talk.roulette=this.liven('roulette',`${seed}:s`,[...this.ui.talk.roulette,...twinLine].slice(0,3),{reply:.25,act:.3});
   this.deps.sound('roll');this.deps.render();
   this.wait(3700,()=>this.deps.sound('drop'));
   this.wait(4300,()=>{r.phase='done';r.bets=[];
    this.ui.talk.roulette=ps.flatMap((p,i)=>{const w=picks[i].win,when=w?(picks[i].big?'big':'win'):'lose';return w||speaks(p,`${seed}:end`,.3)?[{name:p.name,text:`${patronLine('roulette',p,when,picks[i].label,seed)}`,mood:(w?'win':'lose') as 'win'|'lose'}]:[];}).slice(0,2);
    const you=this.heroOutcome(out.wagered,out.returned);this.ui.talk.roulette=this.liven('roulette',`${seed}:e`,this.ui.talk.roulette,{hero:you.ev,heroOdds:you.odds,reply:.3,act:.15});this.comeAndGo('roulette',`${seed}:tv`);
    this.deps.sound(out.returned>out.wagered?'money':out.returned>0?'win':'fold');
    // Auto-spin: go again with the same chips unless it is time to stop.
    const a=r.auto;if(a){a.left--;const again=r.last.reduce((x,b)=>x+b.amount,0);
     if(a.left<=0||(a.stopOnWin&&out.returned>out.wagered)||again>this.state.balance||!this.deps.active('roulette'))r.auto=null;
     else this.wait(1400,()=>{if(this.ui.roulette.auto)this.spinRoulette();});}
    this.deps.render();});
  }catch(e){this.fail(e);}
 }
 rouletteCall():string {const r=this.ui.roulette.result;return r?rouletteCall(r.pocket):'';}

 /* ---------- Baccarat ---------- */
 placeBaccarat(spot:BaccaratSpot){
  const b=this.ui.baccarat;if(b.phase==='dealing'||!SPOTS.includes(spot))return;
  if((spot==='dragon7'||spot==='panda8')&&!b.ez)return this.fail(new Error('Dragon 7 and Panda 8 are EZ Baccarat side bets.'));
  if(b.phase==='done'){b.phase='betting';b.coup=null;b.shown=0;b.bets={};}
  if(this.pending('baccarat')+this.ui.chip>this.state.balance)return this.fail(new Error('Not enough in your casino balance for another chip.'));
  b.bets={...b.bets,[spot]:(b.bets[spot]??0)+this.ui.chip};this.ui.error='';this.deps.sound('chip');this.deps.render();
 }
 autoDeal(n:number){const b=this.ui.baccarat;if(b.phase==='dealing')return;b.auto=n;b.squeeze=false;this.dealBaccarat();if(this.ui.error)b.auto=0;}
 setEz(on:boolean){const b=this.ui.baccarat;if(b.phase==='dealing')return;b.ez=on;if(!on){const rest={...b.bets};delete rest.dragon7;delete rest.panda8;b.bets=rest;}b.last={};this.deps.render();}
 setSqueeze(on:boolean){this.ui.baccarat.squeeze=on;this.deps.render();}
 /** Turn over the card being squeezed, and carry on dealing. */
 peel(){const b=this.ui.baccarat;if(!b.waiting)return;b.waiting=false;this.dealStep?.();}
 private dealStep:(()=>void)|null=null;
 clearBaccarat(){const b=this.ui.baccarat;if(b.phase==='dealing')return;b.bets={};if(b.phase==='done'){b.phase='betting';b.coup=null;b.shown=0;}this.deps.render();}
 rebetBaccarat(){const b=this.ui.baccarat;if(b.phase==='dealing')return;const total=Object.values(b.last).reduce((x:number,y)=>x+(y??0),0);if(!total)return;if(total>this.state.balance)return this.fail(new Error('Not enough for the same bets again.'));b.bets={...b.last};b.phase='betting';b.coup=null;b.shown=0;this.deps.render();}
 dealBaccarat(){
  const b=this.ui.baccarat;if(b.phase==='dealing')return;
  if(b.phase==='done'){b.phase='betting';b.bets={};const again=Object.values(b.last).reduce((x:number,y)=>x+(y??0),0);if(again&&again<=this.state.balance)b.bets={...b.last};}
  const total=this.pending('baccarat');if(!total)return this.fail(new Error('Bet on Player, Banker, Tie or a pair first.'));
  try{
   this.state=stake(this.state,total);
   // Patch 102: the hand comes from the shoe on the table. After the hand that follows the cut card, the shoe is
   // shuffled and the roads start again.
   let sh=this.shoe();b.shuffled=false;
   if(sh.last||sh.cards.length-sh.next<6){sh=newShoe(this.random,sh.number+1);this.state={...this.state,boards:{...(this.state.boards??{}),baccarat:[]}};b.shuffled=true;}
   const dealt=dealShoe(sh),coup=dealt.coup,res=payout(coup,b.bets,b.ez);
   this.state=pushBoard(this.record({...this.state,bacShoe:dealt.shoe},'baccarat',total,res.returned,describeBaccarat(b.bets),baccaratCall(coup).replace(/\.$/,'')),'baccarat',coup.winner==='player'?'P':coup.winner==='banker'?'B':'T',150);this.save();
   b.last={...b.bets};b.coup=coup;b.shown=0;b.phase='dealing';b.returned=res.returned;b.bySpot=res.bySpot;b.wagered=total;this.ui.error='';
   // Squeeze the side you backed most (Player or Banker).
   const pb=b.bets.player??0,bb=b.bets.banker??0;b.squeezeSide=b.squeeze&&(pb||bb)?(pb>=bb?'P':'B'):null;b.waiting=false;b.faceDown=-1;
   const seed=`bc:${this.state.games.baccarat?.rounds??0}:${coup.player.join('')}`,ps=this.ui.patrons.baccarat,sides=ps.map(p=>pickFor(p,seed,10)<5?'player':'banker');
   this.ui.talk.baccarat=ps.flatMap(p=>speaks(p,`${seed}:start`,.3)?[{name:p.name,text:patronLine('baccarat',p,'start','',seed),mood:'talk' as const}]:[]).slice(0,1);
   // Patch 104: someone on your side says so, and the squeezing starts.
   const yours=pb||bb?(pb>=bb?'player':'banker'):null,twin=yours?ps.findIndex((p,i)=>sides[i]===yours&&!this.ui.talk.baccarat.some(l=>l.name===p.name)):-1;
   if(twin>=0&&chanceOf(`${seed}:twin`,.35))this.ui.talk.baccarat.push({name:ps[twin].name,text:heroLine(ps[twin],'sameBet',yours==='player'?'Player':'Banker',seed),mood:'you',to:'You'});
   this.ui.talk.baccarat=this.liven('baccarat',`${seed}:s`,this.ui.talk.baccarat,{reply:.2,act:.4});
   this.deps.render();
   const finish=()=>{b.phase='done';
    this.ui.talk.baccarat=ps.flatMap((p,i)=>{const w=coup.winner===sides[i],tie=coup.winner==='tie';return speaks(p,`${seed}:end`,tie?.7:.4)?[{name:p.name,text:patronLine('baccarat',p,tie?'big':w?'win':'lose','',seed),mood:(w||tie?'win':'lose') as 'win'|'lose'}]:[];}).slice(0,2);
    const you=this.heroOutcome(total,res.returned);this.ui.talk.baccarat=this.liven('baccarat',`${seed}:e`,this.ui.talk.baccarat,{hero:you.ev,heroOdds:you.odds,reply:.3,act:.1});this.comeAndGo('baccarat',`${seed}:tv`);
    this.deps.sound(res.returned>total?'money':res.returned===total?'win':'fold');
    if(b.auto>0){b.auto--;if(b.auto>0&&this.deps.active('baccarat'))this.wait(1800,()=>{if(this.ui.baccarat.auto>0)this.dealBaccarat();});else b.auto=0;}
    this.deps.render();};
   const n=coup.order.length,next=()=>{if(b.shown<n)this.wait(b.shown===4&&n>4?1100:700,step);else{this.dealStep=null;this.wait(600,finish);}};
   const step=()=>{
    const idx=b.shown;b.shown++;
    // A card for the side you backed waits face down until you peel it.
    if(b.squeezeSide&&coup.order[idx]===b.squeezeSide){b.faceDown=idx;b.waiting=true;this.deps.render();return;}
    this.deps.sound('card');this.deps.render();next();};
   this.dealStep=()=>{b.faceDown=-1;this.deps.sound('card');this.deps.render();next();};
   this.wait(400,step);
  }catch(e){this.fail(e);}
 }
 /** The shoe in use (a fresh one if the saved shoe is missing or damaged). */
 shoe():Shoe {try{if(this.state.bacShoe)return checkShoe(this.state.bacShoe);}catch{/* shuffle a new one */}const s=newShoe(this.random);this.state={...this.state,bacShoe:s};return s;}
 /** Shuffle now: a new shoe and fresh roads (only between hands). */
 shuffleShoe(){const b=this.ui.baccarat;if(b.phase==='dealing')return;const old=this.shoe();this.state={...this.state,bacShoe:newShoe(this.random,old.number+1),boards:{...(this.state.boards??{}),baccarat:[]}};this.save();b.shuffled=true;b.coup=null;b.shown=0;if(b.phase==='done')b.phase='betting';this.ui.error='';this.deps.sound('shuffle');this.deps.render();}
 baccaratCall():string {const b=this.ui.baccarat;return b.coup&&b.phase==='done'?baccaratCall(b.coup):'';}

 /* ---------- Craps ---------- */
 crapsSpot(spot:Spot){
  if(this.ui.craps.phase==='rolling')return;
  try{
   const t=this.craps;
   if(this.ui.craps.takeDown){const {table,back}=removeBet(t,spot);this.state={...this.state,balance:this.state.balance+back,craps:table};this.ui.craps.takeDown=false;}
   else{const why=cannotAdd(t,spot,this.ui.chip);if(why)throw new Error(why);this.state=stake(this.state,this.ui.chip);this.state={...this.state,craps:addBet(t,spot,this.ui.chip)};this.deps.sound('chip');}
   this.save();this.ui.error='';
  }catch(e){this.ui.error=(e as Error).message;}
  this.deps.render();
 }
 /** Put back the bets that were on the layout at the last seven-out (line bets only on the come-out). */
 sameBets(){
  const c=this.ui.craps,lay=c.lastLayout;if(c.phase==='rolling'||!lay)return;
  try{let t=this.craps,s=this.state,n=0;
   for(const [spot,a] of Object.entries(lay)){if(!a||cannotAdd(t,spot as Spot,a))continue;if(a>s.balance)break;s=stake(s,a);t=addBet(t,spot as Spot,a);n++;}
   if(!n)throw new Error('Those bets cannot go back on right now.');
   this.state={...s,craps:t};this.save();this.ui.error='';this.deps.sound('chip');
  }catch(e){this.ui.error=(e as Error).message;}
  this.deps.render();
 }
 /** A Horn bet: one chip each on 2, 3, 11 and 12. */
 placeHorn(){
  if(this.ui.craps.phase==='rolling')return;const c=this.ui.chip;
  try{if(4*c>this.state.balance)throw new Error('A Horn bet needs four chips.');let t=this.craps,s=this.state;
   for(const spot of ['aces','aceDeuce','yo','twelve'] as Spot[]){s=stake(s,c);t=addBet(t,spot,c);}
   this.state={...s,craps:t};this.save();this.ui.error='';this.deps.sound('chip');}catch(e){this.ui.error=(e as Error).message;}
  this.deps.render();
 }
 /** Press: one more chip on every place and buy bet that is up. */
 pressPlace(){
  if(this.ui.craps.phase==='rolling')return;const c=this.ui.chip;
  try{let t=this.craps,s=this.state;const spots=[...Object.keys(t.place).map(n=>`place${n}`),...Object.keys(t.buy).map(n=>`buy${n}`)] as Spot[];
   if(!spots.length)throw new Error('No place or buy bets to press.');if(spots.length*c>s.balance)throw new Error('Not enough to press every bet.');
   for(const spot of spots){s=stake(s,c);t=addBet(t,spot,c);}
   this.state={...s,craps:t};this.save();this.ui.error='';this.deps.sound('chip');}catch(e){this.ui.error=(e as Error).message;}
  this.deps.render();
 }
 /** Who is shooting now: "You" or another player's name. */
 shooterName():string {const i=this.ui.craps.shooterSeat;return i===0?'You':this.ui.patrons.craps[i-1]?.name??'You';}
 /** Patch 102: the table's odds limit. It can change only when no odds are up. */
 setOddsX(x:OddsX){
  if(this.ui.craps.phase==='rolling'||(x!=='345'&&x!=='10'))return;const t=this.craps;
  if(oddsUp(t)&&t.oddsX!==x)return this.fail(new Error('Take your odds down first, then change the odds limit.'));
  this.state={...this.state,craps:{...t,oddsX:x}};this.save();this.ui.error='';this.deps.render();
 }
 /** Patch 103: call place, buy and hardway bets and come odds working (or off) on the come-out. */
 setWorking(on:boolean){if(this.ui.craps.phase==='rolling')return;this.state={...this.state,craps:{...this.craps,working:on}};this.save();this.deps.render();}
 /** Patch 102: C&E (one chip each on Any craps and Yo) and the World bet (the Horn plus Any 7). */
 placeGroup(which:'ce'|'world'){
  if(this.ui.craps.phase==='rolling')return;const c=this.ui.chip,spots:Spot[]=which==='ce'?['anyCraps','yo']:['aces','aceDeuce','yo','twelve','any7'];
  try{if(spots.length*c>this.state.balance)throw new Error(`That bet needs ${spots.length} chips.`);let t=this.craps,s=this.state;
   for(const spot of spots){s=stake(s,c);t=addBet(t,spot,c);}
   this.state={...s,craps:t};this.save();this.ui.error='';this.deps.sound('chip');}catch(e){this.ui.error=(e as Error).message;}
  this.deps.render();
 }
 toggleTakeDown(){this.ui.craps.takeDown=!this.ui.craps.takeDown;this.deps.render();}
 rollCraps(){
  const c=this.ui.craps;if(c.phase==='rolling')return;
  const t=this.craps;if(!onLayout(t))return this.fail(new Error('Put a bet on the layout first. On the come-out, start with the Pass line.'));
  const r=roll(t,rollDice(this.random));
  const wagered=r.settled.reduce((a,p)=>a+p.stake,0),returned=r.settled.reduce((a,p)=>a+p.back,0);
  // Shooter stats, and what was on the layout when the shooter sevened out (for "Same bets").
  const sh=c.shooter;sh.rolls++;
  if(r.pointBefore&&r.sum===r.pointBefore)sh.points++;
  const sevenOut=!!r.pointBefore&&r.sum===7;
  if(sevenOut){sh.best=Math.max(sh.best,sh.rolls);
   const lost:Partial<Record<string,number>>={};if(t.pass)lost.pass=t.pass;if(t.dontPass)lost.dontPass=t.dontPass;
   for(const [n,a] of Object.entries(t.place))lost[`place${n}`]=a;for(const [n,a] of Object.entries(t.buy))lost[`buy${n}`]=a;for(const [n,a] of Object.entries(t.hard))lost[`hard${n}`]=a;
   c.lastLayout=Object.keys(lost).length?lost:null;}
  const seed=`cr:${c.rolls}:${r.dice.join('')}:${this.state.games.craps?.rounds??0}`,ps=this.ui.patrons.craps,dark=ps.map(p=>pickFor(p,seed,6)===0);
  const lineWin=(r.pointBefore===null&&(r.sum===7||r.sum===11))||(r.pointBefore!==null&&r.sum===r.pointBefore),lineLose=(r.pointBefore===null&&[2,3,12].includes(r.sum))||sevenOut;
  const big=(r.dice[0]===r.dice[1]&&[4,6,8,10].includes(r.sum)&&!!r.pointBefore)||r.sum===11;
  const bigName=r.sum===11?'Yo-leven':`Hard ${r.sum}`;
  this.ui.talk.craps=ps.flatMap((p,i):PatronLine[]=>{const won=dark[i]?lineLose&&r.sum!==12:lineWin,lost=dark[i]?lineWin:lineLose;
   if(won)return [{name:p.name,text:patronLine('craps',p,dark[i]?'dark':big?'big':'win',bigName,seed),mood:'win' as const}];
   if(lost&&speaks(p,`${seed}:l`,.5))return [{name:p.name,text:patronLine('craps',p,sevenOut&&!dark[i]?'lose':'miss','',seed),mood:'lose' as const}];
   if(big&&!dark[i]&&speaks(p,`${seed}:b`,.5))return [{name:p.name,text:patronLine('craps',p,'big',bigName,seed),mood:'win' as const}];
   return speaks(p,`${seed}:s`,.12)?[{name:p.name,text:patronLine('craps',p,'start','',seed),mood:'talk' as const}]:[];}).slice(0,2);
  // Patch 104: the table and you. When you hold the dice, they rally behind you; otherwise they notice big wins.
  const heroDice=c.shooterSeat===0,made=!!r.pointBefore&&r.sum===r.pointBefore;
  const ev:HeroEvent|null=heroDice?(sevenOut?'heroSevenOut':made?'heroPoint':sh.rolls>=12&&sh.rolls%6===0?'heroHot':sh.rolls===1?'heroShooter':null):null;
  const you=ev?{ev,odds:ev==='heroShooter'?.6:.75}:this.heroOutcome(wagered,returned);
  this.ui.talk.craps=this.liven('craps',seed,this.ui.talk.craps,{hero:you.ev,heroOdds:you.ev==='heroWin'?.12:you.ev==='heroLose'?.05:you.odds,reply:.2,act:.18});
  if(sevenOut)this.comeAndGo('craps',`${seed}:tv`,c.shooterSeat>0?c.shooterSeat-1:-1);
  let s:CasinoState={...this.state,craps:r.table};
  if(wagered)s=this.record(s,'craps',wagered,returned,[...new Set(r.settled.map(x=>SPOT_LABEL[x.spot]??x.spot))].slice(0,4).join(', ')+(r.settled.length>4?'…':''),`${r.sum} (${r.dice.join('-')})`);
  s={...s,balance:s.balance-r.restaked};
  this.state=pushBoard(s,'craps',r.dice,600);this.save();
  c.phase='rolling';c.last=r;c.rolls++;c.lastReturned=returned-r.restaked;c.takeDown=false;this.ui.error='';
  this.deps.sound('dice');this.deps.render();
  this.wait(1200,()=>{c.phase='idle';if(sevenOut){c.shooter={rolls:0,points:0,best:sh.best};c.shooterSeat=(c.shooterSeat+1)%(this.ui.patrons.craps.length+1);}this.deps.sound(returned>wagered?'money':returned>0?'win':wagered?'fold':'flip');this.deps.render();});
 }

 /* ---------- Races ---------- */
/** The saved race day, or a new one. */
 private loadDay():RaceDay {
  const v=this.state.raceDay as RaceDay|undefined;
  try{if(v&&Number.isSafeInteger(v.number)&&Array.isArray(v.dd)&&Array.isArray(v.results)){checkCard(v.card);checkCard(v.next);return {...v,dd:v.dd.filter(d=>d&&Number.isSafeInteger(d.amount)&&d.amount>0)};}}catch{/* start a new day */}
  const d:RaceDay={number:1,card:newRace(1,this.random),next:newRace(2,this.random),dd:[],results:[]};this.state={...this.state,raceDay:d};this.save();return d;
 }
 private saveDay(){this.state={...this.state,raceDay:this.day};this.save();}
 /** Daily Double money already in (its first leg won), waiting on this race. */
 ddRiding():number {return this.day.dd.filter(d=>d.race===this.day.number-1).reduce((a,b)=>a+b.amount,0);}
 setBox(on:boolean){const h=this.ui.races;if(h.phase==='running')return;h.box=on;h.picking=[];this.deps.render();}
 setQuick(on:boolean){this.ui.races.quick=on;this.deps.render();}
 setRaceKind(k:BetKind|'dd'|'atb'){const h=this.ui.races;if(h.phase!=='betting')return;h.kind=k;h.picking=[];this.deps.render();}
 pickRunner(no:number){
  const h=this.ui.races;if(h.phase==='running')return;
  if(h.phase==='done')this.nextRace();
  // The Daily Double: this race's winner, then the next race's winner.
  if(h.kind==='dd'){
   if(!h.picking.length){if(h.card.runners[no-1]?.scratched)return this.fail(new Error('That horse is scratched.'));h.picking=[no];return this.deps.render();}
   const a=h.picking[0];h.picking=[];if(h.next.runners[no-1]?.scratched)return this.fail(new Error('That horse is scratched in the next race.'));
   const o=ddOdds(h.card,h.next,a,no);if(!o)return this.fail(new Error('The book is not taking that Daily Double.'));
   if(this.pending('races')+this.ui.chip>this.state.balance)return this.fail(new Error('Not enough in your casino balance for that bet.'));
   const same=h.dd.find(d=>d.picks[0]===a&&d.picks[1]===no);
   h.dd=same?h.dd.map(d=>d===same?{...d,amount:d.amount+this.ui.chip}:d):[...h.dd,{picks:[a,no],amount:this.ui.chip,odds:o,race:h.card.number}];
   this.ui.error='';this.deps.sound('chip');return this.deps.render();
  }
  if(h.card.runners[no-1]?.scratched)return this.fail(new Error('That horse is scratched.'));
  // Patch 102: across the board, one chip each to Win, Place and Show.
  if(h.kind==='atb'){
   const bets=acrossTheBoard(no,this.ui.chip),priced=bets.map(b=>({...b,odds:odds(h.card,b.kind,b.picks)}));
   if(priced.some(b=>!b.odds))return this.fail(new Error('The book is not taking all three bets on that horse: the price is too short.'));
   if(this.pending('races')+3*this.ui.chip>this.state.balance)return this.fail(new Error('Across the board needs three chips.'));
   for(const bet of priced){const same=h.bets.find(b=>b.kind===bet.kind&&b.picks.join()===bet.picks.join());h.bets=same?h.bets.map(b=>b===same?{...b,amount:b.amount+bet.amount}:b):[...h.bets,bet];}
   this.ui.error='';this.deps.sound('chip');return this.deps.render();
  }
  const kind=h.kind,need=PICKS[kind];
  // Multi-horse bets: pick in order (tap a picked horse again to take it out).
  if(need>1){if(h.picking.includes(no)){h.picking=h.picking.filter(x=>x!==no);return this.deps.render();}h.picking=[...h.picking,no];if(h.picking.length<need)return this.deps.render();}
  const picks=need>1?h.picking:[no];h.picking=[];
  if(h.box&&BOXABLE.includes(kind)){
   const priced=boxBets(kind,picks,this.ui.chip).map(b=>({...b,odds:odds(h.card,b.kind,b.picks)})).filter(b=>b.odds>0);
   if(!priced.length)return this.fail(new Error('The book is not taking that box.'));
   if(this.pending('races')+priced.length*this.ui.chip>this.state.balance)return this.fail(new Error(`That box needs ${priced.length} chips.`));
   for(const bet of priced){const same=h.bets.find(b=>b.kind===bet.kind&&b.picks.join()===bet.picks.join());h.bets=same?h.bets.map(b=>b===same?{...b,amount:b.amount+bet.amount}:b):[...h.bets,bet];}
   this.ui.error='';this.deps.sound('chip');return this.deps.render();
  }
  const bet={kind,picks,amount:this.ui.chip};
  if(!validRaceBet(h.card,bet))return this.fail(new Error('That bet is not on this race.'));
  const o=odds(h.card,kind,picks);if(!o)return this.fail(new Error('The book is not taking that bet: the price is too short.'));
  if(this.pending('races')+bet.amount>this.state.balance)return this.fail(new Error('Not enough in your casino balance for that bet.'));
  const same=h.bets.find(b=>b.kind===bet.kind&&b.picks.join()===picks.join());
  h.bets=same?h.bets.map(b=>b===same?{...b,amount:b.amount+bet.amount}:b):[...h.bets,{...bet,odds:o}];
  this.ui.error='';this.deps.sound('chip');this.deps.render();
 }
 removeRaceBet(i:number){const h=this.ui.races;if(h.phase!=='betting')return;if(i<h.bets.length)h.bets=h.bets.filter((_,j)=>j!==i);else h.dd=h.dd.filter((_,j)=>j!==i-h.bets.length);this.deps.render();}
 clearRace(){const h=this.ui.races;if(h.phase!=='betting')return;h.bets=[];h.dd=[];h.picking=[];this.deps.render();}
 nextRace(){
  const h=this.ui.races;if(h.phase==='running')return;
  this.day={...this.day,number:this.day.number+1,card:this.day.next,next:newRace(this.day.number+2,this.random)};this.saveDay();
  h.card=this.day.card;h.next=this.day.next;h.bets=[];h.dd=[];h.order=null;h.phase='betting';h.call='';h.paths=null;h.picking=[];h.returned=0;h.wagered=0;h.photo=false;h.replay=false;this.ui.talk.races=[];this.deps.render();
 }
 startRace(){
  const h=this.ui.races;if(h.phase!=='betting')return;
  const riding=this.day.dd.filter(d=>d.race===h.card.number-1);
  const total=this.pending('races');if(!total&&!riding.length)return this.fail(new Error('Put a bet on a runner first.'));
  try{
   if(total)this.state=stake(this.state,total);
   const order=runRace(h.card,this.random);
   let returned=h.bets.reduce((a,b)=>a+settleBet(b,b.odds,order),0),wagered=h.bets.reduce((a,b)=>a+b.amount,0);
   // Daily Doubles finishing in this race, and new ones whose first leg is this race.
   for(const d of riding){wagered+=d.amount;if(order[0]===d.picks[1])returned+=d.amount+Math.floor(d.amount*d.odds);}
   const carry:DailyDouble[]=[];for(const d of h.dd){if(order[0]===d.picks[0])carry.push(d);else wagered+=d.amount;}
   const winner=h.card.runners[order[0]-1];
   if(wagered)this.state=this.record(this.state,'races',wagered,returned,describeRace(h.bets,riding.length+h.dd.length),`#${winner.no} ${winner.name} won`);
   this.day={...this.day,dd:[...this.day.dd.filter(d=>d.race!==h.card.number-1),...carry],results:[...this.day.results,{number:h.card.number,track:h.card.track,no:winner.no,name:winner.name,odds:odds(h.card,'win',[winner.no])}].slice(-12)};
   this.state=pushBoard({...this.state,raceDay:this.day},'races',winner.name,12);this.save();
   h.order=order;h.returned=returned;h.wagered=wagered;h.phase='running';h.replay=false;h.paths=paths(order,RACE_FRAMES,this.random);h.results=[];h.frame=0;this.ui.error='';
   const leaderAt=(f:number)=>{const k=Math.round(f*RACE_FRAMES);let best=order[0],x=-1;for(const no of order){const v=h.paths![no][Math.min(RACE_FRAMES,k)];if(v>x){x=v;best=no;}}return best;};
   const won=margin(h.paths,order);h.photo=won.photo;
   h.lines=calls(h.card,order,leaderAt,won);
   const seed=`rc:${h.card.id}`,ps=this.ui.patrons.races,live=h.card.runners.filter(r=>!r.scratched),picks=ps.map(p=>live[pickFor(p,seed,live.length)].no);
   this.ui.talk.races=ps.flatMap((p,i)=>speaks(p,`${seed}:start`,.5)?[{name:p.name,text:patronLine('races',p,'start',String(picks[i]),seed),mood:'talk' as const}]:[]).slice(0,2);
   // Patch 104: someone on your horse says so.
   const mine=new Set(h.bets.map(b=>b.picks[0])),twin=ps.findIndex((p,i)=>mine.has(picks[i])&&!this.ui.talk.races.some(l=>l.name===p.name));
   if(twin>=0&&chanceOf(`${seed}:twin`,.6))this.ui.talk.races.push({name:ps[twin].name,text:heroLine(ps[twin],'sameBet',`#${picks[twin]}`,seed),mood:'you',to:'You'});
   this.ui.talk.races=this.liven('races',`${seed}:s`,this.ui.talk.races,{reply:.3,act:.45});
   this.deps.sound('bugle');
   this.run(()=>{this.ui.talk.races=ps.flatMap((p,i)=>{const w=order[0]===picks[i];return w||speaks(p,`${seed}:end`,.35)?[{name:p.name,text:patronLine('races',p,w&&odds(h.card,'win',[picks[i]])>=8?'big':w?'win':'lose',String(picks[i]),seed),mood:(w?'win':'lose') as 'win'|'lose'}]:[];}).slice(0,2);
    const you=this.heroOutcome(wagered,returned);this.ui.talk.races=this.liven('races',`${seed}:e`,this.ui.talk.races,{hero:you.ev,heroOdds:you.odds,reply:.35,act:.2});this.comeAndGo('races',`${seed}:tv`);
    this.deps.sound(returned>wagered?'money':returned>0?'win':'fold');});
  }catch(e){this.fail(e);}
 }
 /** Run the race on screen (or the replay), then finish with the last call. */
 private run(after:()=>void){
  const h=this.ui.races,lines=h.lines;let frame=0,next=1;h.call=lines[0].text;h.frame=0;this.deps.render();
  const tick=(h.quick?QUICK_RACE_MS:RACE_MS)/RACE_FRAMES;let roared=false;
  this.raceTimer=window.setInterval(()=>{
   frame++;h.frame=frame;const f=frame/RACE_FRAMES;
   if(this.deps.active('races'))this.drawRace(frame);
   if(next<lines.length-1&&f>=lines[next].at){h.call=lines[next].text;next++;this.deps.render();this.drawRace(frame);}
   if(!roared&&f>=.85){roared=true;this.deps.sound('crowd');}
   if(frame>=RACE_FRAMES){clearInterval(this.raceTimer);this.raceTimer=0;
    const done=()=>{h.call=lines[lines.length-1].text;h.phase='done';h.results=h.order!.slice(0,3);if(!h.replay)after();h.replay=false;this.deps.render();this.drawRace(RACE_FRAMES);};
    // A close finish goes to the photo first.
    if(h.photo){h.call='Photo finish!';this.deps.render();this.drawRace(RACE_FRAMES);this.wait(1600,done);}else done();}
  },tick);
 }
 /** Watch the last race again. Nothing is paid twice: the replay only moves the horses. */
 replayRace(){const h=this.ui.races;if(h.phase!=='done'||!h.paths||!h.lines.length)return;h.phase='running';h.replay=true;this.ui.talk.races=[];this.run(()=>{});}
 /** Moves the horses on screen without redrawing the page. */
 drawRace(frame:number){
  const h=this.ui.races;if(!h.paths||typeof document==='undefined')return;
  const runners=h.card.runners.filter(r=>!r.scratched&&h.paths![r.no]);
  for(const r of runners){const el=document.querySelector<HTMLElement>(`[data-race-horse="${r.no}"]`);if(el)el.style.setProperty('--x',String(h.paths[r.no][Math.min(frame,RACE_FRAMES)]));}
  // The running order board.
  const board=document.querySelector<HTMLElement>('[data-race-order]');
  if(board){const k=Math.min(frame,RACE_FRAMES),ord=[...runners].sort((a,b)=>h.paths![b.no][k]-h.paths![a.no][k]).slice(0,4);board.textContent=ord.map((r,i)=>`${i+1}. #${r.no}`).join('  ');}
 }
}

/* Patch 102: short notes for the "Your rounds" panel. */
const RNAME:Record<string,string>={red:'Red',black:'Black',odd:'Odd',even:'Even',low:'1–18',high:'19–36'};
function describeRoulette(bets:readonly RouletteBet[]):string {
 const one=(b:RouletteBet)=>RNAME[b.kind]??(b.kind==='dozen'?`Dozen ${Math.ceil(b.numbers[0]/12)}`:b.kind==='column'?`Column ${((b.numbers[0]-1)%3)+1}`:b.kind==='straight'?pocketLabel(b.numbers[0]):`${b.kind[0].toUpperCase()}${b.kind.slice(1)} ${b.numbers.map(pocketLabel).join('-')}`);
 return bets.length<=2?bets.map(one).join(' · '):`${one(bets[0])} + ${bets.length-1} more`;
}
const BNAME:Record<BaccaratSpot,string>={player:'Player',banker:'Banker',tie:'Tie',playerPair:'P pair',bankerPair:'B pair',dragon7:'Dragon 7',panda8:'Panda 8',lucky6:'Lucky 6',dragonP:'Dragon P',dragonB:'Dragon B'};
const describeBaccarat=(bets:BaccaratBets)=>SPOTS.filter(s=>bets[s]).map(s=>BNAME[s]).join(' · ');
function describeRace(bets:readonly RaceBet[],dd:number):string {
 const parts=bets.slice(0,2).map(b=>`${b.kind[0].toUpperCase()}${b.kind.slice(1)} ${b.picks.map(n=>'#'+n).join('-')}`);
 if(!bets.length)return dd>1?`${dd} Daily Doubles`:'Daily Double';
 const more=bets.length-parts.length+dd;return parts.join(' · ')+(more?` + ${more} more`:'');
}
