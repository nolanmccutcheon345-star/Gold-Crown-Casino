import {describe,it,expect,vi} from 'vitest';
import {writeFileSync} from 'node:fs';
import type {GameState,RuleProfile} from '../../src/contracts';
import {startHand,applyCommand,observeBot,legalActions,assertAccounting,nextTournamentHand} from '../../src/core/engine';
import {seedStream,createProfile,ARCHETYPES} from '../../src/bots/profiles';
import {chooseDecision} from '../../src/bots/policy';
import {enumerateStartingCombos} from '../../src/bots/preflop';
import {chooseTournamentDecision,analyzeTournamentShortStack,TOURNAMENT_BOT_POLICY_VERSION as V} from '../../src/tournament/bot-policy';
const rules:RuleProfile={id:'short-stack-review',version:'1',mode:'tournament',smallBlind:50,bigBlind:100,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:0,antePriority:'blind-first',buttonRule:'dead-button'}};
const p=createProfile({selection:'stronger-reg'},351,'neutral');
const act=(s:GameState,action:Parameters<typeof applyCommand>[1]['action'])=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`step:${s.revision}`,action});
function scenario(depth=3,late=false,raised=false){let s=startHand({handId:'short-stack',button:0,profile:rules,seats:Array.from({length:9},(_,id)=>({id,name:`Seat${id}`,stack:(id===(late?0:raised?4:3)?depth:100)*100}))});if(raised)s=act(s,{type:'raise',to:600});if(late)while(s.actor!==0)s=act(s,{type:'fold'});return s;}
function observation(depth=3,late=false,raised=false,cards=['As','Ah']){const s=scenario(depth,late,raised),o=observeBot(s,s.actor!,p.policyVersion,'policy35');o.ownCards=cards;return o;}
describe('versioned synthetic tournament short-stack overlay',()=>{
 it('preserves historical decisions byte-for-byte without event opt-in',()=>{const o=observation();expect(chooseTournamentDecision(o,p,seedStream(1))).toEqual(chooseDecision(o,p,seedStream(1)));expect(()=>chooseTournamentDecision(o,p,seedStream(1),'unknown')).toThrow(/Unsupported/);});
 it('uses a stack-depth and position dependent unopened range',()=>{const early=analyzeTournamentShortStack(observation(12),p),short=analyzeTournamentShortStack(observation(3),p),late=analyzeTournamentShortStack(observation(3,true),p);expect(short.selectionFraction).toBeGreaterThan(early.selectionFraction);expect(late.selectionFraction).toBeGreaterThan(short.selectionFraction);expect(early.applicable).toBe(true);expect(analyzeTournamentShortStack(observation(13),p).applicable).toBe(false);});
 it('does not fold premium pairs to a short-stack shove or overbet',()=>{for(const cards of [['As','Ah'],['Ks','Kh'],['Qs','Qh']])for(const seed of [1,4,99,100001])expect(chooseTournamentDecision(observation(3,false,true,cards),p,seedStream(seed),V).action.type).not.toBe('fold');});
 it('does not pay a large raise with the weakest offsuit hand',()=>{for(let seed=0;seed<40;seed++)expect(chooseTournamentDecision(observation(12,false,true,['7s','2h']),p,seedStream(seed),V).action.type).toBe('fold');});
 it('keeps a free check rather than folding a weak big blind',()=>{let s=scenario();while(s.actor!==2)s=act(s,legalActions(s).check?{type:'check'}:{type:'call'});const o=observeBot(s,2,p.policyVersion,'check');o.ownCards=['7s','2h'];o.seats.find(x=>x.id===2)!.stack=200;o.legal.maxRaiseTo=300;expect(chooseTournamentDecision(o,p,seedStream(1),V).action.type).toBe('check');});
 it('excludes excess side-pot chips from call pricing',()=>{const o=observation(3,false,true),a=analyzeTournamentShortStack(o,p);const bigger=structuredClone(o);bigger.seats.find(x=>x.id===3)!.streetCommitted+=10000;bigger.seats.find(x=>x.id===3)!.totalCommitted+=10000;bigger.pot+=10000;expect(analyzeTournamentShortStack(bigger,p).callPrice).toBe(a.callPrice);});
 it('is deterministic, input immutable, and cannot read extra secrets',()=>{const o=observation(3,true,false,['Ah','5h']),before=JSON.stringify(o),secret=Object.assign({},o);Object.defineProperty(secret,'deck',{get(){throw Error('deck access');}});for(const s of secret.seats)Object.defineProperty(s,'hole',{get(){throw Error('other private cards');}});expect(chooseTournamentDecision(secret,p,seedStream(888),V)).toEqual(chooseTournamentDecision(o,p,seedStream(888),V));expect(JSON.stringify(o)).toBe(before);expect(chooseTournamentDecision(o,p,seedStream(888),V).observationHash.startsWith(V)).toBe(true);});
 it('does not favor Hero or a particular physical seat identity',()=>{const a=observation(3,true,false,['As','5s']),b=structuredClone(a),rotate=(id:number)=>(id+2)%9;b.actingSeat=rotate(a.actingSeat);b.button=rotate(a.button);b.legal.actor=rotate(a.legal.actor!);b.seats=b.seats.map(s=>({...s,id:rotate(s.id)})).sort((x,y)=>x.id-y.id);b.publicEvents=b.publicEvents.map(e=>({...e,...e.seatId===undefined?{}:{seatId:rotate(e.seatId)}}));expect(chooseTournamentDecision(a,p,seedStream(92),V).action).toEqual(chooseTournamentDecision(b,p,seedStream(92),V).action);});
 it('rejects invalid random entropy and legal action ownership',()=>{expect(()=>chooseTournamentDecision(observation(),p,()=>1,V)).toThrow(/random/);const o=observation();o.legal.actor=9;expect(()=>chooseTournamentDecision(o,p,seedStream(1),V)).toThrow(/turn/);});
 it.each(ARCHETYPES)('submits only engine-legal actions for %s over seeded hands',archetype=>{const profile=createProfile({selection:archetype},99,'neutral');for(let seed=0;seed<8;seed++){let s=startHand({handId:`${archetype}:${seed}`,button:seed%6,profile:rules,seats:Array.from({length:6},(_,id)=>({id,name:`Seat${id}`,stack:100+((seed+id)%12)*100}))});for(let count=0;s.street!=='complete'&&count<120;count++){const o=observeBot(s,s.actor!,profile.policyVersion,`bot:${count}`),d=chooseTournamentDecision(o,profile,seedStream(seed*1000+count),V);s=applyCommand(s,d);assertAccounting(s);}expect(s.street).toBe('complete');}});
});
const distributions:unknown[]=[];
describe('matched 1326-combination controlled decision populations',()=>{
 it.each([1.5,3,6,12,25])('measures every starting combination at %s BB',depth=>{const rows=[];for(const [late,raised]of [[false,false],[true,false],[false,true]]){const base=observation(depth,late,raised);const counts={fold:0,check:0,call:0,raise:0},legacy={fold:0,check:0,call:0,raise:0};for(const [i,combo]of enumerateStartingCombos().entries()){const o={...base,ownCards:combo.cards};counts[chooseTournamentDecision(o,p,seedStream(35100+i),V).action.type]++;legacy[chooseDecision(o,p,seedStream(35100+i)).action.type]++;}expect(Object.values(counts).reduce((a,b)=>a+b,0)).toBe(1326);rows.push({late,raised,opportunities:1326,counts,legacy});}distributions.push({depth,rows});writeFileSync('tests/tournament-bots35/conditional-results.json',JSON.stringify({version:V,seed:35100,denominator:'All 1326 legal starting combinations; one deterministic seeded draw per combo per specified public context. Synthetic controlled population, not human frequencies.',rows:distributions},null,2));});
});
const completeEvents:unknown[]=[];
describe('held-out whole-event blind and fold/check-Hero probe',()=>{
 it.each([170035,370035,710035])('finishes matched seeded nine-player engine events at seed %s',seed=>{
  for(const overlay of [false,true]){
   const random=seedStream(seed);const spy=vi.spyOn(globalThis.crypto,'getRandomValues').mockImplementation((array)=>{const a=array as Uint32Array;for(let i=0;i<a.length;i++)a[i]=Math.floor(random()*0x100000000);return array;});
   try{
    const profiles=Array.from({length:9},(_,id)=>createProfile({selection:ARCHETYPES[id%8]},seed+id,'neutral'));
    let s=startHand({handId:`heldout:${seed}:1`,profile:{...rules,smallBlind:25,bigBlind:50},button:0,seats:Array.from({length:9},(_,id)=>({id,name:`Seat${id}`,stack:5000}))});
    let hands=0,decisions=0,heroPlace:number|null=null,headsUpBB:number|null=null;const buckets:Record<string,{opportunities:number;fold:number;call:number;raise:number;check:number}>={};
    for(;hands<250;){
     while(s.street!=='complete'){
      const actor=s.actor!,legal=legalActions(s);if(actor===0){s=act(s,legal.check?{type:'check'}:{type:'fold'});continue;}
      const profile=profiles[actor],o=observeBot(s,actor,profile.policyVersion,`heldout:${s.handId}:${s.revision}`),depth=(s.seats.find(x=>x.id===actor)!.stack+s.seats.find(x=>x.id===actor)!.streetCommitted)/s.profile.bigBlind;
      const d=chooseTournamentDecision(o,profile,seedStream(seed+decisions++),overlay?V:undefined);
      if(s.street==='preflop'&&legal.callAmount>0){const bucket=depth<=3?'<=3':depth<=6?'3-6':depth<=12?'6-12':depth<=25?'12-25':'>25';buckets[bucket]??={opportunities:0,fold:0,call:0,raise:0,check:0};buckets[bucket].opportunities++;buckets[bucket][d.action.type]++;}
      s=applyCommand(s,d);assertAccounting(s);
     }
     hands++;const alive=s.seats.filter(x=>x.stack>0);expect(alive.reduce((n,x)=>n+x.stack,0)).toBe(45000);
     if(heroPlace===null&&s.seats.find(x=>x.id===0)?.stack===0)heroPlace=alive.length+1;
     if(alive.length===2&&headsUpBB===null)headsUpBB=22500/s.profile.bigBlind;
     if(alive.length===1){if(alive[0].id===0)heroPlace=1;break;}
     const bb=Math.round(50*2**Math.floor(hands/8));s=nextTournamentHand(s,`heldout:${seed}:${hands+1}`,{...rules,smallBlind:Math.max(1,Math.floor(bb/2)),bigBlind:bb});
    }
    expect(s.seats.filter(x=>x.stack>0)).toHaveLength(1);completeEvents.push({seed,overlay,hands,decisions,heroPlace,headsUpBB,buckets});
   }finally{spy.mockRestore();}
  }
  writeFileSync('tests/tournament-bots35/full-event-results.json',JSON.stringify({version:V,method:'Engine-only held-out 9-player events: 45000 conserved chips, Hero check/fold, public bot observations, seeded shuffle and decisions. Blinds double every 8 hands (controlled stress schedule, not shipped preset). Same seeds per before/after event; subsequent paths differ. No assertion on Hero profitability. Small samples are not human calibration.',events:completeEvents},null,2));
 });
});
