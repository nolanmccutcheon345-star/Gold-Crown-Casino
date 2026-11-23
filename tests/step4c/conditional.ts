import type {Action,Card,GameState,BotProfile} from '../../src/contracts';
import {applyCommand,observeBot,legalActions,startHand} from '../../src/core/engine';
import {chooseDecision,createProfile,analyzeDecision} from '../../src/bots/policy';
import {createProfile as oldProfile} from '../../src/bots/v2/profiles';
import {rig,practiceProfile} from '../verification/helpers';
import {STYLES,rng,clusteredRate,reconcile} from './audit';
import {runHand,type Model} from './population';
export const FAMILIES=['small-river-pair','large-river-pair','missed-river-draw','river-air','short-price','multiway-price'] as const;
export type Family=typeof FAMILIES[number];
function act(g:GameState,a:Action){return applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:`prefix:${g.handId}:${g.revision}`,action:a});}
const checkCall=(g:GameState)=>legalActions(g).check?{type:'check'} as Action:{type:'call'} as Action;
const BOARDS:Card[][]=[['Ks','8h','3h','9c','2d'],['Qs','7h','2h','Tc','4d'],['Js','6h','2h','9c','3d'],['Ts','7h','3h','Kc','2d'],['9s','6h','2h','Qc','4d'],['8s','5h','2h','Jc','3d'],['Ks','9h','4h','7c','2d'],['Qs','8h','3h','6c','2d']];
export function conditionalFixture(family:Family,variant:number):{state:GameState;focus:number;description:string;expectedPrice:number|null}{
 const board=BOARDS[variant].slice(),count=family==='multiway-price'?3:2,stack=family==='short-price'?37:family==='multiway-price'?43:137;
 const top=board[0][0],own:Card[]=family==='small-river-pair'||family==='large-river-pair'?[top+'d','5c']:family==='missed-river-draw'?['Ah','Jh']:family==='short-price'||family==='multiway-price'?['Ac','7d']:['Ac','5d'];
 if(family==='river-air')own[1]=['5','4','6','7','T','J'].find(r=>!board.some(c=>c[0]===r))!+'d';
 // Resolve ranks that happen to collide with the authored board while retaining category.
 for(let i=0;i<own.length;i++)if(board.includes(own[i])||own.indexOf(own[i])!==i)own[i]=own[i][0]+'s';
 if(family==='missed-river-draw'&&board.includes('Jh'))board[1]='4h';
 const used=new Set([...own,...board]),rest=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(c=>!used.has(c)),random=rng(0x4ce77+variant);
 for(let i=rest.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[rest[i],rest[j]]=[rest[j],rest[i]];}
 const holes=[own,...Array.from({length:count-1},()=>rest.splice(0,2))],profile=practiceProfile();let g=rig(startHand({handId:`heldout4c:${family}:${variant}`,button:0,profile,seats:Array.from({length:count},(_,id)=>({id,name:`Seat${id}`,stack:200*(id===0?stack:id===1?175:95)}))}),holes,board);
 while(g.street==='preflop')g=act(g,checkCall(g));
 if(family==='short-price'){g=act(g,{type:'raise',to:g.seats[1].stack});}
 else if(family==='multiway-price'){
  // Both deeper opponents commit more than Hero can win; Hero faces the resulting side-pot dead excess.
  g=act(g,{type:'raise',to:12000});g=act(g,{type:'call'});
 }else{
  while(g.street!=='river')g=act(g,checkCall(g));
  if(family==='small-river-pair'||family==='large-river-pair')g=act(g,{type:'raise',to:Math.max(200,Math.round(g.pot*(family==='small-river-pair'?.25:2.25)))});
  else g=act(g,{type:'check'});
 }
 if(g.actor!==0)throw Error('Conditional focus mismatch');const legal=legalActions(g),target=g.seats[0].totalCommitted+legal.callAmount,contestable=g.seats.reduce((n,s)=>n+Math.min(s.totalCommitted+(s.id===0?legal.callAmount:0),target),0);
 return{state:g,focus:0,description:`Fresh ${family} rank pattern${variant}; ${stack}BB focus vs175BB opponent(s); prefix scripted, first response sampled, representative continuations are full policies.`,expectedPrice:legal.callAmount?legal.callAmount/contestable:0};
}
export function conditionalEvaluation(model:Model,samples=128){
 const rows=[],examples=[];let decisions=0;
 for(const family of FAMILIES)for(const [ai,archetype]of STYLES.entries()){
  const blocks:{variant:number;samples:number;actions:Record<'fold'|'check'|'call'|'raise',number>;sizes:number[];expectedPrice:number|null;reportedPrice:number;priceError:number;profile:BotProfile;own:Card[];board:Card[];legal:ReturnType<typeof legalActions>}[]=[];for(let variant=0;variant<8;variant++){
   const f=conditionalFixture(family,variant),make=model==='baseline-1.1'?oldProfile:createProfile,p=make({selection:archetype},0x4cdf0000+variant*100+ai,'neutral'),o=observeBot(f.state,0,p.policyVersion,`sample:${family}:${variant}`),counts={fold:0,check:0,call:0,raise:0},sizes:number[]=[];
   for(let draw=0;draw<samples;draw++){const d=chooseDecision(o,p,rng(0x4cf00000+draw*1009+variant*101));const l=o.legal,a=d.action;const legal=a.type==='fold'?l.fold:a.type==='check'?l.check:a.type==='call'?l.callAmount>0:a.type==='raise'&&l.canRaise&&Number.isSafeInteger(a.to)&&((a.to>=l.minRaiseTo!&&a.to<=l.maxRaiseTo!)||a.to===l.shortAllInTo);if(!legal)throw Error('Illegal conditional sample');counts[d.action.type]++;if(d.action.type==='raise')sizes.push(d.action.to);decisions++;if(draw===0){const next=applyCommand(f.state,d);reconcileIfComplete(next);}}
   const analysis=analyzeDecision(o,p);blocks.push({variant,samples,actions:counts,sizes,expectedPrice:f.expectedPrice,reportedPrice:analysis.context.price,priceError:analysis.context.price-(f.expectedPrice??0),profile:p,own:o.ownCards,board:o.board,legal:o.legal});
   if(variant===0||variant===7){const ps=f.state.seats.map((s,i):BotProfile=>i===0?p:make({selection:STYLES[(ai+i+3)%8]},0x4cde0000+variant*100+i,'neutral'));const result=runHand(f.state,ps,0x4caad000+variant+ai*100,[]);examples.push({family,archetype,variant,description:f.description,scriptedPrefix:f.state.events,firstDecision:blocks.at(-1),record:result.record});}
  }
  rows.push({family,archetype,observations:8,samplesPerObservation:samples,opportunities:8*samples,actions:Object.fromEntries((['fold','check','call','raise'] as const).map(a=>[a,clusteredRate(blocks.map(b=>({count:b.actions[a],opportunities:b.samples})))])),blocks});
 }return{model,totalSampledDecisions:decisions,allSamplesIndependentlyLegal:true,rows,examples,definitions:'Fixed fresh rank/runout fixtures with8 variant/personality clusters. First response action counts are conditional simulations, not population rates. Full recorded continuation per first/last variant; prefixes explicitly scripted. Outcome selection is illustrative, not human expert judgment.'};
}
function reconcileIfComplete(g:GameState){if(g.street==='complete')reconcile(g);}
