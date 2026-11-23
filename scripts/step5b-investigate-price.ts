import {mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createProfile,analyzeDecision} from '../src/bots/policy';
import {observeBot} from '../src/core/engine';
import {act,hand,rig} from '../tests/verification/helpers';
import type {DrawResponseKind,DrawResponseStreet} from '../src/contracts';
const cards={oesd:{own:['9c','8d'],board:['6h','7s','Kc','2d','Qh']},combo:{own:['9h','8h'],board:['6h','7h','Kc','2d','Qs']}};
function fixture(kind:keyof typeof cards,street:DrawResponseStreet,fraction:number){const c=cards[kind],dead=[...c.own,...c.board],available=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(c=>!dead.includes(c));let g=rig(hand([100000,100000]),[c.own,available.slice(0,2)],c.board);g=act(g,{type:'raise',to:1000});g=act(g,{type:'call'});while(g.street!==street)g=act(g,{type:'check'});return act(g,{type:'raise',to:Math.round(2000*fraction)});}
const profile=createProfile({selection:'tag'},555,'neutral'),rows=[];
for(const [kind,street,fractions] of [['oesd','flop',[1.5,1.5005,1.501,1.51,2,2.0005,2.5]],['oesd','turn',[.5,.5005,.501,.51,.75]],['combo','turn',[.5,.5005,.501,.51,.75]]] as const){
 for(const fraction of fractions){const game=fixture(kind,street,fraction),o=observeBot(game,0,profile.policyVersion,'price-investigation'),a=analyzeDecision(o,profile),r=a.ranges!;
 rows.push({kind,street,potFraction:fraction,ownCards:o.ownCards,board:o.board,publicEvents:o.publicEvents,seats:o.seats,legal:o.legal,profile,continuation:1-a.distribution.fold,distribution:a.distribution,features:a.features,context:a.context,postflop:a.postflop,range:{equity:r.equity,equityStdError:r.equityStdError,equitySamples:r.equitySamples,uncertainty:r.uncertainty,strongMadeMass:r.opponents[0].strongMadeMass,drawMass:r.opponents[0].drawMass,foldEquity:r.foldEquity,combos:r.opponents[0].combos}});
 console.log(JSON.stringify({kind,street,fraction,continued:1-a.distribution.fold,equity:r.equity,se:r.equityStdError,price:a.postflop!.rakeAdjustedPrice,realized:a.postflop!.realizedEquity,drawFloor:a.postflop!.drawContinue,strongMass:r.opponents[0].strongMadeMass,drawMass:r.opponents[0].drawMass}));
 }
}
mkdirSync('tests/step5b-performance/evidence/price-investigation',{recursive:true});writeFileSync('tests/step5b-performance/evidence/price-investigation/inputs.json',JSON.stringify({source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'Independent diagnosis only; no runtime changes',rows},null,2));
